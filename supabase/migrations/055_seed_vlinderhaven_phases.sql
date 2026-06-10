-- Seed checklist fasen en stappen voor Vlinderhaven
DO $$
DECLARE
  v_project_id UUID;
  v_phase1_id UUID;
  v_phase2_id UUID;
  v_phase3_id UUID;
  v_phase4_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'vlinderhaven' LIMIT 1;
  IF v_project_id IS NULL THEN
    RAISE NOTICE 'Project vlinderhaven niet gevonden, overgeslagen';
    RETURN;
  END IF;

  -- Fase 1: Voorkeursfase
  INSERT INTO checklist_phases (id, project_id, title, description, color, sort_order)
  VALUES (gen_random_uuid(), v_project_id, 'Voorkeursfase', 'Woningvoorkeur doorgeven en toewijzing', '#3b82f6', 0)
  RETURNING id INTO v_phase1_id;

  INSERT INTO checklist_templates (project_id, phase_id, title, sort_order) VALUES
    (v_project_id, v_phase1_id, 'Public Twin account aangemaakt', 0),
    (v_project_id, v_phase1_id, '3 voorkeuren doorgegeven', 1),
    (v_project_id, v_phase1_id, 'Puntentoewijzing', 2),
    (v_project_id, v_phase1_id, 'Woning toegewezen', 3);

  -- Fase 2: Reserveringsfase
  INSERT INTO checklist_phases (id, project_id, title, description, color, sort_order)
  VALUES (gen_random_uuid(), v_project_id, 'Reserveringsfase', 'Reserveringsovereenkomst tekenen en betalen', '#f59e0b', 1)
  RETURNING id INTO v_phase2_id;

  INSERT INTO checklist_templates (project_id, phase_id, title, sort_order) VALUES
    (v_project_id, v_phase2_id, 'Reserveringsovereenkomst verstuurd', 0),
    (v_project_id, v_phase2_id, 'Ondertekend (binnen 7 dagen)', 1),
    (v_project_id, v_phase2_id, 'Betaald (binnen 5 dagen)', 2);

  -- Fase 3: Voorlopige koopfase (geen stappen — fase zelf is de stap)
  INSERT INTO checklist_phases (id, project_id, title, color, sort_order)
  VALUES (gen_random_uuid(), v_project_id, 'Voorlopige koopfase', '#f97316', 2)
  RETURNING id INTO v_phase3_id;

  -- Fase 4: Koopfase (geen stappen — fase zelf is de stap)
  INSERT INTO checklist_phases (id, project_id, title, color, sort_order)
  VALUES (gen_random_uuid(), v_project_id, 'Koopfase', '#22c55e', 3)
  RETURNING id INTO v_phase4_id;

  RAISE NOTICE 'Vlinderhaven fasen aangemaakt: %, %, %, %', v_phase1_id, v_phase2_id, v_phase3_id, v_phase4_id;
END $$;
