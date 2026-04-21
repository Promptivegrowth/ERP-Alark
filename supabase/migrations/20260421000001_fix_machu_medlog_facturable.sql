-- Migration: fix_machu_medlog_facturable
-- Date: 2026-04-21
-- Description:
--   Ajusta los flags es_facturable y categoria_cruce de los campos semanales
--   de MACHU PICCHU y MEDLOG para que coincidan con la regla de negocio:
--     - Machu Picchu: el CONSUMIDO es lo que cuenta en total / cruce.
--     - Medlog: los TICKETS son lo que cuenta en total / cruce.
--   Los SOLICITADOS (Machu), QUEBRADOS (Machu) y SISTEMA (Medlog) se conservan
--   como campos informativos: se muestran y permiten registrar cantidad y
--   precio, pero no suman al total facturable ni al cruce.

-- ===== MACHU PICCHU =====
UPDATE reporte_semanal_campos
   SET es_facturable = true
 WHERE comedor_id = (SELECT id FROM comedores WHERE codigo = 'MAC-01')
   AND UPPER(nombre_campo) LIKE '%CONSUMIDO%';

UPDATE reporte_semanal_campos
   SET es_facturable = false
 WHERE comedor_id = (SELECT id FROM comedores WHERE codigo = 'MAC-01')
   AND UPPER(nombre_campo) LIKE '%SOLICITADO%';

-- ===== MEDLOG =====
UPDATE reporte_semanal_campos
   SET es_facturable = true,
       categoria_cruce = 'ALMUERZO'
 WHERE comedor_id = (SELECT id FROM comedores WHERE codigo = 'MED-01')
   AND UPPER(nombre_campo) = 'ALMUERZOS TICKETS';

UPDATE reporte_semanal_campos
   SET es_facturable = true,
       categoria_cruce = 'CENA'
 WHERE comedor_id = (SELECT id FROM comedores WHERE codigo = 'MED-01')
   AND UPPER(nombre_campo) = 'CENAS TICKETS';

UPDATE reporte_semanal_campos
   SET es_facturable = false,
       categoria_cruce = NULL
 WHERE comedor_id = (SELECT id FROM comedores WHERE codigo = 'MED-01')
   AND UPPER(nombre_campo) LIKE '%SISTEMA%';
