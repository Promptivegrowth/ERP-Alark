-- Migration: create_weekly_reports_tables
-- Date: 2026-04-15
-- Description: Creates tables for weekly reports module (semanal, campos, valores, lotes, uploads)

-- Tabla 1: Cabecera del reporte semanal
CREATE TABLE IF NOT EXISTS reporte_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comedor_id UUID REFERENCES comedores(id) NOT NULL,
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  estado VARCHAR(20) DEFAULT 'borrador',
  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comedor_id, semana_inicio)
);

-- Tabla 2: Configuracion de campos semanales por comedor (~200 campos total, 17 comedores)
CREATE TABLE IF NOT EXISTS reporte_semanal_campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comedor_id UUID REFERENCES comedores(id) NOT NULL,
  nombre_campo TEXT NOT NULL,
  seccion TEXT DEFAULT 'GENERAL',
  precio_ref NUMERIC(10,2),
  precio_editable BOOLEAN DEFAULT true,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  es_facturable BOOLEAN DEFAULT true,
  categoria_cruce TEXT,
  UNIQUE(comedor_id, nombre_campo)
);

-- Tabla 3: Valores diarios del reporte semanal (un row por campo x dia)
CREATE TABLE IF NOT EXISTS reporte_semanal_valores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_semanal_id UUID REFERENCES reporte_semanal(id) ON DELETE CASCADE,
  campo_id UUID REFERENCES reporte_semanal_campos(id),
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  cantidad INTEGER DEFAULT 0,
  precio_unitario NUMERIC(10,2) DEFAULT 0,
  UNIQUE(reporte_semanal_id, campo_id, dia_semana)
);

-- Tabla 4: Cabecera de lotes de carga de Excel interno
CREATE TABLE IF NOT EXISTS system_report_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comedor_id UUID REFERENCES comedores(id),
  semana_inicio DATE NOT NULL,
  nombre_archivo TEXT,
  total_filas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla 5: Filas importadas del Excel interno del sistema (por trabajador)
CREATE TABLE IF NOT EXISTS system_report_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comedor_id UUID REFERENCES comedores(id),
  upload_id UUID NOT NULL,
  semana_inicio DATE NOT NULL,
  fecha TIMESTAMPTZ,
  apellidos TEXT,
  nombres TEXT,
  dni VARCHAR(12),
  servicio TEXT NOT NULL,
  servicio_canonico TEXT,
  cantidad INTEGER DEFAULT 1,
  tipo_pago VARCHAR(15) DEFAULT 'Credito',
  valor_empleado NUMERIC(10,2),
  valor_empresa NUMERIC(10,2),
  razon_social TEXT,
  centro_costo TEXT,
  tipo_trabajador TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_semanal_comedor ON reporte_semanal(comedor_id, semana_inicio);
CREATE INDEX IF NOT EXISTS idx_semanal_campos_comedor ON reporte_semanal_campos(comedor_id);
CREATE INDEX IF NOT EXISTS idx_semanal_valores_reporte ON reporte_semanal_valores(reporte_semanal_id);
CREATE INDEX IF NOT EXISTS idx_upload_comedor_semana ON system_report_uploads(comedor_id, semana_inicio);
CREATE INDEX IF NOT EXISTS idx_upload_canonico ON system_report_uploads(servicio_canonico, semana_inicio);

-- RLS
ALTER TABLE reporte_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_semanal_campos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_semanal_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_report_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_report_lotes ENABLE ROW LEVEL SECURITY;

-- Policies: admin tiene acceso total (en la app solo el admin puede ver estas pantallas)
DO $$ BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reporte_semanal' AND policyname='pol_semanal') THEN
    CREATE POLICY pol_semanal ON reporte_semanal FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reporte_semanal_campos' AND policyname='pol_semanal_campos') THEN
    CREATE POLICY pol_semanal_campos ON reporte_semanal_campos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reporte_semanal_valores' AND policyname='pol_semanal_valores') THEN
    CREATE POLICY pol_semanal_valores ON reporte_semanal_valores FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_report_uploads' AND policyname='pol_uploads') THEN
    CREATE POLICY pol_uploads ON system_report_uploads FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_report_lotes' AND policyname='pol_lotes') THEN
    CREATE POLICY pol_lotes ON system_report_lotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
