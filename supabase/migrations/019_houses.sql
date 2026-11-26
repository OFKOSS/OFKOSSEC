-- ============================================================================
-- OFKOSSEC — Migration 019: some ballots are open to one house only.
--
-- Migration 017 let a ballot be restricted to one gender. Schaefer posts work
-- the same way: a house prefect or a house captain is chosen by the students in
-- that house and by nobody else. This migration adds that as a second rule,
-- written and enforced exactly like the gender rule so the two behave alike.
--
-- Three pieces carry it:
--   * public.houses                  — the officer's list of houses. Seeded with
--                                      four placeholders to rename. Mirrors
--                                      public.classes from migration 013.
--   * public.profiles.house          — which house a student belongs to, set by
--                                      the officer console. Nullable, because a
--                                      register imported before this migration
--                                      has no house yet.
--   * public.elections.eligible_house — null means every house may vote, which
--                                      is the unchanged behaviour. A name means
--                                      that house only.
--
-- The rule is enforced inside cast_vote() and change_vote(), beside the gender
-- gate, so the database is what actually stops a ballot — editing the page
-- cannot get around it. The browser is told who may vote only so it can explain
-- itself.
--
-- A voter with no house on the register is ineligible for a house-restricted
-- election, never a wildcard — the same reasoning as migration 017. Guessing
-- would hand a restricted ballot to anyone the officer had not classified.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The house list.
-- ---------------------------------------------------------------------------
create table if not exists public.houses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.houses enable row level security;

drop policy if exists houses_select_public on public.houses;
create policy houses_select_public on public.houses
  for select to anon, authenticated using (true);

grant select on public.houses to anon, authenticated;
revoke insert, update, delete on public.houses from anon, authenticated;

-- Placeholders for the officer to rename in the voter register. Only runs on an
-- empty table, so renaming them is never undone by re-running this migration.
do $$
begin
  if not exists (select 1 from public.houses) then
    insert into public.houses (name, position)
    values ('House 1', 1), ('House 2', 2), ('House 3', 3), ('House 4', 4);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The two new columns.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists house text;

alter table public.profiles
  drop constraint if exists profiles_house_check;
alter table public.profiles
  add constraint profiles_house_check
  check (house is null or char_length(house) between 1 and 40);

alter table public.elections
  add column if not exists eligible_house text;

alter table public.elections
  drop constraint if exists elections_eligible_house_check;
alter table public.elections
  add constraint elections_eligible_house_check
  check (eligible_house is null or char_length(eligible_house) between 1 and 40);

-- ---------------------------------------------------------------------------
-- 3. Does the caller's house satisfy the election's rule?
--    True when the election is open to every house, or when the caller's
--    recorded house matches. False for an unknown house on a restricted
--    election.
-- ---------------------------------------------------------------------------
create or replace function public.voter_meets_house_rule(p_election_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select e.eligible_house is null or p.house = e.eligible_house
    from public.elections e
    join public.profiles p on p.id = auth.uid()
    where e.id = p_election_id
  ), false);
$$;

