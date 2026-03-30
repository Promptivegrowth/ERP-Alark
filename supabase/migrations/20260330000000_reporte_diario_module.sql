-- Migration: Reporte Diario Module (Drop old liquidacion_diaria approach)
-- Drops old daily report tables and creates the new dynamic field system

-- Drop old tables (if they still exist from previous session)
DROP TABLE IF EXISTS liquidacion_diaria CASCADE;
DROP TABLE IF EXISTS depositos_diarios CASCADE;

-- Drop new tables if already exist (idempotent)
DROP TABLE IF EXISTS reporte_cruce_semanal CASCADE;
DROP TABLE IF EXISTS reporte_diario_totales CASCADE;
DROP TABLE IF EXISTS reporte_diario_valores CASCADE;
DROP TABLE IF EXISTS reporte_diario CASCADE;
DROP TABLE IF EXISTS comedor_campos_reporte CASCADE;

-- 1. Field configuration per comedor (admin-managed)
CREATE TABLE comedor_campos_reporte (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comedor_id UUID REFERENCES comedores NOT NULL,
  nombre_campo TEXT NOT NULL,
  categoria TEXT CHECK (categoria IN ('DESAYUNO','ALMUERZO','CENA','AMANECIDA','LONCHE','PAN','BEBIDA','EXTRA','OTRO')) NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  es_readonly BOOLEAN DEFAULT false,
  formula TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comedor_id, nombre_campo)
);

-- 2. Daily report header (one per comedor per day)
CREATE TABLE reporte_diario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha DATE NOT NULL,
  ingresado_por UUID REFERENCES usuarios,
  tiene_coffe_break BOOLEAN DEFAULT false,
  descripcion_coffe TEXT,
  monto_coffe NUMERIC(10,2) DEFAULT 0,
  observaciones TEXT,
  subtotal NUMERIC(10,2) DEFAULT 0,
  bloqueado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comedor_id, fecha)
);

-- 3. Individual values per field
CREATE TABLE reporte_diario_valores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporte_id UUID REFERENCES reporte_diario ON DELETE CASCADE NOT NULL,
  campo_id UUID REFERENCES comedor_campos_reporte NOT NULL,
  cantidad INTEGER DEFAULT 0,
  monto NUMERIC(10,2) DEFAULT 0,
  UNIQUE(reporte_id, campo_id)
);

-- 4. Category totals per report
CREATE TABLE reporte_diario_totales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporte_id UUID REFERENCES reporte_diario ON DELETE CASCADE NOT NULL,
  categoria TEXT NOT NULL,
  label_total TEXT NOT NULL,
  total_cantidad INTEGER DEFAULT 0,
  total_monto NUMERIC(10,2) DEFAULT 0,
  UNIQUE(reporte_id, categoria)
);

-- 5. Cross-reference daily vs weekly
CREATE TABLE reporte_cruce_semanal (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comedor_id UUID REFERENCES comedores NOT NULL,
  semana_id UUID REFERENCES semanas NOT NULL,
  categoria TEXT NOT NULL,
  total_diario_acumulado NUMERIC(10,2) DEFAULT 0,
  total_semanal NUMERIC(10,2) DEFAULT 0,
  diferencia NUMERIC(10,2) GENERATED ALWAYS AS (total_diario_acumulado - total_semanal) STORED,
  diferencia_pct NUMERIC(5,2) DEFAULT 0,
  tiene_discrepancia BOOLEAN GENERATED ALWAYS AS (
    ABS(total_diario_acumulado - total_semanal) > (GREATEST(total_semanal, 1) * 0.05)
  ) STORED,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comedor_id, semana_id, categoria)
);

-- 6. Enable RLS
ALTER TABLE comedor_campos_reporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_diario_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_diario_totales ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_cruce_semanal ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
CREATE POLICY "admin_all_comedor_campos" ON comedor_campos_reporte FOR ALL
  USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));

CREATE POLICY "comedor_read_campos" ON comedor_campos_reporte FOR SELECT
  USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = comedor_campos_reporte.comedor_id OR rol = 'ADMIN'));

CREATE POLICY "admin_all_reporte_diario" ON reporte_diario FOR ALL
  USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));

