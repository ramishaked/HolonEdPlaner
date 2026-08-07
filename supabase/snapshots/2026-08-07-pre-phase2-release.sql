-- Pre-release snapshot — taken 2026-08-07, immediately before the first Phase 2
-- deploy to production (v0.1.13, git tag `prod-phase1-2026-08-04` marks what prod
-- was running until now).
--
-- WHAT IS AND IS NOT IN HERE, AND WHY
--
-- Content (principles + their sources and rubric levels, the 84 activity-bank items
-- and their principle links, the 5 target audiences, the 43 school rows) is NOT
-- copied here. All of it is still exactly what the migrations produce — it has never
-- been edited at runtime through the admin console. So for content, the migration set
-- under supabase/migrations/ IS the snapshot, and re-running it restores it.
--
-- CLAUDE.md is right that runtime content edits live only in the DB. The moment the
-- city admin edits a principle, the bank or an audience through AdminArea, that stops
-- being true and this file stops covering it. From that point on a real backup is
-- required — see "Going forward" at the bottom.
--
-- What IS here is the one thing the migrations genuinely cannot reproduce: the
-- identity mapping. The 43 school logins in auth.users were created out-of-band, not
-- by any migration (the seed inserts schools with no auth users at all). Lose this
-- mapping and every school's data is orphaned from its login.
--
-- Passwords are deliberately absent — they are bcrypt hashes in auth.users and are
-- reset as part of this release. Restoring a login means re-creating the auth user
-- with the id below, then setting a password via public.admin_set_school_password().

-- ---------------------------------------------------------------------------
-- Applied migrations at snapshot time (19). Note the remote ledger's version
-- numbers differ from the filename prefixes — these were applied via the API,
-- not `supabase db push`, so the ledger is not keyed to the filenames.
-- ---------------------------------------------------------------------------
--   enums_and_helpers · tenancy · principles · activity_bank · plans · storage
--   seed_holon · harden_helper_schema · school_directory
--   merge_principles_to_five · replace_activity_bank · dynamic_audiences
--   activity_bank_many_principles · city_admin_account
--   plan_activities_bank_key · atomic_set_plan_focus · school_admin
--   activity_bank_hygiene · school_principle_order_namespace

-- ---------------------------------------------------------------------------
-- Identity mapping: school → profile → auth user
--
-- No secrets: the school ids are already readable by anon through
-- public.list_schools() (the login picker needs them), and the email is a pure
-- function of the id — see schoolEmail() in api/_lib/schoolIdentity.ts.
-- ---------------------------------------------------------------------------

create temp table if not exists snapshot_school_identity (
  school_id   uuid,
  school_name text,
  is_active   boolean,
  profile_id  uuid,
  auth_email  text
);

