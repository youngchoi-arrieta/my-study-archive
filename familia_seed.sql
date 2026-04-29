-- ============================================================
--  Familia Choi · Arrieta — Supabase Setup
--  Run this in Supabase SQL Editor (one shot)
-- ============================================================

-- ── Tables ────────────────────────────────────────────────

create table if not exists familia_scenarios (
  id          uuid primary key default gen_random_uuid(),
  label_en    text not null,
  label_es    text not null,
  color       text not null default 'gray',
  sort_order  int  not null default 0,
  created_at  timestamptz default now()
);

create table if not exists familia_items (
  id          uuid primary key default gen_random_uuid(),
  phase_key   text not null,
  category    text not null,
  scenario_id uuid references familia_scenarios(id) on delete cascade,
  text_en     text not null default '',
  text_es     text not null default '',
  completed   boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz default now()
);

-- ── Phase 3 Scenarios ────────────────────────────────────

insert into familia_scenarios (id, label_en, label_es, color, sort_order) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '🟢 Korea Works',        '🟢 Corea Funciona',      'green',  0),
  ('aaaaaaaa-0000-0000-0000-000000000002', '🟡 Korea is Tolerable', '🟡 Corea es Tolerable',  'yellow', 1),
  ('aaaaaaaa-0000-0000-0000-000000000003', '🔴 Korea Doesn''t Work','🔴 Corea No Funciona',   'red',    2);

-- ── Meta: Core Goals ─────────────────────────────────────

insert into familia_items (phase_key, category, text_en, text_es, sort_order) values
  ('meta', 'main_goal', 'Being together',
   'Estar juntos', 0),
  ('meta', 'main_goal', 'Reducing anxiety and regulating the nervous system',
   'Reducir la ansiedad y regular el sistema nervioso', 1),
  ('meta', 'main_goal', 'Regaining energy',
   'Recuperar energía', 2),
  ('meta', 'main_goal', 'Gradually rebuilding professional life',
   'Reconstruir gradualmente la vida profesional', 3);

-- ── Meta: Financial ──────────────────────────────────────

insert into familia_items (phase_key, category, text_en, text_es, sort_order) values
  ('meta', 'financial',
   'Korea Fund — 3 months of living expenses + initial setup + Lucy''s flight tickets',
   'Fondo Corea — 3 meses de gastos de vida + setup inicial + tiquetes de Lucy', 0),
  ('meta', 'financial',
   'Untouchable / Exit Fund — backup in case of emergency or change of plan. Must not be touched.',
   'Fondo Intocable / Salida — reserva para emergencias o cambio de plan. No tocar bajo ninguna circunstancia.', 1);

-- ── Phase 1: Preparation (May – July) ────────────────────

-- Young
insert into familia_items (phase_key, category, text_en, text_es, sort_order) values
  ('phase1', 'young', 'Rest at his mother''s house',
   'Descansar en casa de su madre', 0),
  ('phase1', 'young', 'Study Japanese + prepare for the electrician exam in Japan',
   'Estudiar japonés + prepararse para el examen de electricista en Japón', 1),
  ('phase1', 'young', 'Maintain physical activity',
   'Mantener actividad física', 2),
  ('phase1', 'young', 'Take first exam in Japan and explore the country',
   'Presentar el primer examen en Japón y explorar el país', 3),
  ('phase1', 'young', 'Explore job opportunities in Busan or another city (academies, math in English, etc.)',
   'Explorar oportunidades laborales en Busan u otra ciudad (academias, matemáticas en inglés, etc.)', 4),
  ('phase1', 'young', 'Travel to India',
   'Viajar a India', 5);

-- Lucy
insert into familia_items (phase_key, category, text_en, text_es, sort_order) values
  ('phase1', 'lucy', 'No pressure to work',
   'Sin presión de trabajar', 0),
  ('phase1', 'lucy', 'Study English + psychiatry (at least 30 min/day each)',
   'Estudiar inglés + psiquiatría (al menos 30 min/día cada uno)', 1),
  ('phase1', 'lucy', 'Organize documents and prepare for moving to South Korea',
   'Organizar documentos y prepararse para mudarse a Corea del Sur', 2),
  ('phase1', 'lucy', 'Focus on reducing anxiety',
   'Enfocarse en reducir la ansiedad', 3);

