-- ============================================================================
-- OFKOSSEC — Migration 013: manage the class list, and clear a class in one go.
--
-- The class name doubles as the student's password, so the list of classes can
-- no longer live only in the front-end (src/lib/constants.ts): renaming a class
-- has to move its students and re-hash their logins in the same transaction.
-- public.classes is that list. It is readable without signing in, because the
-- student sign-in page offers it as a dropdown before anybody has a session.
--
-- Renaming is deliberately loud: every student in the class starts signing in
-- with the new name the moment this commits, which is why the officer console
-- asks for confirmation first.
--
-- Officers can also empty a class in one call instead of removing its students
-- one at a time. That reuses the cleanup rules from migration 012: receipts and
-- pointers go, the anonymous ballots in public.votes stay, because they carry
-- no voter_id and so cannot be traced back to anybody.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The class list.
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;

drop policy if exists classes_select_public on public.classes;
create policy classes_select_public on public.classes
  for select to anon, authenticated using (true);

grant select on public.classes to anon, authenticated;
revoke insert, update, delete on public.classes from anon, authenticated;

-- Seed the list the front-end shipped with, so nothing changes for schools that
-- have not touched it. Only runs on an empty table.
do $$
begin
  if not exists (select 1 from public.classes) then
    insert into public.classes (name, position)
    values
      ('3A1',  1), ('3A2',  2), ('3A3',  3), ('3A4',  4),
      ('3B',   5), ('3C1',  6), ('3C2',  7), ('3GS',  8),
      ('3V',   9), ('2A1', 10), ('2A2', 11), ('2A3', 12),
      ('2A4', 13), ('2B',  14), ('2C1', 15), ('2C2', 16),
      ('2GS', 17), ('2V',  18);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Add a class.
-- ---------------------------------------------------------------------------
create or replace function public.admin_add_class(p_name text)
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
    raise exception 'Only Electoral Officers can manage classes';
  end if;

  if v_name = '' then
    raise exception 'A class name is required';
  end if;

  if char_length(v_name) > 40 then
    raise exception 'A class name cannot be longer than 40 characters';
  end if;

  if exists (select 1 from public.classes c where lower(c.name) = lower(v_name)) then
    raise exception 'Class % already exists', v_name using errcode = 'unique_violation';
  end if;

  insert into public.classes (name, position)
  values (v_name, coalesce((select max(c.position) from public.classes c), 0) + 1)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Rename a class everywhere: the list, its students, their login password
--    and any candidate whose class it is. Returns how many students moved.
-- ---------------------------------------------------------------------------
create or replace function public.admin_rename_class(p_old_name text, p_new_name text)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old text := trim(coalesce(p_old_name, ''));
  v_new text := trim(coalesce(p_new_name, ''));
  v_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can manage classes';
  end if;

  if not exists (select 1 from public.classes c where lower(c.name) = lower(v_old)) then
    raise exception 'There is no class named %', v_old;
  end if;

  if v_new = '' then
    raise exception 'A class name is required';
  end if;

  if char_length(v_new) > 40 then
    raise exception 'A class name cannot be longer than 40 characters';
  end if;

  if lower(v_new) <> lower(v_old)
     and exists (select 1 from public.classes c where lower(c.name) = lower(v_new)) then
    raise exception 'Class % already exists', v_new using errcode = 'unique_violation';
  end if;

  select coalesce(array_agg(p.id), '{}'::uuid[]) into v_ids
  from public.profiles p
  where p.role = 'student' and lower(p.class_name) = lower(v_old);

  update public.classes set name = v_new where lower(name) = lower(v_old);

  if array_length(v_ids, 1) is not null then
    update public.profiles set class_name = v_new where id = any(v_ids);

    -- The class is the password, so the stored hash has to follow the rename or
    -- these students cannot sign in again.
    update auth.users u
    set encrypted_password = crypt(v_new, gen_salt('bf')),
        raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
                               || jsonb_build_object('class_name', v_new),
        updated_at         = now()
    where u.id = any(v_ids);
  end if;

  -- Candidates carry their own class for display; keep it pointing at a class
  -- that still exists.
  update public.candidates set class_name = v_new where lower(class_name) = lower(v_old);

  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Remove a class from the list. Only once nobody is in it.
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_class(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can manage classes';
  end if;

  if not exists (select 1 from public.classes c where lower(c.name) = lower(v_name)) then
    raise exception 'There is no class named %', v_name;
  end if;

  if exists (
    select 1 from public.profiles p
    where p.role = 'student' and lower(p.class_name) = lower(v_name)
  ) then
    raise exception 'Voters are still in class %. Remove them first', v_name;
  end if;

  delete from public.classes where lower(name) = lower(v_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Empty a whole class in one call. Returns how many voters were removed.
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_voters_by_class(p_class_name text)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_class text := trim(coalesce(p_class_name, ''));
  v_ids   uuid[];
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can remove voters';
  end if;

  if v_class = '' then
    raise exception 'A class is required';
  end if;

  select coalesce(array_agg(p.id), '{}'::uuid[]) into v_ids
  from public.profiles p
  where p.role = 'student' and lower(p.class_name) = lower(v_class);

  if array_length(v_ids, 1) is null then
    return 0;
  end if;

  -- Officer accounts are never in a student class, so there is no role check to
  -- make here beyond the filter above. Ballots in public.votes are anonymous
  -- and stay where they are, exactly as in admin_delete_voter.
  delete from public.ballot_pointers where voter_id = any(v_ids);
  delete from public.ballot_receipts where voter_id = any(v_ids);
  delete from auth.identities      where user_id  = any(v_ids);
  delete from auth.users           where id       = any(v_ids);
  delete from public.profiles      where id       = any(v_ids);

  return array_length(v_ids, 1);
end;
$$;

grant execute on function public.admin_add_class(text)                   to authenticated;
grant execute on function public.admin_rename_class(text, text)           to authenticated;
grant execute on function public.admin_delete_class(text)                 to authenticated;
grant execute on function public.admin_delete_voters_by_class(text)       to authenticated;
