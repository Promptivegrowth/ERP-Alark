-- Migration: tighten_semanal_campos_rls
-- Date: 2026-05-12
-- Description:
--   La política original `pol_semanal_campos` permitía a CUALQUIER usuario
--   autenticado escribir en reporte_semanal_campos (FOR ALL USING(true)).
--   Ahora que existe el editor de campos semanales en Configuración (solo
--   admin) y el rol SUPERVISOR (solo lectura), endurecemos:
--     - SELECT: abierto (el formulario semanal del comedor necesita leer
--       sus campos).
--     - INSERT / UPDATE / DELETE: solo ADMIN.

DROP POLICY IF EXISTS pol_semanal_campos ON reporte_semanal_campos;

CREATE POLICY pol_semanal_campos_read ON reporte_semanal_campos
  FOR SELECT USING (true);

CREATE POLICY pol_semanal_campos_admin_write ON reporte_semanal_campos
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'))
  WITH CHECK (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
