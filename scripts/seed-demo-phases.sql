-- ============================================================================
-- DEMO SEED Part 2: Checklist phases + Ledenwerving for Demoproject
-- Run in Supabase SQL Editor after seed-demo.sql
-- ============================================================================

-- ─── Clean existing phase/checklist/intake data ─────────────────────────────
DELETE FROM checklist_phase_progress WHERE project_id = '00000000-0000-4000-b000-000000000001';
DELETE FROM checklist_progress WHERE project_id = '00000000-0000-4000-b000-000000000001';
DELETE FROM checklist_templates WHERE project_id = '00000000-0000-4000-b000-000000000001';
DELETE FROM checklist_phases WHERE project_id = '00000000-0000-4000-b000-000000000001';
DELETE FROM intake_responses WHERE project_id = '00000000-0000-4000-b000-000000000001';
DELETE FROM intake_questions WHERE project_id = '00000000-0000-4000-b000-000000000001';


-- ═══════════════════════════════════════════════════════════════════════════
-- CHECKLIST PHASES & TEMPLATES
-- ═══════════════════════════════════════════════════════════════════════════

-- Phase 1: Kennismaking & Orientatie
INSERT INTO checklist_phases (id, project_id, title, description, color, sort_order)
VALUES ('c0000000-0000-4000-c100-000000000001', '00000000-0000-4000-b000-000000000001',
  'Kennismaking', 'Nieuwe leden leren het project en de gemeenschap kennen', '#3b82f6', 0);

INSERT INTO checklist_templates (id, project_id, phase_id, title, description, sort_order) VALUES
  ('c0000000-0000-4000-c200-000000000001', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000001',
   'Kennismakingsgesprek gehad', 'Persoonlijk gesprek met bestuur of commissielid', 0),
  ('c0000000-0000-4000-c200-000000000002', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000001',
   'Informatiedossier ontvangen', 'Projectbeschrijving, statuten, financieel overzicht', 1),
  ('c0000000-0000-4000-c200-000000000003', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000001',
   'Rondleiding bouwlocatie', 'Bezoek aan Centrumeiland met uitleg over het plan', 2),
  ('c0000000-0000-4000-c200-000000000004', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000001',
   'Profiel compleet ingevuld', 'Alle persoonlijke gegevens en woonwensen ingevuld', 3);

-- Phase 2: Voorkeursfase
INSERT INTO checklist_phases (id, project_id, title, description, color, sort_order)
VALUES ('c0000000-0000-4000-c100-000000000002', '00000000-0000-4000-b000-000000000001',
  'Voorkeursfase', 'Woningvoorkeur doorgeven en toewijzing', '#f59e0b', 1);

INSERT INTO checklist_templates (id, project_id, phase_id, title, description, sort_order) VALUES
  ('c0000000-0000-4000-c200-000000000005', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000002',
   '3 woningvoorkeuren doorgegeven', 'Top 3 woningtypes en verdieping opgegeven', 0),
  ('c0000000-0000-4000-c200-000000000006', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000002',
   'Financiele screening afgerond', 'Hypotheekcheck of huurinkomenstoets', 1),
  ('c0000000-0000-4000-c200-000000000007', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000002',
   'Woning toegewezen', 'Definitieve woningtoewijzing op basis van punten', 2);

-- Phase 3: Reserveringsfase
INSERT INTO checklist_phases (id, project_id, title, description, color, sort_order)
VALUES ('c0000000-0000-4000-c100-000000000003', '00000000-0000-4000-b000-000000000001',
  'Reserveringsfase', 'Reserveringsovereenkomst tekenen en betalen', '#f97316', 2);

INSERT INTO checklist_templates (id, project_id, phase_id, title, description, sort_order) VALUES
  ('c0000000-0000-4000-c200-000000000008', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000003',
   'Reserveringsovereenkomst ontvangen', 'Document verstuurd per email en post', 0),
  ('c0000000-0000-4000-c200-000000000009', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000003',
   'Overeenkomst ondertekend', 'Binnen 7 dagen retour', 1),
  ('c0000000-0000-4000-c200-000000000010', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000003',
   'Reserveringsbedrag betaald', 'EUR 5.000 binnen 5 werkdagen', 2);

