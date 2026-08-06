-- 13 · Track which bank activity a plan row came from, so the planning zone can
--      show an "already in plan" state on bank cards and refuse silent duplicates.
--
--      Nullable, no FK: a bank item may later be deleted or deactivated, but the
--      school's plan row must survive (adding an activity COPIES its values into
--      plan_activities — it does not reference the bank). NULL = a custom
--      "יוזמה ייחודית / אחר" that never came from the bank.
alter table public.plan_activities
  add column if not exists bank_key text;
