-- ============================================================================
-- BallotBox — Migration 005: officer-managed voter accounts.
--
-- Students no longer self-register. An Electoral Officer adds each voter with
-- their index number (the login name) and class (the initial password).
--
-- Supabase Auth still needs an email, so we derive a deterministic one from the
-- index number:
--     SHS/2026/0148   ->   shs-2026-0148@voters.ballotbox.edu
--
-- The same rule is mirrored in the front-end at src/lib/voterAuth.ts — keep the
-- two in step or students will not be able to sign in.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Deterministic login email for a voter index number
-- ---------------------------------------------------------------------------
create or replace function public.voter_email(p_index_number text)
returns text
language sql
immutable
as $$
  select trim(
           both '-' from regexp_replace(lower(trim(coalesce(p_index_number, ''))), '[^a-z0-9]+', '-', 'g')
         ) || '@voters.ballotbox.edu';
$$;

-- ---------------------------------------------------------------------------
-- Create a voter account (Electoral Officers only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_voter(
  p_index_number text,
  p_class_name   text,
  p_full_name    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_index   text := trim(coalesce(p_index_number, ''));
  v_class   text := trim(coalesce(p_class_name, ''));
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

  -- handle_new_user() has already written the matching public.profiles row.
  return v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Remove a voter account (Electoral Officers only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_voter(p_voter_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can remove voters';
  end if;

  if exists (select 1 from public.profiles p where p.id = p_voter_id and p.role = 'admin') then
    raise exception 'Officer accounts cannot be removed from here';
  end if;

  delete from public.votes    where voter_id = p_voter_id;
  delete from auth.identities where user_id  = p_voter_id;
  delete from auth.users      where id       = p_voter_id;
  delete from public.profiles where id       = p_voter_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Students must not be able to browse the whole voter register.
-- They only ever need their own profile; officers keep full visibility.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

grant execute on function public.voter_email(text) to authenticated;
grant execute on function public.admin_create_voter(text, text, text) to authenticated;
grant execute on function public.admin_delete_voter(uuid) to authenticated;