grant execute on function public.voter_meets_house_rule(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Manage the house list. Renaming moves the students in it and the elections
--    restricted to it, because the name is what both of those point at.
-- ---------------------------------------------------------------------------
create or replace function public.admin_add_house(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_id   uuid;
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can manage houses';
  end if;

  if v_name = '' then
    raise exception 'A house name is required';
  end if;

  if char_length(v_name) > 40 then
    raise exception 'A house name cannot be longer than 40 characters';
  end if;

  if exists (select 1 from public.houses h where lower(h.name) = lower(v_name)) then
    raise exception 'House % already exists', v_name using errcode = 'unique_violation';
  end if;

  insert into public.houses (name, position)
  values (v_name, coalesce((select max(h.position) from public.houses h), 0) + 1)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_rename_house(p_old_name text, p_new_name text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old   text := trim(coalesce(p_old_name, ''));
  v_new   text := trim(coalesce(p_new_name, ''));
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can manage houses';
  end if;

  if not exists (select 1 from public.houses h where lower(h.name) = lower(v_old)) then
    raise exception 'There is no house named %', v_old;
  end if;

  if v_new = '' then
    raise exception 'A house name is required';
  end if;

  if char_length(v_new) > 40 then
    raise exception 'A house name cannot be longer than 40 characters';
  end if;

  if lower(v_new) <> lower(v_old)
     and exists (select 1 from public.houses h where lower(h.name) = lower(v_new)) then
    raise exception 'House % already exists', v_new using errcode = 'unique_violation';
  end if;

  update public.houses set name = v_new where lower(name) = lower(v_old);

  update public.profiles p
  set house = v_new
  where p.role = 'student' and lower(p.house) = lower(v_old);
  get diagnostics v_count = row_count;

  -- An election restricted to this house points at it by name. Left behind, the
  -- restriction would name a house nobody belongs to and lock the ballot to
  -- everyone.
  update public.elections
  set eligible_house = v_new
  where lower(eligible_house) = lower(v_old);

  return v_count;
end;
$$;

create or replace function public.admin_delete_house(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can manage houses';
  end if;

  if not exists (select 1 from public.houses h where lower(h.name) = lower(v_name)) then
    raise exception 'There is no house named %', v_name;
  end if;

  if exists (
    select 1 from public.profiles p
    where p.role = 'student' and lower(p.house) = lower(v_name)
  ) then
    raise exception 'Voters are still in %. Move them first', v_name;
  end if;

  if exists (select 1 from public.elections e where lower(e.eligible_house) = lower(v_name)) then
    raise exception 'An election is still open to %. Change it first', v_name;
  end if;

  delete from public.houses where lower(name) = lower(v_name);
end;
$$;

grant execute on function public.admin_add_house(text)                    to authenticated;
grant execute on function public.admin_rename_house(text, text)           to authenticated;
grant execute on function public.admin_delete_house(text)                 to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Officer console: record a voter's house.
--    The parameter is appended, so the old four-argument functions are dropped
--    first — leaving both in place would make the PostgREST overloads
--    ambiguous. Grants are re-issued below.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_create_voter(text, text, text, text);
drop function if exists public.admin_update_voter(uuid, text, text, text);

create or replace function public.admin_create_voter(
  p_index_number text,
  p_class_name   text,
  p_full_name    text default null,
  p_gender       text default null,
  p_house        text default null
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
  v_house   text := nullif(trim(coalesce(p_house, '')), '');
  v_asked   text := v_house;
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

  -- The house list is the officer's, so a house has to be on it. The stored
  -- name is the list's own spelling, so "house 1" and "House 1" do not become
  -- two houses.
  if v_house is not null then
    select h.name into v_house from public.houses h where lower(h.name) = lower(v_house);
    if v_house is null then
      raise exception 'There is no house named % on the house list', v_asked;
    end if;
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
  -- gender and house are not part of that trigger, so they are set here.
  update public.profiles set gender = v_gender, house = v_house where id = v_user_id;

  return v_user_id;
end;
$$;

create or replace function public.admin_update_voter(
  p_voter_id     uuid,
  p_index_number text,
  p_class_name   text,
  p_full_name    text default null,
  p_gender       text default null,
  p_house        text default null
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
  v_house   text := nullif(trim(coalesce(p_house, '')), '');
  v_asked   text := v_house;
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

  if v_house is not null then
    select h.name into v_house from public.houses h where lower(h.name) = lower(v_house);
    if v_house is null then
      raise exception 'There is no house named % on the house list', v_asked;
    end if;
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
      gender     = v_gender,
      house      = v_house
  where p.id = p_voter_id;
end;
$$;

grant execute on function public.admin_create_voter(text, text, text, text, text) to authenticated;
grant execute on function public.admin_update_voter(uuid, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Casting a ballot now also has to satisfy the house rule.
--    Same gate as migration 017, with the house check beside the gender one.
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

  if not public.voter_meets_house_rule(p_election_id) then
    raise exception 'This ballot is open to % only', (
      select e.eligible_house from public.elections e where e.id = p_election_id
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

  if not public.voter_meets_house_rule(p_election_id) then
    raise exception 'This ballot is open to % only', (
      select e.eligible_house from public.elections e where e.id = p_election_id
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
-- 7. Turnout's denominator is the voters who may actually vote here, so a
--    house-restricted election no longer looks like mass abstention.
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
          and (e.eligible_gender = 'any' or p.gender = e.eligible_gender)
          and (e.eligible_house is null or p.house = e.eligible_house));
end;
$$;

grant execute on function public.get_election_turnout(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Teach the audit recorder about the new columns, so an eligibility change
--    or a corrected house lands in the log like every other edit, and about the
--    house list itself. (Full function, mirroring migration 017 with the two
--    field lists widened and a houses branch added.)
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
      v_fields := array['student_id', 'class_name', 'role', 'gender', 'house'];
    when 'classes' then
      v_entity := 'class';
      v_label  := coalesce(v_row ->> 'name', v_row ->> 'id');
      v_fields := array['name', 'position'];
    when 'houses' then
      v_entity := 'house';
      v_label  := coalesce(v_row ->> 'name', v_row ->> 'id');
      v_fields := array['name', 'position'];
    when 'elections' then
      v_entity := 'election';
      v_label  := coalesce(v_row ->> 'title', v_row ->> 'id');
      v_fields := array[
        'title', 'position', 'status', 'results_public', 'description',
        'eligible_gender', 'eligible_house'
      ];
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

drop trigger if exists audit_houses on public.houses;
create trigger audit_houses
  after insert or update or delete on public.houses
  for each row execute function public.record_audit();
