-- 08-migracion-portafolios-programas.sql
-- Agrega las tablas portafolios y programas para la jerarquía empresa → portafolio → programa → proyecto.
-- También agrega portafolio_id y programa_id a proyectos.
-- Ejecutar en Supabase > SQL Editor (una sola vez).

-- ============================================================
-- 1. portafolios
-- ============================================================
CREATE TABLE IF NOT EXISTS portafolios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id         UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  codigo          TEXT,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  responsable_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  estado          TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_portafolios_updated_at
  BEFORE UPDATE ON portafolios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE portafolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_portafolios" ON portafolios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. programas
-- ============================================================
CREATE TABLE IF NOT EXISTS programas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id         UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  portafolio_id   UUID REFERENCES portafolios(id) ON DELETE SET NULL,
  codigo          TEXT,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  responsable_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  estado          TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_programas_updated_at
  BEFORE UPDATE ON programas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE programas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_programas" ON programas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Columnas en proyectos
-- ============================================================
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS portafolio_id UUID REFERENCES portafolios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS programa_id   UUID REFERENCES programas(id)   ON DELETE SET NULL;
