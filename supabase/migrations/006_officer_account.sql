-- ============================================================================
-- BallotBox — Migration 006: the school's single Electoral Officer account.
--
-- Removes the old demonstration officer (officer@ballotbox.edu) and installs
-- the one officer login the school actually uses:
--
--   Username: SO7
--   Password: never committed — see below.
--
-- Supabase Auth signs in with an email, so the username is mapped to a
-- deterministic address the same way voters' index numbers are:
--
--   SO7  ->  so7@officers.ballotbox.edu
--
-- Kept in step with src/lib/voterAuth.ts (officerEmailFromUsername).
--
-- This file used to carry the officer password in plain text. Because the
-- repository is public, anybody who read it could sign in as an Electoral
-- Officer, so the account has been rotated and the password is deliberately
-- no longer stored here. It is still recoverable from the git history, which is
-- why a strong replacement is required rather than the old value.
--
-- A fresh account is therefore created on an unguessable random password: the
-- address exists but cannot be signed into until an operator sets a real one.
-- Set it in the Supabase SQL editor:
--
--   update auth.users
--      set encrypted_password = crypt('<the new password>', gen_salt('bf')),
--          updated_at         = now()
--    where id = (select id from auth.users
--                 where lower(email) = 'so7@officers.ballotbox.edu');
--
-- Idempotent: re-running never touches an existing password, so it cannot undo
-- a rotation.
-- ============================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_old_id  uuid;
  v_user_id uuid;
  v_email   text := 'so7@officers.ballotbox.edu';
  v_name    text := 'SO7';
begin
  perform set_config('search_path', 'public, extensions', true);

  -- ---------------------------------------------------------------------
  -- 1. Retire the demonstration officer account.
  -- ---------------------------------------------------------------------
  select id into v_old_id from auth.users where lower(email) = 'officer@ballotbox.edu';

  if v_old_id is not null then
    update public.elections set created_by = null where created_by = v_old_id;
    delete from public.votes     where voter_id = v_old_id;
    delete from auth.identities  where user_id  = v_old_id;
    delete from auth.users       where id       = v_old_id;
    delete from public.profiles  where id       = v_old_id;
  end if;

  -- ---------------------------------------------------------------------
  -- 2. Create (or refresh) the SO7 officer account.
  -- ---------------------------------------------------------------------
  select id into v_user_id from auth.users where lower(email) = v_email;

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
      -- Random, unguessable, and not written down anywhere: unusable until an
      -- operator sets a real password with the statement at the top of the file.
      crypt(gen_random_uuid()::text, gen_salt('bf')),
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
  else
    -- Deliberately not resetting encrypted_password: re-running the migrations
    -- must never overwrite a password that has been rotated into place.
    update auth.users
       set email_confirmed_at = now(),
           updated_at         = now()
     where id = v_user_id;
  end if;

  -- Point anything the old officer created at the new account.
  if v_old_id is not null then
    update public.elections set created_by = v_user_id where created_by = v_old_id;
  end if;

  -- The sign-up trigger writes a student profile; promote it to admin.
  insert into public.profiles (id, full_name, student_id, class_name, role)
  values (v_user_id, v_name, null, 'Administration', 'admin')
  on conflict (id) do update
    set role       = 'admin',
        full_name  = excluded.full_name,
        class_name = excluded.class_name;
end $$;
