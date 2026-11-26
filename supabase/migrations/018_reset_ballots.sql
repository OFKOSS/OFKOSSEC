-- ============================================================================
-- OFKOSSEC — Migration 018: clear the ballots cast in a rehearsal.
--
-- Officers run the whole election through once to prove the register, the
-- ballots and the counting all work, then need to start again for real. Until
-- now the only way was to delete the election and rebuild it, which also threw
-- away its candidates.
--
-- A reset clears three things and nothing else:
--
--   public.ballot_receipts  — that somebody voted (what stops a second ballot)
--   public.votes            — the ballots themselves (what the tally counts)
--   public.ballot_pointers  — the link that lets a voter change their mind
--
-- The elections, their candidates and the voter register are untouched, so a
-- reset election is open to vote in again straight away.
--
-- Both functions are officer-only and SECURITY DEFINER, because no browser role
-- may delete from those three tables (migrations 011 and 012). Every reset is
-- written to the audit trail: "who cleared the ballots" is exactly the question
-- the log exists to answer.
--
-- Requires migration 016: every reset writes a row to public.audit_log, so with
-- that table missing the whole reset is refused rather than clearing ballots
-- quietly.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The officer's name for the audit row, matching public.record_audit().
-- ---------------------------------------------------------------------------
create or replace function public.audit_actor_label()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select coalesce(p.student_id, p.full_name, p.role, 'account')
       from public.profiles p
      where p.id = auth.uid()),
    'account'
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. Reset one election. Returns how many ballots were cleared.
-- ---------------------------------------------------------------------------
create or replace function public.admin_reset_election_ballots(p_election_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title   text;
  v_cleared integer;
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can reset ballots';
  end if;

  select e.title into v_title
  from public.elections e
  where e.id = p_election_id;

  if v_title is null then
    raise exception 'Election not found';
  end if;

  select count(*)::integer into v_cleared
  from public.ballot_receipts r
  where r.election_id = p_election_id;

  delete from public.ballot_pointers where election_id = p_election_id;
  delete from public.ballot_receipts where election_id = p_election_id;
  delete from public.votes           where election_id = p_election_id;

  insert into public.audit_log (actor_id, actor_label, action, entity, entity_id, label, details)
  values (
    auth.uid(),
    public.audit_actor_label(),
    'election.reset',
    'election',
    p_election_id::text,
    v_title,
    jsonb_build_object('ballots_cleared', v_cleared)
  );

  return v_cleared;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Reset every election at once, for the night before the real poll. Returns
--    the total number of ballots cleared.
-- ---------------------------------------------------------------------------
create or replace function public.admin_reset_all_ballots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election record;
  v_total    integer := 0;
  v_swept    integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only Electoral Officers can reset ballots';
  end if;

  -- One call per election so the trail names each contest and keeps its own
  -- count. Every row shares a created_at (now() is fixed per transaction), so
  -- the audit viewer still collapses the whole sweep into a single line.
  for v_election in
    select e.id
    from public.elections e
    where exists (select 1 from public.ballot_receipts r where r.election_id = e.id)
    order by e.created_at
  loop
    v_total := v_total + public.admin_reset_election_ballots(v_election.id);
  end loop;

  -- Ballots left behind by an election that has since been deleted are keyed to
  -- an election that is no longer in the loop above, so sweep them separately —
  -- scoped by the election each row names, which is also the WHERE clause this
  -- database insists on for every delete.
  delete from public.ballot_pointers p
   where not exists (select 1 from public.elections e where e.id = p.election_id);
  delete from public.ballot_receipts r
   where not exists (select 1 from public.elections e where e.id = r.election_id);
  get diagnostics v_swept = row_count;
  delete from public.votes v
   where not exists (select 1 from public.elections e where e.id = v.election_id);

  -- Those swept ballots belong to no election, so no line in the loop above
  -- could name them. Record them on their own line — otherwise the count handed
  -- back to the officer would not add up against the trail, and "who cleared
  -- those ballots" would have no answer. Same created_at as the rest of the
  -- sweep, so the viewer still folds it into the one event.
  if v_swept > 0 then
    insert into public.audit_log (actor_id, actor_label, action, entity, entity_id, label, details)
    values (
      auth.uid(),
      public.audit_actor_label(),
      'election.reset',
      'election',
      null,
      'Ballots left by deleted elections',
      jsonb_build_object('ballots_cleared', v_swept, 'orphaned', true)
    );
  end if;

  return v_total + v_swept;
end;
$$;

grant execute on function public.audit_actor_label()                    to authenticated;
grant execute on function public.admin_reset_election_ballots(uuid)     to authenticated;
grant execute on function public.admin_reset_all_ballots()              to authenticated;
