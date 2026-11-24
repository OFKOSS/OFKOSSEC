-- ============================================================================
-- BallotBox — Migration 002: seed the Electoral Officer (admin) account.
--
--   Email:    officer@ballotbox.edu
--   Password: Officer2026!
--
-- idempotent: running this twice will not create duplicate accounts.
-- Change the password after the first sign-in.
-- ============================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid;
  v_email   text := 'officer@ballotbox.edu';
  v_pass    text := 'Officer2026!';
  v_name    text := 'Electoral Officer';
begin
  -- Resolve crypt()/gen_salt() regardless of which schema pgcrypto lives in.
  perform set_config('search_path', 'public, extensions', true);

  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

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
      crypt(v_pass, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
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
  end if;

  -- The sign-up trigger already created a student profile; promote it.
  insert into public.profiles (id, full_name, student_id, class_name, role)
  values (v_user_id, v_name, null, 'Administration', 'admin')
  on conflict (id) do update
    set role       = 'admin',
        full_name  = excluded.full_name,
        class_name = excluded.class_name;
end $$;
