-- 09-migracion-propietario.sql
-- Agrega soporte para el rol "propietario" de plataforma (nivel sobre superadmin).
-- También agrega la columna es_propietario a profiles para designar co-propietarios.
-- Ejecutar en Supabase > SQL Editor (una sola vez).

-- ============================================================
-- 1. Agregar 'propietario' al CHECK de rol en profiles
--    (si existe la restricción, hay que recrearla)
-- ============================================================
DO $$
BEGIN
  -- Intentar agregar el valor al CHECK. En PostgreSQL no se puede ALTER CHECK directamente;
  -- hay que DROP + ADD.
  -- Primero identificamos si hay una constraint llamada profiles_rol_check o similar.
  -- La forma más segura es DROP IF EXISTS y recrear.
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_rol_check
    CHECK (rol IN ('propietario','superadmin','admin','delegado','lider','consulta','pendiente'));
END;
$$;

-- ============================================================
-- 2. Columna es_propietario en profiles
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS es_propietario BOOLEAN NOT NULL DEFAULT false;

-- El primer usuario con rol 'propietario' ya existente queda marcado automáticamente:
UPDATE profiles SET es_propietario = true WHERE rol = 'propietario';

-- ============================================================
-- 3. Función RPC: propietarios de plataforma
-- ============================================================
CREATE OR REPLACE FUNCTION get_propietarios()
RETURNS SETOF profiles
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT * FROM profiles WHERE es_propietario = true ORDER BY nombre;
$$;