insert into snapshot_school_identity (school_id, school_name, is_active, profile_id, auth_email) values
  ('0d3ec971-c68e-48e0-a3a7-0af218486624', 'Hogwarts', 't', 'd4cf389a-d1f5-4caa-bdc3-fb9233026a95', '0d3ec971-c68e-48e0-a3a7-0af218486624@schools.holon.test'),
  ('ec2adf2e-6155-46bc-86ab-f57809ba90f0', 'אילון', 't', '93243891-81d3-456e-a0a6-862b42c2b630', 'ec2adf2e-6155-46bc-86ab-f57809ba90f0@schools.holon.test'),
  ('a9dabf0d-6fc5-44dd-966f-b4d4301d95b8', 'אמירים', 't', '48f25175-06dd-480e-8512-918a0b8863b7', 'a9dabf0d-6fc5-44dd-966f-b4d4301d95b8@schools.holon.test'),
  ('91790dea-256f-42b0-ab7c-cc9bd0559f5c', 'אשכול', 't', 'd948d13a-3476-4af6-8f6d-1258072c2766', '91790dea-256f-42b0-ab7c-cc9bd0559f5c@schools.holon.test'),
  ('3a2a875d-d1c4-4ba8-a229-413c7f272199', 'אשלים', 't', 'b53ae248-8618-42fd-8843-83736c4c8cde', '3a2a875d-d1c4-4ba8-a229-413c7f272199@schools.holon.test'),
  ('08738031-055a-4f68-a522-2d39bf0bfeb1', 'ביאליק', 't', '088459d0-e7ca-4735-9916-d8030a62be96', '08738031-055a-4f68-a522-2d39bf0bfeb1@schools.holon.test'),
  ('d6bcb390-5e32-4d0e-b0a8-2953524b8a2c', 'בן גוריון', 't', 'f5116777-f76e-4f52-92e4-afffc98b776d', 'd6bcb390-5e32-4d0e-b0a8-2953524b8a2c@schools.holon.test'),
  ('6a6621d4-a51d-451f-9b15-3fcd3ea2c2da', 'בן צבי', 't', '31aed6a2-6065-467e-a8db-364cf54ebe8c', '6a6621d4-a51d-451f-9b15-3fcd3ea2c2da@schools.holon.test'),
  ('4eeac104-bfff-412d-a3f7-49d33cef5e5d', 'גולדטק', 't', '7342361a-028e-42c5-9794-6207fc1d239b', '4eeac104-bfff-412d-a3f7-49d33cef5e5d@schools.holon.test'),
  ('81a938f5-fe69-4494-ae50-02d290a87d41', 'גורדון', 't', '1c54a042-bf31-4d4c-a116-9600b2f60f36', '81a938f5-fe69-4494-ae50-02d290a87d41@schools.holon.test'),
  ('dcf0aa61-d131-4678-b728-8118c4d7c07b', 'דביר', 't', '41171bd2-2435-42f6-8b57-4e1946e162d5', 'dcf0aa61-d131-4678-b728-8118c4d7c07b@schools.holon.test'),
  ('88f73953-c0a3-4330-ab71-d25e38597607', 'דינור', 't', 'c3b94e04-3462-4d6d-9654-d966550be150', '88f73953-c0a3-4330-ab71-d25e38597607@schools.holon.test'),
  ('47318c29-1261-45e4-ad9b-9cfe48bb3a66', 'הס', 't', '304417e0-2a53-4182-9314-91d36826a821', '47318c29-1261-45e4-ad9b-9cfe48bb3a66@schools.holon.test'),
  ('4bef1a6f-90a8-4867-aaf2-7d6fe60894ae', 'הרצוג', 't', '06617004-311c-4223-b49d-2d664e9f3426', '4bef1a6f-90a8-4867-aaf2-7d6fe60894ae@schools.holon.test'),
  ('cfd9a5f4-c572-415c-bafd-998deac70a0e', 'התבור', 't', '93fa3d11-e3f6-4372-9a77-9ce3971f4d8c', 'cfd9a5f4-c572-415c-bafd-998deac70a0e@schools.holon.test'),
  ('97f665f1-86f1-4233-a6ad-dffbf6f074a1', 'חט"ב איילון', 't', 'bf8016cb-3075-491b-b5fb-32d0ca4636c4', '97f665f1-86f1-4233-a6ad-dffbf6f074a1@schools.holon.test'),
  ('e90ace5d-fd8a-4ae0-946d-9041906ff66d', 'חט״ב אלון', 't', 'fc92ccff-7f16-45f9-aa0b-4e8c95e12370', 'e90ace5d-fd8a-4ae0-946d-9041906ff66d@schools.holon.test'),
  ('63f94f67-8e62-4f52-9b21-b9bf7dcd16b4', 'חט"ב ארן', 't', '9ec81c4e-a346-4e26-a0a6-f0e3978d60c3', '63f94f67-8e62-4f52-9b21-b9bf7dcd16b4@schools.holon.test'),
  ('bffab076-c0c1-4352-a5c8-0cf4389be191', 'חט"ב הייטק היי', 't', 'f322100c-5d5b-4953-862a-6244e18ec468', 'bffab076-c0c1-4352-a5c8-0cf4389be191@schools.holon.test'),
  ('e1b8e88f-e17f-410a-b789-c3f07f8c82de', 'חט"ב קוגל', 't', '54df89a3-1e9a-44cc-b133-a105651e3ab2', 'e1b8e88f-e17f-410a-b789-c3f07f8c82de@schools.holon.test'),
  ('fb06bd57-0fe8-43d7-92c4-a234caa17df8', 'יבנה', 't', '8ea9a631-d809-43bd-a715-d86e9ef95209', 'fb06bd57-0fe8-43d7-92c4-a234caa17df8@schools.holon.test'),
  ('5bd6b576-739f-4eb3-b55a-7dcb510cd1bd', 'יחד', 't', '5a4391cc-a8bf-4b62-bbfb-f8ce8d611d8f', '5bd6b576-739f-4eb3-b55a-7dcb510cd1bd@schools.holon.test'),
  ('e364acce-aeb0-4042-94eb-1ea7db185d71', 'ישורון', 't', 'de416189-dedd-43f4-9060-02a53d20ef7b', 'e364acce-aeb0-4042-94eb-1ea7db185d71@schools.holon.test'),
  ('dfa7e77b-43b8-427f-95b9-cab4b503c4b9', 'ישעיהו', 't', 'e19c1f68-f890-4f90-9a58-501e7524adbb', 'dfa7e77b-43b8-427f-95b9-cab4b503c4b9@schools.holon.test'),
  ('cce112f5-761e-4990-a062-123f5c5155e3', 'כצנלסון', 't', 'c843efb0-4114-4df9-aaf7-d2436a9ce1df', 'cce112f5-761e-4990-a062-123f5c5155e3@schools.holon.test'),
  ('73831c8c-d634-44c3-b7fe-c4e4e392a203', 'לווית חן', 't', '85a692e4-fdda-4374-826d-47fe59475ae4', '73831c8c-d634-44c3-b7fe-c4e4e392a203@schools.holon.test'),
  ('fd3ad5af-e9df-4710-86c5-fc6ad818caf6', 'מגינים', 't', '5fbfb61e-6531-4d9a-ba16-238b6190f536', 'fd3ad5af-e9df-4710-86c5-fc6ad818caf6@schools.holon.test'),
  ('a31a7305-cf0d-41f6-be2b-0bdb1666d633', 'משה שרת', 't', 'de0d9e12-ff23-4fdf-b3b2-f40462c45e5a', 'a31a7305-cf0d-41f6-be2b-0bdb1666d633@schools.holon.test'),
  ('72b04a80-e01b-4032-9d40-f09897f3a9d2', 'נבון', 't', '8444a729-1094-42a2-9cfa-2b996074b0a0', '72b04a80-e01b-4032-9d40-f09897f3a9d2@schools.holon.test'),
  ('fed3baa2-6b6a-4308-9b66-6b782843a0ae', 'ניב', 't', '79b9ada8-db12-4319-b117-fecb2d6c5398', 'fed3baa2-6b6a-4308-9b66-6b782843a0ae@schools.holon.test'),
  ('b0104902-7581-44fc-a008-5aa418f209c9', 'ניצנים', 't', 'b70dd183-5c10-4465-aaeb-c80453bb37bc', 'b0104902-7581-44fc-a008-5aa418f209c9@schools.holon.test'),
  ('b11318a4-78e6-4572-a417-9e26e50b7fc6', 'עלומים', 't', '5c3cb20f-a68a-4351-a744-a1793c6f493b', 'b11318a4-78e6-4572-a417-9e26e50b7fc6@schools.holon.test'),
  ('05c2618e-b31f-4436-9ee1-fe1455488c64', 'עתידים', 't', '24ffaff5-6945-4d62-bb96-a67f2bdbe057', '05c2618e-b31f-4436-9ee1-fe1455488c64@schools.holon.test'),
  ('3aad7d74-27ac-4110-adf2-b1e78fae6d20', 'ק"ש', 't', '88a3043b-3547-4a03-a95f-89e9cfa9cf7b', '3aad7d74-27ac-4110-adf2-b1e78fae6d20@schools.holon.test'),
  ('c2343eba-b265-4e80-bd4a-002d3ef9c15d', 'קוגל', 't', '273d2055-0885-465e-adae-3f17fe913f3c', 'c2343eba-b265-4e80-bd4a-002d3ef9c15d@schools.holon.test'),
  ('50248c9b-ded4-4472-abcc-612e4a43a30a', 'קציר', 't', '099b64ea-5a44-4200-9276-212985aee556', '50248c9b-ded4-4472-abcc-612e4a43a30a@schools.holon.test'),
  ('65e3269b-b9ca-45e9-90a0-6e37e71584d2', 'רביבים', 't', 'd845162a-19bc-4249-af4d-3f4a5f8d0698', '65e3269b-b9ca-45e9-90a0-6e37e71584d2@schools.holon.test'),
  ('e08eaf9b-931e-413f-912a-e0055a7b56ad', 'שזר', 't', '5eea590e-f8c6-4abb-9af6-078a78fdfbdb', 'e08eaf9b-931e-413f-912a-e0055a7b56ad@schools.holon.test'),
  ('808558bf-98e5-4189-98b2-b9ec36d57623', 'שמגר', 't', '3bce7a93-8b71-4a33-97f8-0e291f535d0d', '808558bf-98e5-4189-98b2-b9ec36d57623@schools.holon.test'),
  ('119bde6b-4181-44a2-b2bd-e6bfb488df19', 'שמיר', 't', 'a3f0d0b8-092a-4961-866a-cb618aeff790', '119bde6b-4181-44a2-b2bd-e6bfb488df19@schools.holon.test'),
  ('f358ee48-f864-498a-b2cb-aebc6eaea19d', 'שנקר', 't', 'f8b11862-0a3a-45e9-9721-30adaa144e1f', 'f358ee48-f864-498a-b2cb-aebc6eaea19d@schools.holon.test'),
  ('a21e5abe-ead7-41a2-bb4a-539f382903b4', 'שער האריות', 't', '62c268cd-6c74-4180-8394-1b72fe967fca', 'a21e5abe-ead7-41a2-bb4a-539f382903b4@schools.holon.test'),
  ('ac251316-0d74-45a6-b018-a40929f8935a', 'שרון', 't', 'f1099bdf-59ac-46d5-a345-7c54ce41cf80', 'ac251316-0d74-45a6-b018-a40929f8935a@schools.holon.test'),
  ('a9354dd4-30fc-420b-adf4-a08b29410d80', 'תיכון הייטק היי', 't', 'fab6823d-95f4-40d0-a683-6d2668d93211', 'a9354dd4-30fc-420b-adf4-a08b29410d80@schools.holon.test');

-- 44 rows. 43 real Holon schools + "Hogwarts", the QA school kept deliberately.
-- The city admin (admin@holon.test) has no school_id and is not listed here.

-- ---------------------------------------------------------------------------
-- Going forward
--
-- This file covers a database whose only real content came from migrations. Once
-- schools start filling in diagnostics, plans and uploading files, none of that is
-- reproducible from anything in this repo, and neither this file nor the migrations
-- will bring it back. Confirm the project's backup situation in
-- Supabase → Database → Backups before that data accumulates.
-- ---------------------------------------------------------------------------