-- Phase 4: Koopfase
INSERT INTO checklist_phases (id, project_id, title, description, color, sort_order)
VALUES ('c0000000-0000-4000-c100-000000000004', '00000000-0000-4000-b000-000000000001',
  'Koopfase', 'Koopovereenkomst en notaris', '#22c55e', 3);

INSERT INTO checklist_templates (id, project_id, phase_id, title, description, sort_order) VALUES
  ('c0000000-0000-4000-c200-000000000011', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000004',
   'Koopovereenkomst getekend', 'Bij de notaris of digitaal', 0),
  ('c0000000-0000-4000-c200-000000000012', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000004',
   'Hypotheek definitief', 'Bankgarantie of waarborgsom gestort', 1),
  ('c0000000-0000-4000-c200-000000000013', '00000000-0000-4000-b000-000000000001', 'c0000000-0000-4000-c100-000000000004',
   'Sleuteloverdracht', 'Eindinspectie en oplevering', 2);


-- ═══════════════════════════════════════════════════════════════════════════
-- CHECKLIST PROGRESS — varied completion across members
-- Admin user as completer for all
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: admin user who marks things complete
-- Using Sophie (d...001) as the admin who completes checklists

-- Members 1-5 (admins/moderators): completed through phase 3
-- Phase 1 complete for members 1-10
INSERT INTO checklist_progress (template_id, profile_id, project_id, completed_at, completed_by) VALUES
  -- Template 1-4 (Kennismaking) complete for members 1-15
  ('c0000000-0000-4000-c200-000000000001', 'd0000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', now() - interval '120 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000002', 'd0000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', now() - interval '118 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000003', 'd0000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', now() - interval '115 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000004', 'd0000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', now() - interval '110 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000001', 'd0000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000001', now() - interval '110 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000002', 'd0000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000001', now() - interval '108 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000003', 'd0000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000001', now() - interval '105 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000004', 'd0000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000001', now() - interval '100 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000001', 'd0000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000001', now() - interval '100 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000002', 'd0000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000001', now() - interval '98 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000003', 'd0000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000001', now() - interval '95 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000004', 'd0000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000001', now() - interval '90 days', 'd0000000-0000-4000-a000-000000000001');

-- Generate phase 1 completion for members 4-15 (bulk)
INSERT INTO checklist_progress (template_id, profile_id, project_id, completed_at, completed_by)
SELECT t.tid, u.uid, '00000000-0000-4000-b000-000000000001'::uuid, now() - (90 + (n-4)*5) * interval '1 day', 'd0000000-0000-4000-a000-000000000001'::uuid
FROM generate_series(4, 15) n
CROSS JOIN (VALUES
  ('c0000000-0000-4000-c200-000000000001'::uuid),
  ('c0000000-0000-4000-c200-000000000002'::uuid),
  ('c0000000-0000-4000-c200-000000000003'::uuid),
  ('c0000000-0000-4000-c200-000000000004'::uuid)
) AS t(tid)
CROSS JOIN LATERAL (
  SELECT ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid AS uid
) u
ON CONFLICT DO NOTHING;

-- Phase 1 partial for members 16-20 (only first 2 steps)
INSERT INTO checklist_progress (template_id, profile_id, project_id, completed_at, completed_by)
SELECT t.tid, u.uid, '00000000-0000-4000-b000-000000000001'::uuid, now() - (30 + (n-16)*3) * interval '1 day', 'd0000000-0000-4000-a000-000000000001'::uuid
FROM generate_series(16, 20) n
CROSS JOIN (VALUES
  ('c0000000-0000-4000-c200-000000000001'::uuid),
  ('c0000000-0000-4000-c200-000000000002'::uuid)
) AS t(tid)
CROSS JOIN LATERAL (
  SELECT ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid AS uid
) u
ON CONFLICT DO NOTHING;

