-- Two more activity sources: the teacher-development center (פסג"ה חולון), which is
-- the body that will author a large share of the bank, and a neutral "כללי" for
-- generic activities that belong to no specific provider.
--
-- ADD VALUE is additive: existing rows and the client's closed vocabulary stay valid.
-- The chip colours live client-side in src/planBank.ts (SOURCE_META).
alter type public.task_source add value if not exists 'פסג"ה חולון';
alter type public.task_source add value if not exists 'כללי';
