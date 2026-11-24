-- ============================================================================
-- BallotBox — Migration 003: public (signed-out) read access.
--
-- Visitors who are not signed in may read published elections and candidate
-- profiles so the landing page can show what is currently being voted on.
-- Drafts stay hidden, and no write path is opened to anon.
-- ============================================================================

drop policy if exists elections_select_public on public.elections;
create policy elections_select_public on public.elections
  for select to anon using (status in ('active', 'closed'));

drop policy if exists candidates_select_public on public.candidates;
create policy candidates_select_public on public.candidates
  for select to anon using (
    exists (
      select 1 from public.elections e
      where e.id = candidates.election_id
        and e.status in ('active', 'closed')
    )
  );