-- Phase 2 (Voorkeursfase) complete for members 1-8
INSERT INTO checklist_progress (template_id, profile_id, project_id, completed_at, completed_by)
SELECT t.tid, u.uid, '00000000-0000-4000-b000-000000000001'::uuid, now() - (60 + (n-1)*4) * interval '1 day', 'd0000000-0000-4000-a000-000000000001'::uuid
FROM generate_series(1, 8) n
CROSS JOIN (VALUES
  ('c0000000-0000-4000-c200-000000000005'::uuid),
  ('c0000000-0000-4000-c200-000000000006'::uuid),
  ('c0000000-0000-4000-c200-000000000007'::uuid)
) AS t(tid)
CROSS JOIN LATERAL (
  SELECT ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid AS uid
) u
ON CONFLICT DO NOTHING;

-- Phase 2 partial for members 9-12 (only first step done)
INSERT INTO checklist_progress (template_id, profile_id, project_id, completed_at, completed_by)
SELECT 'c0000000-0000-4000-c200-000000000005'::uuid, ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, '00000000-0000-4000-b000-000000000001'::uuid, now() - (40 + n) * interval '1 day', 'd0000000-0000-4000-a000-000000000001'::uuid
FROM generate_series(9, 12)  n
ON CONFLICT DO NOTHING;

-- Phase 3 (Reserveringsfase) complete for members 1-5
INSERT INTO checklist_progress (template_id, profile_id, project_id, completed_at, completed_by)
SELECT t.tid, u.uid, '00000000-0000-4000-b000-000000000001'::uuid, now() - (30 + (n-1)*3) * interval '1 day', 'd0000000-0000-4000-a000-000000000001'::uuid
FROM generate_series(1, 5) n
CROSS JOIN (VALUES
  ('c0000000-0000-4000-c200-000000000008'::uuid),
  ('c0000000-0000-4000-c200-000000000009'::uuid),
  ('c0000000-0000-4000-c200-000000000010'::uuid)
) AS t(tid)
CROSS JOIN LATERAL (
  SELECT ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid AS uid
) u
ON CONFLICT DO NOTHING;

-- Phase 3 partial for members 6-7 (overeenkomst ontvangen maar nog niet getekend)
INSERT INTO checklist_progress (template_id, profile_id, project_id, completed_at, completed_by) VALUES
  ('c0000000-0000-4000-c200-000000000008', 'd0000000-0000-4000-a000-000000000006', '00000000-0000-4000-b000-000000000001', now() - interval '20 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000008', 'd0000000-0000-4000-a000-000000000007', '00000000-0000-4000-b000-000000000001', now() - interval '18 days', 'd0000000-0000-4000-a000-000000000001');

-- Phase 4 (Koopfase) complete for members 1-2 only (furthest along)
INSERT INTO checklist_progress (template_id, profile_id, project_id, completed_at, completed_by) VALUES
  ('c0000000-0000-4000-c200-000000000011', 'd0000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', now() - interval '10 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000012', 'd0000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', now() - interval '5 days', 'd0000000-0000-4000-a000-000000000001'),
  ('c0000000-0000-4000-c200-000000000011', 'd0000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000001', now() - interval '8 days', 'd0000000-0000-4000-a000-000000000001');

-- Phase-level progress (for phases without templates, or phase completion marker)
INSERT INTO checklist_phase_progress (phase_id, profile_id, project_id, completed_at, completed_by)
SELECT 'c0000000-0000-4000-c100-000000000001'::uuid, ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, '00000000-0000-4000-b000-000000000001'::uuid, now() - (80 + n*3) * interval '1 day', 'd0000000-0000-4000-a000-000000000001'::uuid
FROM generate_series(1, 15) n
ON CONFLICT DO NOTHING;

INSERT INTO checklist_phase_progress (phase_id, profile_id, project_id, completed_at, completed_by)
SELECT 'c0000000-0000-4000-c100-000000000002'::uuid, ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, '00000000-0000-4000-b000-000000000001'::uuid, now() - (50 + n*4) * interval '1 day', 'd0000000-0000-4000-a000-000000000001'::uuid
FROM generate_series(1, 8) n
ON CONFLICT DO NOTHING;

