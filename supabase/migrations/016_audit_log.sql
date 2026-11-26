-- ============================================================================
-- OFKOSSEC — Migration 016: an audit trail for officer actions.
--
-- Nothing has recorded that the register, the class list or the elections were
-- changed, or by whom. After an election that is the first question anyone
-- asks, and the tables cannot answer it: they show only their current state,
-- with no history of who removed forty voters, or when a class was renamed.
--
-- Logging lives in a trigger rather than inside the RPCs. Officers write to
-- public.elections and public.candidates directly from the browser (NewElection,
-- EditElection, AdminResults and CandidateManager all call .insert()/.update()/
-- .delete() on those tables), so logging in the admin_* functions would have
-- missed most of what happens, and the next feature that writes to a table
-- would have to remember to log by hand. A trigger cannot be forgotten.
--
-- Design notes:
--   * No foreign keys, and actor names stored as text. The log must outlive the
--     rows it describes: "voter 0142 was removed" has to survive that voter
--     being removed, and an ON DELETE CASCADE would erase the one record that
--     matters. Names are copied for the same reason.
--   * Rows are inserted by a security definer function, so a browser cannot
--     forge or suppress an entry. Officers can read the table and nothing else;
--     insert is not granted to anyone.
--   * now() is fixed at transaction start, so every row written by one action
--     carries an identical created_at. That is what lets the viewer collapse a
--     bulk operation — a class rename touching thirty voters — back into a
--     single line instead of thirty.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.audit_log (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid,
  actor_label text not null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  label       text not null,
  details     jsonb
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Read-only surface for the API. Nobody writes through PostgREST: the rows come
-- from record_audit(), which runs as the table owner and bypasses RLS.
revoke insert, update, delete on public.audit_log from anon, authenticated;
grant  select on public.audit_log to authenticated;

drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- The recorder, attached to every table an officer can change.
-- ----------------------------------------------------------------------------
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

  -- What changed, how to name one row of it in a sentence, and which columns
  -- are worth reporting. Columns that do not exist on a table are simply never
  -- matched, so this stays harmless if a column is renamed later.
  case tg_table_name
    when 'profiles' then
      v_entity := 'voter';
      v_label  := coalesce(v_row ->> 'student_id', v_row ->> 'full_name', v_row ->> 'id');
      v_fields := array['student_id', 'class_name', 'role'];
    when 'classes' then
      v_entity := 'class';
      v_label  := coalesce(v_row ->> 'name', v_row ->> 'id');
      v_fields := array['name', 'position'];
    when 'elections' then
      v_entity := 'election';
      v_label  := coalesce(v_row ->> 'title', v_row ->> 'id');
      v_fields := array['title', 'position', 'status', 'results_public', 'description'];
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

    -- Something outside the watched columns changed: an avatar, a photo, a
    -- slogan. Real, but not an officer action that belongs in this log.
    if v_details = '{}'::jsonb then
      return null;
    end if;
  elsif tg_op = 'DELETE' then
    -- Keep the row that went away. "Who removed voter 0142" is a poor answer
    -- next to what that voter actually was.
    v_details := jsonb_build_object('removed', v_old);
  end if;

  v_verb := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;

  if v_actor is null then
    -- No session behind the change: a migration, the SQL editor, or the
    -- self-service sign-up trigger. Worth seeing rather than hiding.
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

  -- AFTER trigger: the return value is discarded.
  return null;
end;
$fn$;

-- ----------------------------------------------------------------------------
-- Attach it. Dropped first so re-running does not duplicate the triggers.
-- ----------------------------------------------------------------------------
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.record_audit();

drop trigger if exists audit_classes on public.classes;
create trigger audit_classes
  after insert or update or delete on public.classes
  for each row execute function public.record_audit();

drop trigger if exists audit_elections on public.elections;
create trigger audit_elections
  after insert or update or delete on public.elections
  for each row execute function public.record_audit();

drop trigger if exists audit_candidates on public.candidates;
create trigger audit_candidates
  after insert or update or delete on public.candidates
  for each row execute function public.record_audit();
