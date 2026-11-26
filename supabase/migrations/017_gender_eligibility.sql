-- ============================================================================
-- OFKOSSEC — Migration 017: some ballots are open to one gender only.
--
-- Until now every registered student could vote in every election. Some posts,
-- however, are contested only by (or only for) one gender — a Girls' Prefect is
-- chosen by the girls, a Boys' Sports Captain by the boys. This migration makes
-- that a property of the election rather than something officers have to police
-- by hand.
--
-- Two columns carry the rule:
--   * public.profiles.gender        — the voter's gender (male / female), set by
--                                     the officer console when a voter is added
--                                     or edited. Nullable: a register imported
--                                     before this migration has no gender yet.
--   * public.elections.eligible_gender — 'any' (the default, unchanged
--                                     behaviour), 'male' or 'female'.
--
-- The rule is enforced in the same place every other voting rule is: inside
-- cast_vote() and change_vote(). The browser is told who may vote so it can
-- explain itself, but the database is what actually stops a ballot — a
-- restricted election cannot be voted in by a determined student who edits the
-- page, exactly as migration 014 made the voter register impossible to forge.
--
-- A voter whose gender is not recorded is treated as ineligible for a
-- restricted election, never as a wildcard. Guessing would hand a restricted
-- ballot to anyone the officer had not classified yet.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The two new columns.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists gender text;

alter table public.profiles
  drop constraint if exists profiles_gender_check;
alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('male', 'female'));

alter table public.elections
  add column if not exists eligible_gender text not null default 'any';

alter table public.elections
  drop constraint if exists elections_eligible_gender_check;
alter table public.elections
  add constraint elections_eligible_gender_check
  check (eligible_gender in ('any', 'male', 'female'));

-- ---------------------------------------------------------------------------
-- 2. Does the caller's gender satisfy the election's rule?
--    True when the election is open to all, or when the caller's recorded
--    gender matches. False for an unknown gender on a restricted election.
-- ---------------------------------------------------------------------------
create or replace function public.voter_meets_gender_rule(p_election_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select e.eligible_gender = 'any' or p.gender = e.eligible_gender
    from public.elections e
    join public.profiles p on p.id = auth.uid()
    where e.id = p_election_id
  ), false);
$$;