INSERT INTO checklist_phase_progress (phase_id, profile_id, project_id, completed_at, completed_by)
SELECT 'c0000000-0000-4000-c100-000000000003'::uuid, ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, '00000000-0000-4000-b000-000000000001'::uuid, now() - (20 + n*3) * interval '1 day', 'd0000000-0000-4000-a000-000000000001'::uuid
FROM generate_series(1, 5) n
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- HOUSING PREFERENCES on memberships
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE memberships SET housing_preferences = '["3-kamer appartement, 3e verdieping", "2-kamer appartement, 4e verdieping", "3-kamer maisonnette"]'::jsonb
WHERE profile_id = 'd0000000-0000-4000-a000-000000000001' AND project_id = '00000000-0000-4000-b000-000000000001';

UPDATE memberships SET housing_preferences = '["4-kamer maisonnette", "3-kamer appartement, 2e verdieping", "4-kamer appartement, 1e verdieping"]'::jsonb
WHERE profile_id = 'd0000000-0000-4000-a000-000000000002' AND project_id = '00000000-0000-4000-b000-000000000001';

UPDATE memberships SET housing_preferences = '["2-kamer appartement, 5e verdieping", "Studio met dakterras", "2-kamer appartement, 3e verdieping"]'::jsonb
WHERE profile_id = 'd0000000-0000-4000-a000-000000000003' AND project_id = '00000000-0000-4000-b000-000000000001';

UPDATE memberships SET housing_preferences = '["3-kamer benedenwoning met tuin", "3-kamer appartement, 1e verdieping", "2-kamer appartement, 2e verdieping"]'::jsonb
WHERE profile_id = 'd0000000-0000-4000-a000-000000000004' AND project_id = '00000000-0000-4000-b000-000000000001';

UPDATE memberships SET housing_preferences = '["4-kamer penthouse", "3-kamer appartement, 5e verdieping", "4-kamer maisonnette"]'::jsonb
WHERE profile_id = 'd0000000-0000-4000-a000-000000000005' AND project_id = '00000000-0000-4000-b000-000000000001';

-- Set housing_unit for the furthest-along members (phase 3+ complete)
UPDATE memberships SET housing_unit = 'A3.02' WHERE profile_id = 'd0000000-0000-4000-a000-000000000001' AND project_id = '00000000-0000-4000-b000-000000000001';
UPDATE memberships SET housing_unit = 'B1.04' WHERE profile_id = 'd0000000-0000-4000-a000-000000000002' AND project_id = '00000000-0000-4000-b000-000000000001';
UPDATE memberships SET housing_unit = 'A5.01' WHERE profile_id = 'd0000000-0000-4000-a000-000000000003' AND project_id = '00000000-0000-4000-b000-000000000001';
UPDATE memberships SET housing_unit = 'B0.02' WHERE profile_id = 'd0000000-0000-4000-a000-000000000004' AND project_id = '00000000-0000-4000-b000-000000000001';
UPDATE memberships SET housing_unit = 'A6.01' WHERE profile_id = 'd0000000-0000-4000-a000-000000000005' AND project_id = '00000000-0000-4000-b000-000000000001';


