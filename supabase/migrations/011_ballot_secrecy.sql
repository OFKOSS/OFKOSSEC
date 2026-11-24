-- ============================================================================
-- OFKOSSEC — Migration 011: make ballots anonymous.
--
-- Until now public.votes carried voter_id, so the ballot box itself recorded
-- who voted for whom and the site's "ballots are never linked back to your
-- name" promise was not true at the database level.
--
-- This splits the two concerns:
--
--   public.ballot_receipts  — that a voter has voted (election_id + voter_id)
--   public.votes            — what was voted for, with no voter on the row
--
-- The receipt is what still makes double voting impossible; it says nothing
-- about the choice. Ballots are written only through public.cast_vote(), which
-- records the receipt and the ballot in one transaction.
--
-- Idempotent: safe to run more than once. Existing ballots keep their effect:
-- a receipt is backfilled for every vote already cast before the column goes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Receipts: proof of having voted, with no link to the choice.
-- ---------------------------------------------------------------------------
create table if not exists public.ballot_receipts (
  election_id uuid not null,
  voter_id    uuid not null,
  created_at  timestamptz not null default now(),
  primary key (election_id, voter_id)
);

alter table public.ballot_receipts enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Backfill the receipts implied by the ballots already cast, so nobody who
--    voted has to vote again.
-- ---------------------------------------------------------------------------
insert into public.ballot_receipts (election_id, voter_id, created_at)
select election_id, voter_id, created_at
from public.votes
where voter_id is not null
on conflict (election_id, voter_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Cut the link from the ballot itself.
-- ---------------------------------------------------------------------------
drop policy if exists votes_select on public.votes;
drop policy if exists votes_insert on public.votes;
alter table public.votes drop constraint if exists votes_one_per_election;
drop index if exists public.votes_voter_idx;
alter table public.votes drop column if exists voter_id;

-- ---------------------------------------------------------------------------
-- 4. Votes are anonymous now, so officers may read them (for counts) and
--    students may not read them at all. Nothing writes to them directly.
-- ---------------------------------------------------------------------------
drop policy if exists votes_select_admin on public.votes;
create policy votes_select_admin on public.votes
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.votes from authenticated;
grant select on public.votes to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Receipts: a voter sees only their own, officers see every one. Nobody
--    writes to the table directly.
-- ---------------------------------------------------------------------------
drop policy if exists ballot_receipts_select on public.ballot_receipts;
create policy ballot_receipts_select on public.ballot_receipts
  for select to authenticated using (voter_id = auth.uid() or public.is_admin());

grant select on public.ballot_receipts to authenticated;
revoke insert, update, delete on public.ballot_receipts from authenticated;

-- ---------------------------------------------------------------------------
-- 6. The only way to vote. A repeat voter trips the receipt's primary key and
--    the whole transaction — receipt and ballot — rolls back.
-- ---------------------------------------------------------------------------
create or replace function public.cast_vote(p_election_id uuid, p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter uuid := auth.uid();
begin
  if v_voter is null then
    raise exception 'You must be signed in to vote';
  end if;

  if not exists (
    select 1 from public.elections e
    where e.id = p_election_id and e.status = 'active'
  ) then
    raise exception 'This election is not open for voting';
  end if;

  if not exists (
    select 1 from public.candidates c
    where c.id = p_candidate_id and c.election_id = p_election_id
  ) then
    raise exception 'That candidate is not on this ballot';
  end if;

  insert into public.ballot_receipts (election_id, voter_id)
  values (p_election_id, v_voter);

  insert into public.votes (election_id, candidate_id)
  values (p_election_id, p_candidate_id);
end;
$$;

grant execute on function public.cast_vote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Removing a voter clears their receipt, never their anonymous ballot.
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

  delete from public.ballot_receipts where voter_id = p_voter_id;
  delete from auth.identities      where user_id  = p_voter_id;
  delete from auth.users           where id       = p_voter_id;
  delete from public.profiles      where id       = p_voter_id;
end;
$$;
