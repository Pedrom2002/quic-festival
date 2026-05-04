-- Two-day check-in: rename checked_in_at → checked_in_day1_at, add checked_in_day2_at.
-- 8 Mai 2026 = Dia 1 (Sábado), 9 Mai 2026 = Dia 2 (Domingo).

alter table public.guests
  rename column checked_in_at to checked_in_day1_at;

alter table public.guests
  add column if not exists checked_in_day2_at timestamptz;

-- Recreate the immutable guard trigger so it still references correct columns.
-- (trigger body doesn't touch checked_in columns directly, just re-drop to be safe)

-- Update the CSV export helper view if it exists (no-op if not).
-- No view exists; columns updated inline in route.ts.
