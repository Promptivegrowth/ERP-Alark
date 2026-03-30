-- Seed: Insert comedor field configurations for all 17 comedores
-- Run after the migration that creates comedor_campos_reporte and updates comedor names

-- Helper: get comedor ID by code and insert fields
DO $$
DECLARE
  id_ransa UUID;
  id_ich UUID;
  id_fadesa UUID;
  id_fitesa UUID;
  id_fundicion UUID;
  id_machu UUID;
  id_medlog UUID;
  id_metalpren UUID;
  id_molicentro UUID;
  id_sanJorge UUID;
  id_tecsur UUID;
  id_volcan UUID;
  id_pamolsa UUID;
  id_tottus_cdf UUID;
  id_gci UUID;
  id_tottus_cds UUID;
  id_tottus_ppa UUID;
BEGIN
  SELECT id INTO id_ransa FROM comedores WHERE codigo = 'RAN-01';
  SELECT id INTO id_ich FROM comedores WHERE codigo = 'ICH-01';
  SELECT id INTO id_fadesa FROM comedores WHERE codigo = 'FAD-01';
  SELECT id INTO id_fitesa FROM comedores WHERE codigo = 'FIT-01';
  SELECT id INTO id_fundicion FROM comedores WHERE codigo = 'FUN-01';
  SELECT id INTO id_machu FROM comedores WHERE codigo = 'MAC-01';
  SELECT id INTO id_medlog FROM comedores WHERE codigo = 'MED-01';
  SELECT id INTO id_metalpren FROM comedores WHERE codigo = 'MET-01';
  SELECT id INTO id_molicentro FROM comedores WHERE codigo = 'MOL-01';
  SELECT id INTO id_sanJorge FROM comedores WHERE codigo = 'SJO-01';
  SELECT id INTO id_tecsur FROM comedores WHERE codigo = 'TEC-01';
  SELECT id INTO id_volcan FROM comedores WHERE codigo = 'VOL-01';
  SELECT id INTO id_pamolsa FROM comedores WHERE codigo = 'PAM-01';
  SELECT id INTO id_tottus_cdf FROM comedores WHERE codigo = 'TOT-01';
  SELECT id INTO id_gci FROM comedores WHERE codigo = 'GCI-01';
  SELECT id INTO id_tottus_cds FROM comedores WHERE codigo = 'TOT-02';
  SELECT id INTO id_tottus_ppa FROM comedores WHERE codigo = 'TOT-03';

  -- ===== RANSA =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_ransa, 'PAN',            'PAN',      1),
    (id_ransa, 'BEBIDAS',        'BEBIDA',   2),
    (id_ransa, 'VALES DESAYUNO', 'DESAYUNO', 3),
    (id_ransa, 'ALM OTROS',      'ALMUERZO', 4),
    (id_ransa, 'ALM MANPOWER',   'ALMUERZO', 5),
    (id_ransa, 'ALM CONTADOS',   'ALMUERZO', 6),
    (id_ransa, 'ALM YAPES',      'ALMUERZO', 7),
    (id_ransa, 'CENA SISTEMA',   'CENA',     8),
    (id_ransa, 'CENA OTROS',     'CENA',     9)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== ICH =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_ich, 'ALMUERZOS SISTEMA',    'ALMUERZO', 1),
    (id_ich, 'ALMUERZOS INVITADOS',  'ALMUERZO', 2),
    (id_ich, 'ALMUERZOS VIGILANCIA', 'ALMUERZO', 3),
    (id_ich, 'CENAS SISTEMA',        'CENA',     4),
    (id_ich, 'CENAS INVITADOS',      'CENA',     5),
    (id_ich, 'CENAS VIGILANCIA',     'CENA',     6)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== FADESA =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_fadesa, 'ALMUERZOS SISTEMA',   'ALMUERZO', 1),
    (id_fadesa, 'ALMUERZOS INVITADOS', 'ALMUERZO', 2),
    (id_fadesa, 'ALMUERZOS OTROS',     'ALMUERZO', 3),
    (id_fadesa, 'CENAS SISTEMA',       'CENA',     4),
    (id_fadesa, 'CENAS INVITADOS',     'CENA',     5),
    (id_fadesa, 'CENAS OTROS',         'CENA',     6)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== FITESA =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_fitesa, 'DESAYUNOS SISTEMA',  'DESAYUNO',  1),
    (id_fitesa, 'DESAYUNOS OTROS',    'DESAYUNO',  2),
    (id_fitesa, 'ALMUERZOS SISTEMA',  'ALMUERZO',  3),
    (id_fitesa, 'ALMUERZOS OTROS',    'ALMUERZO',  4),
    (id_fitesa, 'CENAS SISTEMA',      'CENA',      5),
    (id_fitesa, 'CENAS OTROS',        'CENA',      6),
    (id_fitesa, 'AMANECIDAS SISTEMA', 'AMANECIDA', 7),
    (id_fitesa, 'AMANECIDAS OTROS',   'AMANECIDA', 8)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== FUNDICION =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_fundicion, 'DESAYUNOS SISTEMA',       'DESAYUNO', 1),
    (id_fundicion, 'ALMUERZOS SISTEMA',       'ALMUERZO', 2),
    (id_fundicion, 'ALMUERZOS VIGILANTES',    'ALMUERZO', 3),
    (id_fundicion, 'ALMUERZOS ENFERMERAS',    'ALMUERZO', 4),
    (id_fundicion, 'ALMUERZOS OTROS',         'ALMUERZO', 5),
    (id_fundicion, 'CENAS',                   'CENA',     6),
    (id_fundicion, 'CENAS OTROS',             'CENA',     7),
    (id_fundicion, 'LONCHES',                 'LONCHE',   8)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== MACHU PICCHU (QUEBRADO = readonly, computed) =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden, es_readonly, formula) VALUES
    (id_machu, 'ALMUERZOS SOLICITADOS', 'ALMUERZO', 1,  false, NULL),
    (id_machu, 'ALMUERZOS CONSUMIDOS',  'ALMUERZO', 2,  false, NULL),
    (id_machu, 'ALMUERZOS QUEBRADO',    'ALMUERZO', 3,  true,  'SOLICITADOS - CONSUMIDOS'),
    (id_machu, 'CENAS SOLICITADOS',     'CENA',     4,  false, NULL),
    (id_machu, 'CENAS CONSUMIDOS',      'CENA',     5,  false, NULL),
    (id_machu, 'CENAS QUEBRADO',        'CENA',     6,  true,  'SOLICITADOS - CONSUMIDOS')
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== MEDLOG =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_medlog, 'ALMUERZOS TICKETS', 'ALMUERZO', 1),
    (id_medlog, 'ALMUERZOS SISTEMA', 'ALMUERZO', 2),
    (id_medlog, 'CENAS TICKETS',     'CENA',     3),
    (id_medlog, 'CENAS SISTEMA',     'CENA',     4)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== METALPREN =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_metalpren, 'DESAYUNOS SISTEMA',      'DESAYUNO', 1),
    (id_metalpren, 'BEBIDAS',                'BEBIDA',   2),
    (id_metalpren, 'PAN',                    'PAN',      3),
    (id_metalpren, 'ALMUERZOS SISTEMA',      'ALMUERZO', 4),
    (id_metalpren, 'ALMUERZOS VIGILANTE',    'ALMUERZO', 5),
    (id_metalpren, 'ALMUERZOS CONTADO',      'ALMUERZO', 6),
    (id_metalpren, 'ALMUERZOS YAPE',         'ALMUERZO', 7),
    (id_metalpren, 'ALMUERZOS INVITADOS',    'ALMUERZO', 8),
    (id_metalpren, 'ALM DIETA',              'ALMUERZO', 9),
    (id_metalpren, 'CENA SISTEMA',           'CENA',     10),
    (id_metalpren, 'CENA INVITADO',          'CENA',     11),
    (id_metalpren, 'CENA DIETA',             'CENA',     12),
    (id_metalpren, 'CARTA 1',                'EXTRA',    13),
    (id_metalpren, 'CARTA 2',                'EXTRA',    14),
    (id_metalpren, 'CARTA 3',                'EXTRA',    15)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== MOLICENTRO =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_molicentro, 'ALMUERZO SUBV',          'ALMUERZO', 1),
    (id_molicentro, 'ALMUERZO NORMAL',         'ALMUERZO', 2),
    (id_molicentro, 'ALMUERZO INVITADOS',      'ALMUERZO', 3),
    (id_molicentro, 'ALM CONTADO/YAPE',        'ALMUERZO', 4),
    (id_molicentro, 'ALM CUMPLEAÑERO',         'ALMUERZO', 5),
    (id_molicentro, 'CENA',                    'CENA',     6),
    (id_molicentro, 'CENA INVITADO',           'CENA',     7),
    (id_molicentro, 'CENA CUMPLEAÑERO',        'CENA',     8),
    (id_molicentro, 'CAFÉ',                    'EXTRA',    9),
    (id_molicentro, 'CUPON HELADOS',           'EXTRA',    10),
    (id_molicentro, 'DES. ESPECIAL',           'DESAYUNO', 11),
    (id_molicentro, 'DESAYUNOS',               'DESAYUNO', 12),
    (id_molicentro, 'PAN VARIADOS',            'PAN',      13)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== SAN JORGE =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_sanJorge, 'ALMUERZOS CLEAN',       'ALMUERZO', 1),
    (id_sanJorge, 'ALMUERZOS CONTADOS',    'ALMUERZO', 2),
    (id_sanJorge, 'ALMUERZOS 10',          'ALMUERZO', 3),
    (id_sanJorge, 'ALMUERZOS CAPACITACION','ALMUERZO', 4),
    (id_sanJorge, 'ALMUERZOS SISTEMA',     'ALMUERZO', 5),
    (id_sanJorge, 'PAN',                   'PAN',      6),
    (id_sanJorge, 'PAN 5',                 'PAN',      7),
    (id_sanJorge, 'BEBIDA',                'BEBIDA',   8),
    (id_sanJorge, 'JUGO',                  'BEBIDA',   9),
    (id_sanJorge, 'LONCHE DOBLE',          'LONCHE',   10),
    (id_sanJorge, 'COMBO 1',               'EXTRA',    11),
    (id_sanJorge, 'COMBO 2',               'EXTRA',    12),
    (id_sanJorge, 'REFRIGERIOS',           'EXTRA',    13)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== TECSUR =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_tecsur, 'DESAYUNOS SISTEMA',      'DESAYUNO', 1),
    (id_tecsur, 'DESAYUNO TECSUR',        'DESAYUNO', 2),
    (id_tecsur, 'DESAYUNO GCI',           'DESAYUNO', 3),
    (id_tecsur, 'ALMUERZO SEGURIDAD',     'ALMUERZO', 4),
    (id_tecsur, 'TOTAL PACK DESC',        'ALMUERZO', 5),
    (id_tecsur, 'TOTAL DESCARTABLES',     'ALMUERZO', 6),
    (id_tecsur, 'CAFÉ',                   'ALMUERZO', 7),
    (id_tecsur, 'PAN DEBIL',              'ALMUERZO', 8),
    (id_tecsur, 'PAN FUERTE',             'ALMUERZO', 9),
    (id_tecsur, 'COMBO 1',                'ALMUERZO', 10),
    (id_tecsur, 'COMBO 2',                'ALMUERZO', 11),
    (id_tecsur, 'ALMUERZO SISTEMA',       'ALMUERZO', 12),
    (id_tecsur, 'ALMUERZO ADICIONAL',     'ALMUERZO', 13),
    (id_tecsur, 'ALM FAC TECSUR',         'ALMUERZO', 14)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== GCI =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_gci, 'DESAYUNO SISTEMA',   'DESAYUNO', 1),
    (id_gci, 'ALMUERZO SISTEMA',   'ALMUERZO', 2),
    (id_gci, 'ALM SEGURIDAD',      'ALMUERZO', 3),
    (id_gci, 'ALM. TERCEROS',      'ALMUERZO', 4),
    (id_gci, 'CENAS SISTEMA',      'CENA',     5)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== VOLCAN (group by sede: FAUCETT / GAMBETTA) =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_volcan, 'ALMUERZOS FAUCETT',   'ALMUERZO',  1),
    (id_volcan, 'ALMUERZOS GAMBETTA',  'ALMUERZO',  2),
    (id_volcan, 'CENA FAUCETT',        'CENA',      3),
    (id_volcan, 'CENA GAMBETTA',       'CENA',      4),
    (id_volcan, 'AMANECIDA FAUCETT',   'AMANECIDA', 5),
    (id_volcan, 'AMANECIDA GAMBETTA',  'AMANECIDA', 6)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== PAMOLSA (ALMARK + TOTTUS sections) =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_pamolsa, 'DESAYUNO ALMARK',                   'DESAYUNO', 1),
    (id_pamolsa, 'CENA ALMARK',                       'CENA',     2),
    (id_pamolsa, 'ALMUERZO ALMARK',                   'ALMUERZO', 3),
    (id_pamolsa, 'MERIENDAS DIA Y NOCHE ALMARK',      'ALMUERZO', 4),
    (id_pamolsa, 'BEBIDAS + 2 PANES ALMARK',          'ALMUERZO', 5),
    (id_pamolsa, 'SOLO 2 PANES ALMARK',               'ALMUERZO', 6),
    (id_pamolsa, 'PANES TOTTUS',                      'EXTRA',    7),
    (id_pamolsa, 'BEBIDAS TOTTUS',                    'EXTRA',    8),
    (id_pamolsa, 'ALMUERZOS TOTTUS',                  'EXTRA',    9),
    (id_pamolsa, 'CENAS TOTTUS',                      'EXTRA',    10)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== TOTTUS-CDF (same structure as PAMOLSA) =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_tottus_cdf, 'DESAYUNO ALMARK',              'DESAYUNO', 1),
    (id_tottus_cdf, 'CENA ALMARK',                  'CENA',     2),
    (id_tottus_cdf, 'ALMUERZO ALMARK',              'ALMUERZO', 3),
    (id_tottus_cdf, 'MERIENDAS DIA Y NOCHE ALMARK', 'ALMUERZO', 4),
    (id_tottus_cdf, 'BEBIDAS + 2 PANES ALMARK',     'ALMUERZO', 5),
    (id_tottus_cdf, 'SOLO 2 PANES ALMARK',          'ALMUERZO', 6),
    (id_tottus_cdf, 'PANES TOTTUS',                 'EXTRA',    7),
    (id_tottus_cdf, 'BEBIDAS TOTTUS',               'EXTRA',    8),
    (id_tottus_cdf, 'ALMUERZOS TOTTUS',             'EXTRA',    9),
    (id_tottus_cdf, 'CENAS TOTTUS',                 'EXTRA',    10)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== TOTTUS-CDS =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_tottus_cds, 'DESAYUNO ALMARK',              'DESAYUNO', 1),
    (id_tottus_cds, 'CENA ALMARK',                  'CENA',     2),
    (id_tottus_cds, 'ALMUERZO ALMARK',              'ALMUERZO', 3),
    (id_tottus_cds, 'MERIENDAS DIA Y NOCHE ALMARK', 'ALMUERZO', 4),
    (id_tottus_cds, 'BEBIDAS + 2 PANES ALMARK',     'ALMUERZO', 5),
    (id_tottus_cds, 'SOLO 2 PANES ALMARK',          'ALMUERZO', 6),
    (id_tottus_cds, 'PANES TOTTUS',                 'EXTRA',    7),
    (id_tottus_cds, 'BEBIDAS TOTTUS',               'EXTRA',    8),
    (id_tottus_cds, 'ALMUERZOS TOTTUS',             'EXTRA',    9),
    (id_tottus_cds, 'CENAS TOTTUS',                 'EXTRA',    10)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

  -- ===== TOTTUS-PPA =====
  INSERT INTO comedor_campos_reporte (comedor_id, nombre_campo, categoria, orden) VALUES
    (id_tottus_ppa, 'DESAYUNO ALMARK',              'DESAYUNO', 1),
    (id_tottus_ppa, 'CENA ALMARK',                  'CENA',     2),
    (id_tottus_ppa, 'ALMUERZO ALMARK',              'ALMUERZO', 3),
    (id_tottus_ppa, 'MERIENDAS DIA Y NOCHE ALMARK', 'ALMUERZO', 4),
    (id_tottus_ppa, 'BEBIDAS + 2 PANES ALMARK',     'ALMUERZO', 5),
    (id_tottus_ppa, 'SOLO 2 PANES ALMARK',          'ALMUERZO', 6),
    (id_tottus_ppa, 'PANES TOTTUS',                 'EXTRA',    7),
    (id_tottus_ppa, 'BEBIDAS TOTTUS',               'EXTRA',    8),
    (id_tottus_ppa, 'ALMUERZOS TOTTUS',             'EXTRA',    9),
    (id_tottus_ppa, 'CENAS TOTTUS',                 'EXTRA',    10)
  ON CONFLICT (comedor_id, nombre_campo) DO NOTHING;

END $$;
