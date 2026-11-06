-- ============================================================================
-- Tests voor de beslislogica (migratie 112_decisions.sql)
--
-- Draaien (alles in een transactie die wordt teruggedraaid, laat niets achter):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/decision_outcome.test.sql
-- of plak de inhoud in de Supabase SQL Editor / execute_sql.
-- Een mislukte ASSERT breekt af met de naam van het testgeval.
-- ============================================================================
begin;

-- Hulpje: rules zoals de standaardwaarden van decision_rules
create temp table t_rules as select jsonb_build_object(
  'quorum_num', 2, 'quorum_den', 3,
  'majority_regular_num', 1, 'majority_regular_den', 2,
  'majority_heavy_num', 2, 'majority_heavy_den', 3,
  'formal_online_decisions', true) as r;

do $$
declare
  rules jsonb := (select r from t_rules);
  o jsonb;
begin
  -- A1. 18 huishoudens, quorum 2/3, 11 stemmen (7/3/1) → geen quorum
  o := decision_outcome('vote', rules, 18, '{"for":7,"against":3,"abstain":1}', false);
  assert o->>'status' = 'no_quorum', 'A1 verwacht no_quorum, kreeg ' || o::text;
  assert (o->>'quorum_required')::int = 12, 'A1 quorum_required moet 12 zijn';

  -- A2. 12 stemmen (8/3/1) → vastgesteld (8/11 > 50%)
  o := decision_outcome('vote', rules, 18, '{"for":8,"against":3,"abstain":1}', false);
  assert o->>'status' = 'adopted', 'A2 verwacht adopted, kreeg ' || o::text;
  assert o->>'summary' = 'Aangenomen, 8 voor, 3 tegen, 1 onthouding', 'A2 samenvatting: ' || (o->>'summary');

  -- A3. Zwaar besluit, 12 stemmen (7/4/1) → verworpen (7/11 < 2/3)
  o := decision_outcome('vote', rules, 18, '{"for":7,"against":4,"abstain":1}', true);
  assert o->>'status' = 'rejected', 'A3 verwacht rejected, kreeg ' || o::text;

  -- A4. Consent 14 akkoord, 0 bezwaar, quorum gehaald → vastgesteld
  o := decision_outcome('consent', rules, 18, '{"agree":14,"accept":0,"objection":0}', false);
  assert o->>'status' = 'adopted', 'A4 verwacht adopted, kreeg ' || o::text;

  -- A5. Consent met 1 bezwaar → aangepast
  o := decision_outcome('consent', rules, 18, '{"agree":13,"accept":0,"objection":1,"objection_open":1}', false);
  assert o->>'status' = 'amended', 'A5 verwacht amended, kreeg ' || o::text;

  -- Randgevallen ---------------------------------------------------------
  -- B1. Gewone meerderheid is strikt: 5 voor / 5 tegen → verworpen
  o := decision_outcome('vote', rules, 12, '{"for":5,"against":5,"abstain":0}', false);
  assert o->>'status' = 'rejected', 'B1 staken der stemmen moet verworpen zijn';

  -- B2. Zware meerderheid is inclusief: precies 2/3 (8 van 12) → aangenomen
  o := decision_outcome('vote', rules, 12, '{"for":8,"against":4,"abstain":0}', true);
  assert o->>'status' = 'adopted', 'B2 precies 2/3 moet aangenomen zijn';

  -- B3. Alleen onthoudingen, quorum gehaald → verworpen (niemand voor)
  o := decision_outcome('vote', rules, 9, '{"for":0,"against":0,"abstain":9}', false);
  assert o->>'status' = 'rejected', 'B3 alleen onthoudingen moet verworpen zijn';

  -- B4. Geen stemgerechtigden → nooit quorum
  o := decision_outcome('vote', rules, 0, '{"for":0,"against":0,"abstain":0}', false);
  assert o->>'status' = 'no_quorum', 'B4 lege groep moet no_quorum zijn';

  -- B5. Quorum exact op de grens: 2/3 van 18 = 12, 2/3 van 19 = 12,67 → 13
  o := decision_outcome('vote', rules, 19, '{"for":12,"against":0,"abstain":0}', false);
  assert o->>'status' = 'no_quorum', 'B5 19 eenheden vragen 13 reacties';
  o := decision_outcome('vote', rules, 19, '{"for":13,"against":0,"abstain":0}', false);
  assert o->>'status' = 'adopted', 'B5 13 van 19 is quorum';

  -- B6. Consent: onthouding-achtige "kan ermee leven" telt mee voor quorum
  o := decision_outcome('consent', rules, 18, '{"agree":6,"accept":6,"objection":0}', false);
  assert o->>'status' = 'adopted', 'B6 accept telt mee voor quorum';

  -- B7. Consent: bezwaar gepasseerd → vastgesteld, en zichtbaar in samenvatting
  o := decision_outcome('consent', rules, 18, '{"agree":13,"accept":0,"objection":1,"objection_open":0}', false);
  assert o->>'status' = 'adopted', 'B7 gepasseerd bezwaar moet vastgesteld zijn';
  assert o->>'summary' like '%1 bezwaar gepasseerd%', 'B7 samenvatting noemt gepasseerd bezwaar';

  -- B8. Consent zonder quorum, ook met bezwaar → geen quorum
  o := decision_outcome('consent', rules, 18, '{"agree":5,"accept":0,"objection":1}', false);
  assert o->>'status' = 'no_quorum', 'B8 geen quorum gaat voor bezwaar';

  -- B9. Voorbereidend als de statuten online besluiten niet toestaan
  o := decision_outcome('vote', rules || '{"formal_online_decisions": false}', 18, '{"for":12,"against":0,"abstain":0}', false);
  assert (o->>'preparatory')::boolean, 'B9 moet voorbereidend zijn';
  assert o->>'summary' like '%ALV%', 'B9 samenvatting noemt de ALV';

  -- B10. Peiling: niet bindend, status closed
  o := decision_outcome('poll', rules, 18, '{"a":3,"b":5}', false);
  assert o->>'status' = 'closed' and not (o->>'binding')::boolean, 'B10 peiling';

  -- B11. Andere quorumregel (1/2) en meervoud
  o := decision_outcome('vote', rules || '{"quorum_num":1,"quorum_den":2}', 10, '{"for":3,"against":0,"abstain":2}', false);
  assert o->>'status' = 'adopted', 'B11 quorum 1/2 van 10 = 5';
  assert o->>'summary' like '%2 onthoudingen%', 'B11 meervoud onthoudingen';

  raise notice 'decision_outcome: alle tests geslaagd';
end $$;

rollback;