grant execute on function public.voter_meets_gender_rule(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Officer console: record a voter's gender.
--    The parameter is appended, so the old three-argument functions are dropped
--    first — leaving both in place would make the PostgREST overloads
--    ambiguous. Grants are re-issued below.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_create_voter(text, text, text);
drop function if exists public.admin_update_voter(uuid, text, text, text);

create or replace function public.admin_create_voter(
  p_index_number text,
  p_class_name   text,
  p_full_name    text default null,
  p_gender       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_index   text := trim(coalesce(p_index_number, ''));
  v_class   text := trim(coalesce(p_class_name, ''));
  v_gender  text := nullif(trim(coalesce(p_gender, '')), '');
  v_email   text;
  v_user_id uuid;
  v_name    text;
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can add voters';
  end if;

  if v_index = '' then
    raise exception 'An index number is required';
  end if;

  if v_class = '' then
    raise exception 'A class is required';
  end if;

  if v_gender is not null and v_gender not in ('male', 'female') then
    raise exception 'A gender, when given, must be either male or female';
  end if;

  v_email := public.voter_email(v_index);

  if v_email = '@voters.ballotbox.edu' then
    raise exception 'That index number cannot be used as a login';
  end if;

  if exists (select 1 from public.profiles p where lower(p.student_id) = lower(v_index)) then
    raise exception 'Voter % already exists', v_index using errcode = 'unique_violation';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Voter % already exists', v_index using errcode = 'unique_violation';
  end if;

  v_user_id := gen_random_uuid();
  v_name := coalesce(nullif(trim(coalesce(p_full_name, '')), ''), v_index);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_class, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name, 'student_id', v_index, 'class_name', v_class),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  -- handle_new_user() has already written the matching public.profiles row;
  -- gender is not part of that trigger, so it is set here.
  update public.profiles set gender = v_gender where id = v_user_id;

  return v_user_id;
end;
$$;

create or replace function public.admin_update_voter(
  p_voter_id     uuid,
  p_index_number text,
  p_class_name   text,
  p_full_name    text default null,
  p_gender       text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_index   text := trim(coalesce(p_index_number, ''));
  v_class   text := trim(coalesce(p_class_name, ''));
  v_gender  text := nullif(trim(coalesce(p_gender, '')), '');
  v_email   text;
  v_name    text;
  v_current_email text;
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can edit voters';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_voter_id) then
    raise exception 'That voter no longer exists';
  end if;

  if exists (select 1 from public.profiles p where p.id = p_voter_id and p.role = 'admin') then
    raise exception 'Officer accounts cannot be edited from here';
  end if;

  if v_index = '' then
    raise exception 'An index number is required';
  end if;

  if v_class = '' then
    raise exception 'A class is required';
  end if;

  if v_gender is not null and v_gender not in ('male', 'female') then
    raise exception 'A gender, when given, must be either male or female';
  end if;

  v_email := public.voter_email(v_index);

  if v_email = '@voters.ballotbox.edu' then
    raise exception 'That index number cannot be used as a login';
  end if;

  -- The new index number must be free: no other profile, no other auth user.
  if exists (
    select 1 from public.profiles p
    where p.id <> p_voter_id and lower(p.student_id) = lower(v_index)
  ) then
    raise exception 'Voter % already exists', v_index using errcode = 'unique_violation';
  end if;

  if exists (
    select 1 from auth.users u
    where lower(u.email) = v_email and u.id <> p_voter_id
  ) then
    raise exception 'Voter % already exists', v_index using errcode = 'unique_violation';
  end if;

  select u.email into v_current_email from auth.users u where u.id = p_voter_id;

  v_name := coalesce(nullif(trim(coalesce(p_full_name, '')), ''), v_index);

  update auth.users u
  set email             = v_email,
      encrypted_password = crypt(v_class, gen_salt('bf')),
      raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
                             || jsonb_build_object(
                                  'full_name', v_name,
                                  'student_id', v_index,
                                  'class_name', v_class
                                ),
      email_confirmed_at = coalesce(u.email_confirmed_at, now()),
      updated_at         = now()
  where u.id = p_voter_id;

  -- Supabase resolves the login through auth.identities, so its copy of the
  -- email has to move with the account.
  update auth.identities i
  set identity_data = i.identity_data || jsonb_build_object('email', v_email),
      updated_at    = now()
  where i.user_id = p_voter_id and i.provider = 'email';

  update public.profiles p
  set student_id = v_index,
      class_name = v_class,
      full_name  = v_name,
      gender     = v_gender
  where p.id = p_voter_id;
end;
$$;

grant execute on function public.admin_create_voter(text, text, text, text) to authenticated;
grant execute on function public.admin_update_voter(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Casting a ballot now also has to satisfy the gender rule.
--    Same gate as migration 014, with the eligibility check slotted in beside
--    it. The register check still runs first, so an account that is not a
--    voter is told that rather than something about gender.
-- ---------------------------------------------------------------------------
create or replace function public.cast_vote(p_election_id uuid, p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter   uuid := auth.uid();
  v_vote_id uuid;
begin
  if v_voter is null then
    raise exception 'You must be signed in to vote';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_voter and p.role = 'student' and p.student_id is not null
  ) then
    raise exception 'You are not on the voters register, so you cannot vote';
  end if;

  if not public.is_election_open(p_election_id) then
    raise exception 'This election is not open for voting';
  end if;

  if not public.voter_meets_gender_rule(p_election_id) then
    raise exception 'This ballot is open to % students only', (
      select case e.eligible_gender
               when 'male'   then 'male'
               when 'female' then 'female'
               else 'all'
             end
      from public.elections e where e.id = p_election_id
    );
  end if;

  if not public.candidate_in_election(p_candidate_id, p_election_id) then
    raise exception 'That candidate is not on this ballot';
  end if;

  insert into public.ballot_receipts (election_id, voter_id)
  values (p_election_id, v_voter);

  insert into public.votes (election_id, candidate_id)
  values (p_election_id, p_candidate_id)
  returning id into v_vote_id;

  insert into public.ballot_pointers (election_id, voter_id, vote_id)
  values (p_election_id, v_voter, v_vote_id);
end;
$$;

grant execute on function public.cast_vote(uuid, uuid) to authenticated;

create or replace function public.change_vote(p_election_id uuid, p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter   uuid := auth.uid();
  v_vote_id uuid;
begin
  if v_voter is null then
    raise exception 'You must be signed in to vote';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_voter and p.role = 'student' and p.student_id is not null
  ) then
    raise exception 'You are not on the voters register, so you cannot vote';
  end if;

  if not public.is_election_open(p_election_id) then
    raise exception 'Voting has closed for this election, so your ballot is final';
  end if;

  if not public.voter_meets_gender_rule(p_election_id) then
    raise exception 'This ballot is open to % students only', (
      select case e.eligible_gender
               when 'male'   then 'male'
               when 'female' then 'female'
               else 'all'
             end
      from public.elections e where e.id = p_election_id
    );
  end if;

  if not public.candidate_in_election(p_candidate_id, p_election_id) then
    raise exception 'That candidate is not on this ballot';
  end if;

  select bp.vote_id into v_vote_id
  from public.ballot_pointers bp
  where bp.election_id = p_election_id and bp.voter_id = v_voter;

  if v_vote_id is null then
    raise exception 'You have no changeable ballot in this election';
  end if;

  update public.votes
     set candidate_id = p_candidate_id
   where id = v_vote_id;
end;
$$;

grant execute on function public.change_vote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Turnout's denominator is the voters who may actually vote here, so a
--    gender-restricted election no longer looks like mass abstention.
-- ---------------------------------------------------------------------------
create or replace function public.get_election_turnout(p_election_id uuid)
returns table (voted bigint, eligible bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  return query
    select
      (select count(*)::bigint from public.votes v where v.election_id = p_election_id),
      (select count(*)::bigint
         from public.profiles p
         join public.elections e on e.id = p_election_id
        where p.role = 'student'
          and p.student_id is not null
          and (e.eligible_gender = 'any' or p.gender = e.eligible_gender));
end;
$$;

grant execute on function public.get_election_turnout(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Teach the audit recorder about the two new columns, so an eligibility
--    change or a corrected gender lands in the log like every other edit.
--    (Full function, mirroring migration 016 with the two field lists widened.)
-- ---------------------------------------------------------------------------
create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_old         jsonb;
  v_new         jsonb;
  v_row         jsonb;
  v_fields      text[];
  v_field       text;
  v_actor       uuid := auth.uid();
  v_actor_label text;
  v_entity      text;
  v_verb        text;
  v_label       text;
  v_details     jsonb := '{}'::jsonb;
begin
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_row := coalesce(v_new, v_old);

  case tg_table_name
    when 'profiles' then
      v_entity := 'voter';
      v_label  := coalesce(v_row ->> 'student_id', v_row ->> 'full_name', v_row ->> 'id');
      v_fields := array['student_id', 'class_name', 'role', 'gender'];
    when 'classes' then
      v_entity := 'class';
      v_label  := coalesce(v_row ->> 'name', v_row ->> 'id');
      v_fields := array['name', 'position'];
    when 'elections' then
      v_entity := 'election';
      v_label  := coalesce(v_row ->> 'title', v_row ->> 'id');
      v_fields := array['title', 'position', 'status', 'results_public', 'description', 'eligible_gender'];
    when 'candidates' then
      v_entity := 'candidate';
      v_label  := coalesce(v_row ->> 'name', v_row ->> 'id');
      v_fields := array['name', 'class_name', 'slogan', 'manifesto', 'photo_url', 'sort_order'];
    else
      v_entity := tg_table_name;
      v_label  := 'unknown';
      v_fields := '{}'::text[];
  end case;

  if tg_op = 'UPDATE' then
    foreach v_field in array v_fields loop
      if (v_new -> v_field) is distinct from (v_old -> v_field) then
        v_details := v_details || jsonb_build_object(
          v_field,
          jsonb_build_object('from', v_old -> v_field, 'to', v_new -> v_field)
        );
      end if;
    end loop;

    if v_details = '{}'::jsonb then
      return null;
    end if;
  elsif tg_op = 'DELETE' then
    v_details := jsonb_build_object('removed', v_old);
  end if;

  v_verb := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;

  if v_actor is null then
    v_actor_label := 'system';
  else
    select coalesce(p.student_id, p.full_name, p.role, 'account')
      into v_actor_label
      from public.profiles p
     where p.id = v_actor;
    v_actor_label := coalesce(v_actor_label, 'account');
  end if;

  insert into public.audit_log (actor_id, actor_label, action, entity, entity_id, label, details)
  values (
    v_actor,
    v_actor_label,
    v_entity || '.' || v_verb,
    v_entity,
    v_row ->> 'id',
    coalesce(v_label, 'unknown'),
    case when v_details = '{}'::jsonb then null else v_details end
  );

  return null;
end;
$fn$;
