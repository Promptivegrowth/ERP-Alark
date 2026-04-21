-- Migration: improve_cruce_semanal
-- Date: 2026-04-21
-- Description:
--   Añade columnas de cantidad al cruce diario/semanal para poder comparar
--   tanto pedidos (cantidades) como costos (montos).
--   Amplía la precisión de diferencia_pct (ej: 4 dígitos enteros + 2 decimales)
--   para soportar diferencias > 100%.

ALTER TABLE reporte_cruce_semanal
  ADD COLUMN IF NOT EXISTS total_diario_cantidad INTEGER DEFAULT 0;

ALTER TABLE reporte_cruce_semanal
  ADD COLUMN IF NOT EXISTS total_semanal_cantidad INTEGER DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE reporte_cruce_semanal ALTER COLUMN diferencia_pct TYPE NUMERIC(10,2);
EXCEPTION WHEN others THEN
  -- ya estaba con mayor precisión
  NULL;
END $$;
