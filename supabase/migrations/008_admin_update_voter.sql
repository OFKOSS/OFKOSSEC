-- ============================================================================
-- OFKOSSEC — Migration 008: officers can edit a voter's details.
--
-- Corrects a mistyped index number, moves a student to another class, or fixes
-- a name. The class is the password, so changing it re-hashes the login.
--
-- The email derivation must stay byte-for-byte in step with public.voter_email()
-- and src/lib/voterAuth.ts.
-- ============================================================================

create or replace function public.admin_update_voter(
  p_voter_id     uuid,
  p_index_number text,
  p_class_name   text,
  p_full_name    text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_index   text := trim(coalesce(p_index_number, ''));
  v_class   text := trim(coalesce(p_class_name, ''));
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
      full_name  = v_name
  where p.id = p_voter_id;
end;
$$;

grant execute on function public.admin_update_voter(uuid, text, text, text) to authenticated;
