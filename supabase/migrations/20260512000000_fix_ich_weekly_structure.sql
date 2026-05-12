-- Migration: fix_ich_weekly_structure
-- Date: 2026-05-12
-- Description:
--   La estructura semanal de ICH (reporte_semanal_campos) se había sembrado
--   inicialmente con una plantilla genérica de la spec (ALMUERZO, CENA,
--   PANES, BEBIDAS, CAFÉ, JUGO, POSTRE, etc.) que no refleja cómo ICH reporta
--   realmente. Su reporte diario (comedor_campos_reporte) usa el desglose por
--   SISTEMA / INVITADOS / VIGILANCIA / YAPE para almuerzos y cenas, por lo que
--   el semanal no cuadraba 1 a 1 con el diario.
--
--   Esta migración alinea el semanal de ICH al diario:
--     - Desactiva los 15 campos semanales viejos (no se borran: se preservan
--       sus valores históricos; simplemente no aparecen en el formulario).
--     - Inserta la nueva estructura espejo del diario + extras (Coffe Break,
--       Loncheras Dobles).

DO $$
DECLARE id_ich UUID;
BEGIN
  SELECT id INTO id_ich FROM comedores WHERE codigo = 'ICH-01';
  IF id_ich IS NULL THEN RETURN; END IF;

  -- 1. Desactivar estructura semanal vieja (preserva historial)
  UPDATE reporte_semanal_campos SET activo = false WHERE comedor_id = id_ich;

  -- 2. Insertar nueva estructura alineada con el reporte diario
  INSERT INTO reporte_semanal_campos
    (comedor_id, nombre_campo, seccion, precio_ref, precio_editable, activo, orden, es_facturable, categoria_cruce)
  VALUES
    (id_ich, 'ALMUERZOS SISTEMA',    'CREDITO ICH',       12.50, true, true, 1,  true, 'ALMUERZO'),
    (id_ich, 'ALMUERZOS INVITADOS',  'INVITADOS',         12.50, true, true, 2,  true, 'ALMUERZO'),
    (id_ich, 'ALMUERZOS VIGILANCIA', 'CREDITO ICH',       12.50, true, true, 3,  true, 'ALMUERZO'),
    (id_ich, 'ALMUERZO YAPE',        'CONTADOS',          12.50, true, true, 4,  true, 'ALMUERZO'),
    (id_ich, 'ALMUERZO ALCONTADO',   'CONTADOS',          12.50, true, true, 5,  true, 'ALMUERZO'),
    (id_ich, 'CENAS SISTEMA',        'CREDITO ICH',       12.50, true, true, 6,  true, 'CENA'),
    (id_ich, 'CENAS INVITADOS',      'INVITADOS',         12.50, true, true, 7,  true, 'CENA'),
    (id_ich, 'CENAS VIGILANCIA',     'CREDITO ICH',       12.50, true, true, 8,  true, 'CENA'),
    (id_ich, 'COFFE BREAK',          'SERVICIO ESPECIAL', 1.00,  true, true, 9,  true, NULL),
    (id_ich, 'LONCHERAS DOBLES',     'LONCHERAS',         27.50, true, true, 10, true, NULL)
  ON CONFLICT (comedor_id, nombre_campo) DO UPDATE SET
    seccion         = EXCLUDED.seccion,
    precio_ref      = EXCLUDED.precio_ref,
    precio_editable = EXCLUDED.precio_editable,
    activo          = true,
    orden           = EXCLUDED.orden,
    es_facturable   = EXCLUDED.es_facturable,
    categoria_cruce = EXCLUDED.categoria_cruce;
END $$;
