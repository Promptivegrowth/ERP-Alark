-- Migration: add_supervisor_role
-- Date: 2026-04-21
-- Description:
--   Agrega un nuevo rol SUPERVISOR con acceso SOLO LECTURA a todas las tablas
--   del admin. El supervisor puede ver información y descargar reportes, pero
--   no puede insertar, actualizar ni borrar nada.

-- 1. Extender el CHECK constraint
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('ADMIN','COMEDOR','SUPERVISOR'));

-- 2. Helper function usada por las policies de lectura
CREATE OR REPLACE FUNCTION is_admin_or_supervisor() RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM usuarios
       WHERE id = auth.uid()
         AND rol IN ('ADMIN','SUPERVISOR')
    )
$$;

-- 3. Policies FOR SELECT para supervisor (se suman a las existentes admin_all_*)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS supervisor_read_%I ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY supervisor_read_%I ON %I FOR SELECT USING (is_admin_or_supervisor())',
      t, t
    );
  END LOOP;
END $$;