CREATE POLICY "comedor_propio_reporte_diario" ON reporte_diario FOR ALL
  USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = reporte_diario.comedor_id));

CREATE POLICY "admin_all_rd_valores" ON reporte_diario_valores FOR ALL
  USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));

CREATE POLICY "comedor_propio_rd_valores" ON reporte_diario_valores FOR ALL
  USING (auth.uid() IN (
    SELECT u.id FROM usuarios u
    JOIN reporte_diario rd ON u.comedor_id = rd.comedor_id
    WHERE rd.id = reporte_diario_valores.reporte_id
  ));

CREATE POLICY "admin_all_rd_totales" ON reporte_diario_totales FOR ALL
  USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));

CREATE POLICY "comedor_propio_rd_totales" ON reporte_diario_totales FOR ALL
  USING (auth.uid() IN (
    SELECT u.id FROM usuarios u
    JOIN reporte_diario rd ON u.comedor_id = rd.comedor_id
    WHERE rd.id = reporte_diario_totales.reporte_id
  ));

CREATE POLICY "admin_all_cruce" ON reporte_cruce_semanal FOR ALL
  USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));

CREATE POLICY "comedor_propio_cruce" ON reporte_cruce_semanal FOR ALL
  USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = reporte_cruce_semanal.comedor_id));

-- 8. Update comedores with real names (replace placeholder data)
UPDATE comedores SET nombre = 'ICH',         codigo = 'ICH-01',  cliente_empresa = 'ICH'         WHERE codigo = 'COM-02';
UPDATE comedores SET nombre = 'FADESA',       codigo = 'FAD-01',  cliente_empresa = 'FADESA'       WHERE codigo = 'COM-03';
UPDATE comedores SET nombre = 'FITESA',       codigo = 'FIT-01',  cliente_empresa = 'FITESA'       WHERE codigo = 'COM-04';
UPDATE comedores SET nombre = 'FUNDICION',    codigo = 'FUN-01',  cliente_empresa = 'FUNDICION'    WHERE codigo = 'COM-05';
UPDATE comedores SET nombre = 'MACHU PICCHU', codigo = 'MAC-01',  cliente_empresa = 'MACHU PICCHU' WHERE codigo = 'COM-06';
UPDATE comedores SET nombre = 'MEDLOG',       codigo = 'MED-01',  cliente_empresa = 'MEDLOG'       WHERE codigo = 'COM-07';
UPDATE comedores SET nombre = 'METALPREN',    codigo = 'MET-01',  cliente_empresa = 'METALPREN'    WHERE codigo = 'COM-08';
UPDATE comedores SET nombre = 'MOLICENTRO',   codigo = 'MOL-01',  cliente_empresa = 'MOLICENTRO'   WHERE codigo = 'COM-09';
UPDATE comedores SET nombre = 'SAN JORGE',    codigo = 'SJO-01',  cliente_empresa = 'SAN JORGE'    WHERE codigo = 'COM-10';
UPDATE comedores SET nombre = 'TECSUR',       codigo = 'TEC-01',  cliente_empresa = 'TECSUR'       WHERE codigo = 'COM-11';
UPDATE comedores SET nombre = 'VOLCAN',       codigo = 'VOL-01',  cliente_empresa = 'VOLCAN'       WHERE codigo = 'COM-12';
UPDATE comedores SET nombre = 'PAMOLSA',      codigo = 'PAM-01',  cliente_empresa = 'PAMOLSA'      WHERE codigo = 'COM-13';
UPDATE comedores SET nombre = 'TOTTUS-CDF',   codigo = 'TOT-01',  cliente_empresa = 'TOTTUS'       WHERE codigo = 'COM-14';

-- Insert new comedores (17 total: existing 14 + 3 new)
INSERT INTO comedores (nombre, codigo, cliente_empresa, activo) VALUES
  ('GCI',        'GCI-01',  'GCI',          true),
  ('TOTTUS-CDS', 'TOT-02',  'TOTTUS',       true),
  ('TOTTUS-PPA', 'TOT-03',  'TOTTUS',       true)
ON CONFLICT (codigo) DO NOTHING;
