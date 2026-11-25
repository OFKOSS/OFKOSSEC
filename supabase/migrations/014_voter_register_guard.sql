-- ============================================================================
-- OFKOSSEC — Migration 014: only registered voters may cast a ballot.
--
-- public.cast_vote() accepted anyone holding a session. It checked that the
-- caller was signed in, that the election was open and that the candidate
-- belonged to it — but never that the caller was on the school's voter
-- register. Sign-up was left enabled on the Supabase project, so anybody who
-- could confirm an email address could create an account and stuff the ballot
-- box once per account.
--
-- Voting now requires a public.profiles row that is actually on the register:
-- role = 'student' with a non-null student_id. That is exactly the set of rows
-- the officer console writes through admin_create_voter()/admin_update_voter(),
-- and the same set get_election_turnout() counts as eligible.
--
-- A sign-up cannot forge its way onto the register: migration 009 narrowed
-- UPDATE on public.profiles to (full_name, class_name, avatar_url) and
-- migration 010 revoked INSERT, so a self-registered student cannot write
-- student_id or role for themselves.
--
-- change_vote() gets the same guard. Without it a self-registered account could
-- not only vote but keep rewriting its ballot while polls stayed open.
--
-- Turning sign-up off in the Supabase dashboard is still recommended
-- (Authentication -> Providers -> Email -> Allow new users to sign up). It
-- removes the useless accounts entirely, including the ones that inflate the
-- register without being able to vote, and costs nothing: the app has no
-- sign-up page. This migration is the backstop that does not depend on a
-- dashboard setting staying correct.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Casting a ballot requires a place on the register.
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

  -- The gate this migration adds: an account is not a voter. Only a row the
  -- officer console created carries a student_id, so an account made by the
  -- public sign-up endpoint can never satisfy this.
  if not exists (
    select 1 from public.profiles p
    where p.id = v_voter and p.role = 'student' and p.student_id is not null
  ) then
    raise exception 'You are not on the voters register, so you cannot vote';
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
-- 2. Changing a ballot is a voting action too, so it carries the same gate.
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

  if not exists (
    select 1 from public.profiles p
    where p.id = v_voter and p.role = 'student' and p.student_id is not null
  ) then
    raise exception 'You are not on the voters register, so you cannot vote';
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
