-- ============================================================================
-- OFKOSSEC — Migration 012: let a voter change their mind while polls are open.
--
-- A student who has already voted may replace their ballot until the election
-- closes. That needs the database to be able to find their ballot again, which
-- migration 011 was built to make impossible, so the link is kept as narrow as
-- it can be:
--
--   public.ballot_pointers  — election_id + voter_id -> the id of the ballot
--
-- Readable only by the voter the row belongs to. Officers have no access to it
-- at all, so the officer console still cannot tell who voted for whom. When an
-- election closes, a trigger deletes that election's pointers, so once the
-- ballots are counted there is no row anywhere connecting a ballot to a name.
--
-- Turnout is untouched by all of this: it is counted from the receipts, which
-- carry no ballot.
--
-- Ballots cast before this migration cannot be re-pointed, because 011 already
-- dropped votes.voter_id and there is nothing left to rebuild the link from.
-- Those students keep the vote they cast and simply see no change option.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The pointer: a voter to their own ballot, and nobody else.
-- ---------------------------------------------------------------------------
create table if not exists public.ballot_pointers (
  election_id uuid not null,
  voter_id    uuid not null,
  vote_id     uuid not null,
  created_at  timestamptz not null default now(),
  primary key (election_id, voter_id)
);

alter table public.ballot_pointers enable row level security;

-- There is deliberately no officer policy here. Reading this table is exactly
-- what would identify somebody's ballot, so officers must not be able to. It is
-- this narrow policy, not an absence of data, that keeps the ballot secret.
drop policy if exists ballot_pointers_select on public.ballot_pointers;
create policy ballot_pointers_select on public.ballot_pointers
  for select to authenticated using (voter_id = auth.uid());

grant select on public.ballot_pointers to authenticated;
revoke insert, update, delete on public.ballot_pointers from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Casting a ballot now also records the pointer, in the same transaction.
-- ---------------------------------------------------------------------------
create or replace function public.cast_vote(p_election_id uuid, p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter   uuid := auth.uid();
  v_vote_id uuid;
begin
  if v_voter is null then
    raise exception 'You must be signed in to vote';
  end if;

  if not public.is_election_open(p_election_id) then
    raise exception 'This election is not open for voting';
  end if;

  if not public.candidate_in_election(p_candidate_id, p_election_id) then
    raise exception 'That candidate is not on this ballot';
  end if;

  -- The receipt goes first: its primary key is what makes a second ballot
  -- impossible, and writing it up front means a repeat voter trips it before a
  -- ballot or a pointer is ever created.
  insert into public.ballot_receipts (election_id, voter_id)
  values (p_election_id, v_voter);

  insert into public.votes (election_id, candidate_id)
  values (p_election_id, p_candidate_id)
  returning id into v_vote_id;

  insert into public.ballot_pointers (election_id, voter_id, vote_id)
  values (p_election_id, v_voter, v_vote_id);
end;
$$;

grant execute on function public.cast_vote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Changing a vote overwrites the existing ballot rather than adding one, so
--    the election still holds exactly one ballot per voter and the tally stays
--    a straight count.
-- ---------------------------------------------------------------------------
create or replace function public.change_vote(p_election_id uuid, p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter   uuid := auth.uid();
  v_vote_id uuid;
begin
  if v_voter is null then
    raise exception 'You must be signed in to vote';
  end if;

  if not public.is_election_open(p_election_id) then
    raise exception 'Voting has closed for this election, so your ballot is final';
  end if;

  if not public.candidate_in_election(p_candidate_id, p_election_id) then
    raise exception 'That candidate is not on this ballot';
  end if;

  select bp.vote_id into v_vote_id
  from public.ballot_pointers bp
  where bp.election_id = p_election_id and bp.voter_id = v_voter;

  if v_vote_id is null then
    raise exception 'You have no changeable ballot in this election';
  end if;

  update public.votes
     set candidate_id = p_candidate_id
   where id = v_vote_id;
end;
$$;

grant execute on function public.change_vote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. What the caller themselves voted for, so the ballot can show their
--    current pick and preselect it. This is a function rather than a read of
--    public.votes because it must answer only for the caller.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_ballot(p_election_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_voter     uuid := auth.uid();
  v_candidate uuid;
begin
  if v_voter is null then
    return null;
  end if;

  select v.candidate_id into v_candidate
  from public.ballot_pointers bp
  join public.votes v on v.id = bp.vote_id
  where bp.election_id = p_election_id and bp.voter_id = v_voter;

  return v_candidate;
end;
$$;

grant execute on function public.get_my_ballot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Closing an election destroys its pointers. After this runs, nothing in the
--    database connects a ballot to a voter — not the voter, not an officer, not
--    the table owner — because there is no row left to read.
-- ---------------------------------------------------------------------------
create or replace function public.sever_ballot_pointers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    delete from public.ballot_pointers where election_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists elections_sever_ballot_pointers on public.elections;
create trigger elections_sever_ballot_pointers
  after update on public.elections
  for each row
  execute function public.sever_ballot_pointers();

-- Elections that had already closed by the time this ran get the same
-- treatment. The table is empty on a first run; this only matters on a re-run.
delete from public.ballot_pointers
where election_id in (select e.id from public.elections e where e.status = 'closed');

-- ---------------------------------------------------------------------------
-- 6. Removing a voter clears their receipt and their pointer. The anonymous
--    ballot is still left alone, exactly as in 011.
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

  delete from public.ballot_pointers where voter_id = p_voter_id;
  delete from public.ballot_receipts where voter_id = p_voter_id;
  delete from auth.identities      where user_id  = p_voter_id;
  delete from auth.users           where id       = p_voter_id;
  delete from public.profiles      where id       = p_voter_id;
end;
$$;