-- ═══════════════════════════════════════════════════════════════════════════
-- INTAKE QUESTIONS (Ledenwerving formulier)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO intake_questions (id, project_id, question_text, question_type, options, sort_order, required, active) VALUES
  ('d0000000-0000-4000-d100-000000000001', '00000000-0000-4000-b000-000000000001',
   'Wat is je huidige woonsituatie?', 'select',
   '["Huurwoning (sociaal)", "Huurwoning (vrije sector)", "Koopwoning", "Kamerbewoning", "Inwonend bij ouders/familie", "Anders"]'::jsonb,
   0, true, true),

  ('d0000000-0000-4000-d100-000000000002', '00000000-0000-4000-b000-000000000001',
   'In welk type woning ben je geinteresseerd?', 'radio',
   '["Koopwoning", "Huurwoning (sociaal)", "Huurwoning (vrije sector)", "Nog geen voorkeur"]'::jsonb,
   1, true, true),

  ('d0000000-0000-4000-d100-000000000003', '00000000-0000-4000-b000-000000000001',
   'Met hoeveel personen ga je wonen?', 'select',
   '["1 persoon", "2 personen", "3 personen", "4 personen", "5 of meer"]'::jsonb,
   2, true, true),

  ('d0000000-0000-4000-d100-000000000004', '00000000-0000-4000-b000-000000000001',
   'Wat is je maximale maandlast of koopbudget?', 'select',
   '["Tot EUR 1.000/maand", "EUR 1.000 - 1.500/maand", "EUR 1.500 - 2.000/maand", "Koopbudget tot EUR 300.000", "Koopbudget EUR 300.000 - 450.000", "Koopbudget EUR 450.000+"]'::jsonb,
   3, true, true),

  ('d0000000-0000-4000-d100-000000000005', '00000000-0000-4000-b000-000000000001',
   'Waarom wil je in een woongemeenschap wonen?', 'textarea', null,
   4, true, true),

  ('d0000000-0000-4000-d100-000000000006', '00000000-0000-4000-b000-000000000001',
   'Hoe heb je over ons gehoord?', 'select',
   '["Via een vriend/kennis", "Social media", "Krantenartikel", "Website/Google", "Bijeenkomst/event", "Anders"]'::jsonb,
   5, false, true),

  ('d0000000-0000-4000-d100-000000000007', '00000000-0000-4000-b000-000000000001',
   'Wat kun je bijdragen aan de gemeenschap? (vaardigheden, tijd, etc.)', 'textarea', null,
   6, false, true);


-- ═══════════════════════════════════════════════════════════════════════════
-- INTAKE RESPONSES (diverse statussen)
-- ═══════════════════════════════════════════════════════════════════════════