-- Together
insert into familia_items (phase_key, category, text_en, text_es, sort_order) values
  ('phase1', 'couple', 'Define how Lucy will enter Korea (spouse visa, or tourist → student visa)',
   'Definir cómo entrará Lucy a Corea (visa de cónyuge, o turista → visa de estudiante)', 0),
  ('phase1', 'couple', 'Set a tentative reunion date',
   'Establecer una fecha tentativa de reencuentro', 1),
  ('phase1', 'couple', 'No definitive long-term migration decisions yet',
   'Aún no tomar decisiones definitivas de migración a largo plazo', 2);

-- ── Phase 2: Reunion in Korea (Aug – Dec) ────────────────

-- Young
insert into familia_items (phase_key, category, text_en, text_es, sort_order) values
  ('phase2', 'young', 'Continue job exploration and begin working (academies, tutoring, electrician)',
   'Continuar buscando trabajo y comenzar a trabajar (academias, tutorías, electricidad)', 0),
  ('phase2', 'young', 'Continue studying Japanese without extreme pressure',
   'Continuar estudiando japonés sin presión extrema', 1);

-- Lucy
insert into familia_items (phase_key, category, text_en, text_es, sort_order) values
  ('phase2', 'lucy', '[First 2 months] Focus on real rest and adapt to the environment',
   '[Primeros 2 meses] Enfocarse en descanso real y adaptarse al entorno', 0),
  ('phase2', 'lucy', '[First 2 months] Build a soft routine',
   '[Primeros 2 meses] Construir una rutina suave', 1),
  ('phase2', 'lucy', '[If improving] Gradually add activities: Spanish teaching, online psychiatric consultations',
   '[Si hay mejoría] Agregar actividades gradualmente: clases de español, consultas psiquiátricas online', 2);

-- Together
insert into familia_items (phase_key, category, text_en, text_es, sort_order) values
  ('phase2', 'couple', 'Treat this phase as a temporary project — not a final life decision',
   'Abordar esta fase como un proyecto temporal, no una decisión de vida definitiva', 0),
  ('phase2', 'couple', 'Evaluate the real experience in Korea together',
   'Evaluar juntos la experiencia real en Corea', 1),
  ('phase2', 'couple', 'Goal: basic stability, not success',
   'Meta: estabilidad básica, no éxito', 2);

-- ── Phase 3: Decision Scenarios ──────────────────────────

insert into familia_items (phase_key, category, scenario_id, text_en, text_es, sort_order) values
  -- 🟢 Korea Works
  ('phase3', 'scenario', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Stay longer in Korea',
   'Quedarse más tiempo en Corea', 0),
  ('phase3', 'scenario', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Young stabilizes work',
   'Young estabiliza el trabajo', 1),
  ('phase3', 'scenario', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Lucy gradually resumes professional activity',
   'Lucy retoma gradualmente la actividad profesional', 2),

  -- 🟡 Korea is Tolerable
  ('phase3', 'scenario', 'aaaaaaaa-0000-0000-0000-000000000002',
   'Stay until completing the planned period',
   'Quedarse hasta completar el período planeado', 0),
  ('phase3', 'scenario', 'aaaaaaaa-0000-0000-0000-000000000002',
   'Prepare next step: Japan or Australia',
   'Preparar el siguiente paso: Japón o Australia', 1),

  -- 🔴 Korea Doesn't Work
  ('phase3', 'scenario', 'aaaaaaaa-0000-0000-0000-000000000003',
   'Option A — Argentina: Lucy works, Young reorganizes his professional path',
   'Opción A — Argentina: Lucy trabaja, Young reorganiza su camino profesional', 0),
  ('phase3', 'scenario', 'aaaaaaaa-0000-0000-0000-000000000003',
   'Option B — Canada: both start fresh in a neutral environment',
   'Opción B — Canadá: ambos empiezan de nuevo en un entorno neutral', 1);

-- ── Core Agreement ───────────────────────────────────────

insert into familia_items (phase_key, category, text_en, text_es, sort_order) values
  ('meta', 'core_agreement',
   '"We will not remain in a place that is harming one of us just to sustain the plan."',
   '"No permaneceremos en un lugar que esté dañando a uno de nosotros solo para sostener el plan."',
   0);
