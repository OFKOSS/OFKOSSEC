-- ============================================================================
-- BallotBox — SHS Student Council & Prefect Elections
-- Migration 001: schema, helper functions, RLS policies, grants, seed data.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables (logical / application-level foreign keys, no physical REFERENCES)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key,
  full_name  text not null,
  student_id text unique,
  class_name text,
  role       text not null default 'student' check (role in ('student', 'admin')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.elections (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  position       text not null,
  description    text,
  status         text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  results_public boolean not null default false,
  starts_at      timestamptz,
  ends_at        timestamptz,
  created_by     uuid,
  created_at     timestamptz not null default now()
);

create table if not exists public.candidates (
  id          uuid primary key default gen_random_uuid(),
  election_id uuid not null,
  name        text not null,
  class_name  text,
  slogan      text,
  manifesto   text,
  photo_url   text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- One row per voter per election: the unique constraint is what makes
-- double voting impossible even if two requests race each other.
create table if not exists public.votes (
  id           uuid primary key default gen_random_uuid(),
  election_id  uuid not null,
  candidate_id uuid not null,
  voter_id     uuid not null,
  created_at   timestamptz not null default now(),
  constraint votes_one_per_election unique (election_id, voter_id)
);

create index if not exists candidates_election_idx on public.candidates (election_id, sort_order);
create index if not exists votes_election_idx     on public.votes (election_id);
create index if not exists votes_candidate_idx    on public.votes (candidate_id);
create index if not exists votes_voter_idx        on public.votes (voter_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they bypass RLS when checking roles)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_election_open(p_election_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.elections e
    where e.id = p_election_id and e.status = 'active'
  );
$$;

create or replace function public.candidate_in_election(p_candidate_id uuid, p_election_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.candidates c
    where c.id = p_candidate_id and c.election_id = p_election_id
  );
$$;

-- Aggregate tally. Ballots stay secret: the function refuses to return counts
-- unless results are published or the caller is an admin.
create or replace function public.get_election_results(p_election_id uuid)
returns table (
  candidate_id   uuid,
  candidate_name text,
  class_name     text,
  slogan         text,
  photo_url      text,
  sort_order     integer,
  vote_count     bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_results_public boolean;
begin
  select e.results_public into v_results_public
  from public.elections e
  where e.id = p_election_id;

  if v_results_public is null then
    raise exception 'Election not found';
  end if;

  if not v_results_public and not public.is_admin() then
    raise exception 'Results for this election have not been published yet';
  end if;

  return query
    select c.id, c.name, c.class_name, c.slogan, c.photo_url, c.sort_order,
           count(v.id)::bigint
    from public.candidates c
    left join public.votes v on v.candidate_id = c.id
    where c.election_id = p_election_id
    group by c.id, c.name, c.class_name, c.slogan, c.photo_url, c.sort_order
    order by count(v.id) desc, c.sort_order asc;
end;
$$;

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
      (select count(*)::bigint from public.profiles p where p.role = 'student');
end;
$$;

-- Keep public.profiles in sync with auth.users on sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, student_id, class_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'student_id', ''),
    nullif(new.raw_user_meta_data ->> 'class_name', ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.elections  enable row level security;
alter table public.candidates enable row level security;
alter table public.votes      enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated using (public.is_admin());

-- elections ------------------------------------------------------------------
drop policy if exists elections_select on public.elections;
create policy elections_select on public.elections
  for select to authenticated using (true);

drop policy if exists elections_insert_admin on public.elections;
create policy elections_insert_admin on public.elections
  for insert to authenticated with check (public.is_admin());

drop policy if exists elections_update_admin on public.elections;
create policy elections_update_admin on public.elections
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists elections_delete_admin on public.elections;
create policy elections_delete_admin on public.elections
  for delete to authenticated using (public.is_admin());

-- candidates -----------------------------------------------------------------
drop policy if exists candidates_select on public.candidates;
create policy candidates_select on public.candidates
  for select to authenticated using (true);

drop policy if exists candidates_insert_admin on public.candidates;
create policy candidates_insert_admin on public.candidates
  for insert to authenticated with check (public.is_admin());

drop policy if exists candidates_update_admin on public.candidates;
create policy candidates_update_admin on public.candidates
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists candidates_delete_admin on public.candidates;
create policy candidates_delete_admin on public.candidates
  for delete to authenticated using (public.is_admin());

-- votes ----------------------------------------------------------------------
-- A voter may read only their own ballot; admins may read everything.
drop policy if exists votes_select on public.votes;
create policy votes_select on public.votes
  for select to authenticated
  using (voter_id = auth.uid() or public.is_admin());

-- A vote can only be cast as yourself, in an open election, for a candidate
-- that really belongs to that election. No update/delete policy exists, so
-- votes are immutable once written.
drop policy if exists votes_insert on public.votes;
create policy votes_insert on public.votes
  for insert to authenticated
  with check (
    voter_id = auth.uid()
    and public.is_election_open(election_id)
    and public.candidate_in_election(candidate_id, election_id)
  );

-- ---------------------------------------------------------------------------
-- Explicit role grants (RLS is the remaining gate)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.elections, public.candidates to anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.elections to authenticated;
grant select, insert, update, delete on public.candidates to authenticated;
grant select, insert on public.votes to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_election_open(uuid) to authenticated;
grant execute on function public.candidate_in_election(uuid, uuid) to authenticated;
grant execute on function public.get_election_results(uuid) to anon, authenticated;
grant execute on function public.get_election_turnout(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed data: three sample SHS elections with candidates
-- (times are relative so the demo data never goes stale)
-- ---------------------------------------------------------------------------

insert into public.elections (id, title, position, description, status, results_public, starts_at, ends_at)
values
  ('11111111-1111-4111-8111-111111111111',
   'Head Prefect Election',
   'Head Prefect',
   'Choose the student who will represent the whole school to staff, parents and the board for the coming year.',
   'active', false, now() - interval '3 days', now() + interval '18 days'),
  ('22222222-2222-4222-8222-222222222222',
   'Sports Captain Election',
   'Sports Captain',
   'The Sports Captain leads inter-house athletics, organises training and keeps the games spirit alive.',
   'active', true, now() - interval '10 days', now() + interval '9 days'),
  ('33333333-3333-4333-8333-333333333333',
   'Entertainment Prefect Election',
   'Entertainment Prefect',
   'The Entertainment Prefect plans socials, talent nights and end-of-term celebrations.',
   'closed', true, now() - interval '30 days', now() - interval '9 days')
on conflict (id) do nothing;

insert into public.candidates (id, election_id, name, class_name, slogan, manifesto, photo_url, sort_order)
values
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Ama Serwaa', 'Form 3 — Science', 'Every voice, every day.',
   'I will run a weekly open floor where any student can raise an issue directly with the council, and publish a short monthly report on what we achieved. My focus is a fairer queue at the dining hall, a working water fountain in the science block and a homework club that actually runs on Fridays.',
   'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=confident%20smiling%20teenage%20girl%20student%20in%20school%20uniform%20with%20short%20natural%20hair%2C%20risograph%20screenprint%20illustration%2C%20bold%20ink%20outlines%2C%20cream%20paper%20background%2C%20poppy%20red%20and%20cobalt%20blue%20limited%20palette%2C%20flat%20colors%2C%20halftone%20dots%2C%20square%20crop&image_size=square', 1),

  ('a0000002-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'Kwabena Mensah', 'Form 3 — Business', 'Order, service, results.',
   'My plan is simple and measurable: shorter dining queues, a repaired bell system and a council budget that is posted on the notice board every term. I have served two years on the class committee and I know how to get a request from a note to an approved action.',
   'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=confident%20teenage%20boy%20student%20in%20school%20uniform%20with%20glasses%20and%20striped%20tie%2C%20risograph%20screenprint%20illustration%2C%20bold%20ink%20outlines%2C%20cream%20paper%20background%2C%20poppy%20red%20and%20cobalt%20blue%20limited%20palette%2C%20flat%20colors%2C%20halftone%20dots%2C%20square%20crop&image_size=square', 2),

  ('a0000003-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'Akosua Boateng', 'Form 2 — Arts', 'Better halls, better stories.',
   'I want a council that listens to the lower forms as loudly as the final year. I will push for a cleaner assembly hall, a real notice board for clubs and a friendly buddy system for new students in their first term.',
   'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=cheerful%20teenage%20girl%20student%20in%20school%20uniform%20with%20braided%20hair%2C%20risograph%20screenprint%20illustration%2C%20bold%20ink%20outlines%2C%20cream%20paper%20background%2C%20poppy%20red%20and%20cobalt%20blue%20limited%20palette%2C%20flat%20colors%2C%20halftone%20dots%2C%20square%20crop&image_size=square', 3),

  ('a0000004-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'Yaw Darko', 'Form 3 — Science', 'Small changes, big wins.',
   'No long speeches. I am promising three things only: water in every block, a working suggestion box in the library and a termly clean-up competition between houses with a real prize attached.',
   'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=focused%20teenage%20boy%20student%20in%20school%20uniform%20with%20short%20cropped%20hair%2C%20risograph%20screenprint%20illustration%2C%20bold%20ink%20outlines%2C%20cream%20paper%20background%2C%20poppy%20red%20and%20cobalt%20blue%20limited%20palette%2C%20flat%20colors%2C%20halftone%20dots%2C%20square%20crop&image_size=square', 4),

  ('a0000005-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222',
   'Kojo Asante', 'Form 3 — Science', 'Train hard, play harder.',
   'Inter-house sports should be the best week of the year. I will publish the fixture list a month early, make sure every house fields a full team and get proper kits ordered before the season starts.',
   'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=athletic%20teenage%20boy%20student%20in%20school%20sports%20jersey%2C%20risograph%20screenprint%20illustration%2C%20bold%20ink%20outlines%2C%20cream%20paper%20background%2C%20poppy%20red%20and%20cobalt%20blue%20limited%20palette%2C%20flat%20colors%2C%20halftone%20dots%2C%20square%20crop&image_size=square', 1),

  ('a0000006-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222',
   'Abena Osei', 'Form 2 — Science', 'Sport for everyone.',
   'Not everyone makes the first team, and that is fine. I will open a weekly recreation hour where anyone can play, and add a second set of goalposts so two matches can run at once.',
   'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=energetic%20teenage%20girl%20student%20in%20school%20sports%20jersey%20with%20ponytail%2C%20risograph%20screenprint%20illustration%2C%20bold%20ink%20outlines%2C%20cream%20paper%20background%2C%20poppy%20red%20and%20cobalt%20blue%20limited%20palette%2C%20flat%20colors%2C%20halftone%20dots%2C%20square%20crop&image_size=square', 2),

  ('a0000007-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222',
   'Nana Adjei', 'Form 3 — Arts', 'No benchwarmers.',
   'We have talent sitting on the bench every single match. I will run open trials each term and make sure the team sheet is posted after selection so everyone knows where they stand.',
   'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=calm%20teenage%20boy%20student%20in%20school%20uniform%20holding%20a%20notebook%2C%20risograph%20screenprint%20illustration%2C%20bold%20ink%20outlines%2C%20cream%20paper%20background%2C%20poppy%20red%20and%20cobalt%20blue%20limited%20palette%2C%20flat%20colors%2C%20halftone%20dots%2C%20square%20crop&image_size=square', 3),

  ('a0000008-0000-4000-8000-000000000008', '33333333-3333-4333-8333-333333333333',
   'Efua Nyarko', 'Form 2 — Business', 'Good vibes, always.',
   'A talent night every half-term, a music request list that students actually control and a proper send-off for the final year. That is the promise.',
   'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=bright%20teenage%20girl%20student%20in%20school%20uniform%20with%20headphones%20around%20neck%2C%20risograph%20screenprint%20illustration%2C%20bold%20ink%20outlines%2C%20cream%20paper%20background%2C%20poppy%20red%20and%20cobalt%20blue%20limited%20palette%2C%20flat%20colors%2C%20halftone%20dots%2C%20square%20crop&image_size=square', 1),

  ('a0000009-0000-4000-8000-000000000009', '33333333-3333-4333-8333-333333333333',
   'Kofi Badu', 'Form 3 — Arts', 'Every weekend counts.',
   'I will organise a monthly games-and-music evening, keep the compound sound system in working order and make sure every house gets a fair turn at hosting.',
   'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=lively%20teenage%20boy%20student%20in%20school%20uniform%20with%20a%20cap%2C%20risograph%20screenprint%20illustration%2C%20bold%20ink%20outlines%2C%20cream%20paper%20background%2C%20poppy%20red%20and%20cobalt%20blue%20limited%20palette%2C%20flat%20colors%2C%20halftone%20dots%2C%20square%20crop&image_size=square', 2)
on conflict (id) do nothing;