-- 5 Pending (nieuw)
INSERT INTO intake_responses (id, project_id, name, email, phone, answers, status, created_at) VALUES
  ('d0000000-0000-4000-d200-000000000001', '00000000-0000-4000-b000-000000000001',
   'Marieke van Hoorn', 'marieke.vanhoorn@gmail.com', '06-29384756',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Huurwoning (vrije sector)',
     'd0000000-0000-4000-d100-000000000002', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000003', '2 personen',
     'd0000000-0000-4000-d100-000000000004', 'Koopbudget EUR 300.000 - 450.000',
     'd0000000-0000-4000-d100-000000000005', 'We zoeken al een tijd naar een plek waar je echt je buren kent. Het idee van samen wonen spreekt ons erg aan.',
     'd0000000-0000-4000-d100-000000000006', 'Via een vriend/kennis'
   ), 'pending', now() - interval '2 days'),

  ('d0000000-0000-4000-d200-000000000002', '00000000-0000-4000-b000-000000000001',
   'Tom Akkerman', 'tom.akkerman@outlook.com', '06-11223344',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Kamerbewoning',
     'd0000000-0000-4000-d100-000000000002', 'Huurwoning (sociaal)',
     'd0000000-0000-4000-d100-000000000003', '1 persoon',
     'd0000000-0000-4000-d100-000000000004', 'Tot EUR 1.000/maand',
     'd0000000-0000-4000-d100-000000000005', 'Ik ben starter en zoek een betaalbare woning in een fijne gemeenschap.',
     'd0000000-0000-4000-d100-000000000006', 'Social media'
   ), 'pending', now() - interval '3 days'),

  ('d0000000-0000-4000-d200-000000000003', '00000000-0000-4000-b000-000000000001',
   'Priya Sharma', 'priya.sharma@hotmail.com', '06-55667788',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Huurwoning (sociaal)',
     'd0000000-0000-4000-d100-000000000002', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000003', '3 personen',
     'd0000000-0000-4000-d100-000000000004', 'Koopbudget tot EUR 300.000',
     'd0000000-0000-4000-d100-000000000005', 'Met twee kinderen zoek ik een veilige omgeving waar ze buiten kunnen spelen en andere kinderen ontmoeten.',
     'd0000000-0000-4000-d100-000000000006', 'Krantenartikel'
   ), 'pending', now() - interval '1 day'),

  ('d0000000-0000-4000-d200-000000000004', '00000000-0000-4000-b000-000000000001',
   'Wouter de Groot', 'wouter.degroot@gmail.com', null,
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000002', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000003', '2 personen',
     'd0000000-0000-4000-d100-000000000004', 'Koopbudget EUR 450.000+',
     'd0000000-0000-4000-d100-000000000005', 'We willen graag onze huidige koopwoning verruilen voor iets gemeenschappelijkers. De daktuin en gedeelde ruimtes zijn geweldig.'
   ), 'pending', now() - interval '5 days'),

  ('d0000000-0000-4000-d200-000000000005', '00000000-0000-4000-b000-000000000001',
   'Fatima el Amrani', 'fatima.elamrani@yahoo.com', '06-99887766',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Inwonend bij ouders/familie',
     'd0000000-0000-4000-d100-000000000002', 'Nog geen voorkeur',
     'd0000000-0000-4000-d100-000000000003', '1 persoon',
     'd0000000-0000-4000-d100-000000000004', 'EUR 1.000 - 1.500/maand',
     'd0000000-0000-4000-d100-000000000005', 'Op zoek naar mijn eerste eigen plek. De gemeenschap spreekt me aan omdat ik niet alleen wil wonen.',
     'd0000000-0000-4000-d100-000000000006', 'Bijeenkomst/event',
     'd0000000-0000-4000-d100-000000000007', 'Ik ben grafisch ontwerper en kan helpen met de nieuwsbrief en social media.'
   ), 'pending', now() - interval '1 day'),

-- 3 Invited
  ('d0000000-0000-4000-d200-000000000006', '00000000-0000-4000-b000-000000000001',
   'Sander Veldkamp', 'sander.veldkamp@gmail.com', '06-44556677',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Huurwoning (vrije sector)',
     'd0000000-0000-4000-d100-000000000002', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000003', '4 personen',
     'd0000000-0000-4000-d100-000000000004', 'Koopbudget EUR 300.000 - 450.000',
     'd0000000-0000-4000-d100-000000000005', 'Groot gezin, zoeken ruimte en gemeenschap voor de kinderen.'
   ), 'invited', now() - interval '14 days'),

  ('d0000000-0000-4000-d200-000000000007', '00000000-0000-4000-b000-000000000001',
   'Mei Lin Chen', 'meilin.chen@gmail.com', '06-33221100',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Kamerbewoning',
     'd0000000-0000-4000-d100-000000000002', 'Huurwoning (vrije sector)',
     'd0000000-0000-4000-d100-000000000003', '1 persoon',
     'd0000000-0000-4000-d100-000000000004', 'EUR 1.500 - 2.000/maand',
     'd0000000-0000-4000-d100-000000000005', 'Als expat zoek ik een sociale woonomgeving om sneller te integreren.'
   ), 'invited', now() - interval '10 days'),

  ('d0000000-0000-4000-d200-000000000008', '00000000-0000-4000-b000-000000000001',
   'Jan-Willem Bakker', 'jw.bakker@hotmail.com', '06-77889900',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000002', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000003', '2 personen',
     'd0000000-0000-4000-d100-000000000004', 'Koopbudget EUR 450.000+',
     'd0000000-0000-4000-d100-000000000005', 'Gepensioneerd stel, willen graag actief blijven in een gemeenschap.'
   ), 'invited', now() - interval '7 days'),

