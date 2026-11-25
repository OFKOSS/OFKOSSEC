-- ============================================================================
-- OFKOSSEC — Migration 015: turnout counts only the voters who can vote.
--
-- get_election_turnout() measured "eligible" as every public.profiles row with
-- role = 'student'. Migration 014 established that casting a ballot requires a
-- row with a non-null student_id — the register the officer console actually
-- writes. The two definitions disagreed on any account that arrived through the
-- public sign-up endpoint: such an account was counted as eligible but could
-- never cast a ballot, so turnout would read lower than the truth as those
-- accounts accumulated.
--
-- "Eligible" now means the same thing voting means. Nothing shifts today: the
-- live register is 566 rows under both definitions, because no stray account
-- exists yet. This stops the two numbers drifting apart for as long as sign-up
-- remains enabled.
--
-- The officer insights screen computed the same figure client-side and has been
-- given the matching filter, so the two screens cannot disagree.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

create or replace function public.get_election_turnout(p_election_id uuid)
returns table (voted bigint, eligible bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  return query
    select
      (select count(*)::bigint from public.votes v where v.election_id = p_election_id),
      -- The same predicate cast_vote() and change_vote() apply, so the
      -- denominator is the voters register and not simply every account.
      (select count(*)::bigint from public.profiles p
        where p.role = 'student' and p.student_id is not null);
end;
$$;

grant execute on function public.get_election_turnout(uuid) to authenticated;
