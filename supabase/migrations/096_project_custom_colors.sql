-- ============================================================================
-- 096_project_custom_colors.sql
-- Custom kleurthema voor projecten: wanneer projects.color_theme = 'custom'
-- bevat deze jsonb-kolom het volledige palet (primary/secondary/accent/
-- muted/background/text), dezelfde vorm als de ingebouwde presets.
-- De publieke pagina leest dit palet i.p.v. de preset-map.
-- ============================================================================

alter table projects
  add column if not exists custom_colors jsonb default null;

comment on column projects.custom_colors is
  'Custom kleurpalet (jsonb) gebruikt wanneer color_theme = ''custom''. Vorm: {primary,secondary,accent,muted,background,text}.';
