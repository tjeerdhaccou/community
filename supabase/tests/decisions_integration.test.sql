-- ============================================================================
-- Integratietest besluitvorming (migraties 112 + 113)
-- Simuleert vier gebruikers (twee in één huishouden, één aspirant) en loopt
-- concept → publiceren → reageren → deadline → sluiten door. Draait in een
-- transactie met ROLLBACK: laat niets achter (ook de pg_net-pokes niet).
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/decisions_integration.test.sql
-- of via de Supabase MCP (execute_sql). Laatste regel moet 'INTEGRATIE OK' zijn.
-- ============================================================================
begin;
create temp table t_ids (k text primary key, id uuid);
grant all on t_ids to authenticated;
do $$
declare
  v_org uuid; v_proj uuid; v_hh uuid; v_wg uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid(); u4 uuid := gen_random_uuid();
begin
  insert into auth.users(id, email, aud, role, instance_id) values
    (u1,'t1@test.invalid','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
    (u2,'t2@test.invalid','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
    (u3,'t3@test.invalid','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
    (u4,'t4@test.invalid','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
  insert into profiles(id, full_name) values (u1,'Anna'),(u2,'Bert'),(u3,'Cor'),(u4,'Dirk') on conflict (id) do update set full_name = excluded.full_name;
  insert into organizations(name, slug) values ('Testorg', 'testorg-'||left(gen_random_uuid()::text,8)) returning id into v_org;
  insert into projects(organization_id, name, slug, features) values (v_org, 'Testproject', 'tp-'||left(gen_random_uuid()::text,8), '{"decisions": true}') returning id into v_proj;
  insert into households(project_id, name) values (v_proj, 'Familie Test') returning id into v_hh;
  insert into memberships(profile_id, project_id, role, household_id) values
    (u1, v_proj, 'member', v_hh), (u2, v_proj, 'member', v_hh), (u3, v_proj, 'member', null), (u4, v_proj, 'aspirant', null);
  insert into workgroups(project_id, name, type) values (v_proj, 'Bouwcommissie', 'commissie') returning id into v_wg;
  insert into workgroup_members(profile_id, workgroup_id) values (u1, v_wg);
  insert into t_ids values ('u1',u1),('u2',u2),('u3',u3),('u4',u4),('proj',v_proj),('wg',v_wg),('hh',v_hh);
end $$;

-- Anna (commissielid): concept + publiceren
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',(select id from t_ids where k='u1'),'role','authenticated')::text, true);
do $$
declare v_id uuid; p proposals; ok boolean;
begin
  insert into proposals(project_id, form, workgroup_id, title, summary, member_impact)
  values ((select id from t_ids where k='proj'), 'vote', (select id from t_ids where k='wg'),
          'Keuze aannemer', 'We kiezen aannemer X.', 'Kosten 500 euro per huishouden.')
  returning id into v_id;
  insert into t_ids values ('prop', v_id);
  p := publish_proposal(v_id);
  assert p.status = 'published', 'I1 publiceren';
  assert p.electorate_size = 2, 'I2 kiezersbestand 2 eenheden; kreeg ' || p.electorate_size;
  ok := false;
  begin update proposals set title = 'Anders' where id = v_id; exception when others then ok := true; end;
  assert ok, 'I3 gepubliceerd voorstel mag niet bewerkt worden';
  perform cast_response(v_id, 'for');
end $$;

-- Bert (zelfde huishouden) ziet en wijzigt de stem van het huishouden
select set_config('request.jwt.claims', json_build_object('sub',(select id from t_ids where k='u2'),'role','authenticated')::text, true);
do $$
declare v_id uuid := (select id from t_ids where k='prop'); t jsonb; n int;
begin
  t := proposal_tally(v_id);
  assert t->'my_unit'->>'choice' = 'for', 'I4 u2 ziet de stem van het huishouden: ' || t::text;
  assert t->'my_unit'->>'responded_by_name' = 'Anna', 'I5 toont wie namens het huishouden reageerde';
  perform cast_response(v_id, 'against');
  t := proposal_tally(v_id);
  assert t->'my_unit'->>'choice' = 'against', 'I6 laatste reactie telt';
  assert (t->>'responded')::int = 1, 'I7 nog steeds 1 eenheid gereageerd';
  select count(*) into n from proposal_response_log where proposal_id = v_id;
  assert n = 2, 'I8 beide reacties in de historie, kreeg ' || n;
end $$;

-- Dirk (aspirant) is niet stemgerechtigd en ziet geen reacties van anderen
select set_config('request.jwt.claims', json_build_object('sub',(select id from t_ids where k='u4'),'role','authenticated')::text, true);
do $$
declare ok boolean := false; n int;
begin
  begin perform cast_response((select id from t_ids where k='prop'), 'for');
  exception when others then ok := sqlerrm like '%niet stemgerechtigd%'; end;
  assert ok, 'I9 aspirant is niet stemgerechtigd';
  select count(*) into n from proposal_responses;
  assert n = 0, 'I9b aspirant ziet geen reacties van anderen, kreeg ' || n;
end $$;

-- Cor stemt voor
select set_config('request.jwt.claims', json_build_object('sub',(select id from t_ids where k='u3'),'role','authenticated')::text, true);
do $$
declare t jsonb; ok boolean := false;
begin
  perform cast_response((select id from t_ids where k='prop'), 'for');
  t := proposal_tally((select id from t_ids where k='prop'));
  assert (t->>'quorum_met')::boolean, 'I10 quorum gehaald (2 van 2)';
  assert t->'projection'->>'status' = 'rejected', 'I11 1 voor 1 tegen = verworpen: ' || t::text;
  begin perform * from proposal_pending_units((select id from t_ids where k='prop'));
  exception when others then ok := true; end;
  assert ok, 'I12 gewoon lid ziet niet wie nog niet reageerde';
end $$;

-- Deadline verstrijkt, cron sluit
reset role;
do $$
declare v_id uuid := (select id from t_ids where k='prop'); p proposals;
begin
  perform decisions_rpc_on();
  update proposals set deadline = now() - interval '1 minute' where id = v_id;
  perform close_due_proposals();
  select * into p from proposals where id = v_id;
  assert p.status = 'rejected', 'I13 gesloten met uitkomst verworpen, kreeg ' || p.status;
  assert p.outcome->>'summary' like 'Verworpen, 1 voor, 1 tegen, 0 onthoudingen%', 'I14 samenvatting: ' || (p.outcome->>'summary');
  assert exists (select 1 from proposal_events where proposal_id = v_id and type = 'proposal_closed'), 'I15 sluit-notificatie in wachtrij';
  assert exists (select 1 from decision_log where id = v_id), 'I16 staat in de besluitenlijst';
end $$;

-- Reageren na de deadline wordt geweigerd
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',(select id from t_ids where k='u3'),'role','authenticated')::text, true);
do $$
declare ok boolean := false;
begin
  begin perform cast_response((select id from t_ids where k='prop'), 'against');
  exception when others then ok := sqlerrm like '%reactietermijn is verlopen%'; end;
  assert ok, 'I17 reactie na deadline geweigerd';
end $$;
reset role;
select 'INTEGRATIE OK' as result;
rollback;