-- 4 Joined (doorgestroomd naar lid)
  ('d0000000-0000-4000-d200-000000000009', '00000000-0000-4000-b000-000000000001',
   'Rosa van der Linden', 'rosa.vd.linden@demo.buuur.nl', '06-12345627',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Huurwoning (vrije sector)',
     'd0000000-0000-4000-d100-000000000002', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000003', '2 personen',
     'd0000000-0000-4000-d100-000000000004', 'Koopbudget EUR 300.000 - 450.000',
     'd0000000-0000-4000-d100-000000000005', 'Samen met mijn partner op zoek naar ons eerste koophuis in een leuke gemeenschap.'
   ), 'joined', now() - interval '60 days'),

  ('d0000000-0000-4000-d200-000000000010', '00000000-0000-4000-b000-000000000001',
   'Milan Vos', 'milan.vos@demo.buuur.nl', '06-12345630',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Kamerbewoning',
     'd0000000-0000-4000-d100-000000000002', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000003', '1 persoon',
     'd0000000-0000-4000-d100-000000000004', 'Koopbudget tot EUR 300.000',
     'd0000000-0000-4000-d100-000000000005', 'Studio of klein appartement in een levendige woongemeenschap.'
   ), 'joined', now() - interval '55 days'),

  ('d0000000-0000-4000-d200-000000000011', '00000000-0000-4000-b000-000000000001',
   'Vera Molenaar', 'vera.molenaar@demo.buuur.nl', '06-12345631',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Huurwoning (sociaal)',
     'd0000000-0000-4000-d100-000000000002', 'Koopwoning',
     'd0000000-0000-4000-d100-000000000003', '2 personen',
     'd0000000-0000-4000-d100-000000000004', 'Koopbudget EUR 300.000 - 450.000',
     'd0000000-0000-4000-d100-000000000005', 'Mijn partner en ik dromen al lang van een maisonnette met gemeenschappelijke tuin.'
   ), 'joined', now() - interval '50 days'),

  ('d0000000-0000-4000-d200-000000000012', '00000000-0000-4000-b000-000000000001',
   'Bo Kuiper', 'bo.kuiper@demo.buuur.nl', '06-12345633',
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Huurwoning (vrije sector)',
     'd0000000-0000-4000-d100-000000000002', 'Huurwoning (vrije sector)',
     'd0000000-0000-4000-d100-000000000003', '1 persoon',
     'd0000000-0000-4000-d100-000000000004', 'EUR 1.000 - 1.500/maand',
     'd0000000-0000-4000-d100-000000000005', 'Zoek een huurwoning in een gemeenschap waar je niet anoniem bent.'
   ), 'joined', now() - interval '45 days'),

-- 2 Rejected
  ('d0000000-0000-4000-d200-000000000013', '00000000-0000-4000-b000-000000000001',
   'Test Persoon', 'test@test.com', null,
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000001', 'Anders',
     'd0000000-0000-4000-d100-000000000005', 'Test'
   ), 'rejected', now() - interval '30 days'),

  ('d0000000-0000-4000-d200-000000000014', '00000000-0000-4000-b000-000000000001',
   'Spam Bot', 'spam@example.com', null,
   jsonb_build_object(
     'd0000000-0000-4000-d100-000000000005', 'Buy cheap products at...'
   ), 'rejected', now() - interval '25 days');


-- ═══════════════════════════════════════════════════════════════════════════
-- Update project settings for intake
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE projects SET
  intake_enabled = true,
  intake_intro_text = 'Welkom bij ons CPO-woonproject op Centrumeiland! We bouwen samen een woongemeenschap van 110 woningen: koop, vrije sector huur en sociaal huur.

Vul dit formulier in om je interesse kenbaar te maken. Na ontvangst nemen we contact met je op voor een kennismakingsgesprek. Er is geen verplichting — we willen graag weten wie je bent en wat je zoekt.

Heb je vragen? Mail ons op info@demoproject.nl.'
WHERE id = '00000000-0000-4000-b000-000000000001';


-- Done!
DO $$ BEGIN RAISE NOTICE 'Phase 2 seed complete: 4 fases, 13 checklist stappen, 7 intake vragen, 14 intake responses.'; END $$;
