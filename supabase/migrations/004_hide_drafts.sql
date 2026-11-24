-- ============================================================================
-- BallotBox — Migration 004: keep drafts away from students.
--
-- Migration 001 granted every authenticated user blanket SELECT on elections
-- and candidates, which meant a signed-in student could list and open draft
-- elections before they were announced. This narrows the authenticated read
-- path: students see only live or closed elections, while Electoral Officers
-- keep full visibility so the panel can show drafts.
-- ============================================================================

drop policy if exists elections_select on public.elections;
create policy elections_select on public.elections
  for select to authenticated
  using (status in ('active', 'closed') or public.is_admin());

drop policy if exists candidates_select on public.candidates;
create policy candidates_select on public.candidates
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.elections e
      where e.id = candidates.election_id
        and e.status in ('active', 'closed')
    )
  );
