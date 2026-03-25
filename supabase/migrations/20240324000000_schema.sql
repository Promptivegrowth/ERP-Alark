--- TABLAS MAESTRAS ---

CREATE TABLE comedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  cliente_empresa TEXT,
  direccion TEXT,
  responsable TEXT,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE usuarios (
  id UUID REFERENCES auth.users PRIMARY KEY,
  comedor_id UUID REFERENCES comedores,
  rol TEXT CHECK (rol IN ('ADMIN','COMEDOR')) NOT NULL,
  nombre TEXT,
  email TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE kardex_productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,
  categoria TEXT CHECK (categoria IN ('GASEOSA','AGUA','SNACK','GALLETA','CHOCOLATE','PASTEL','PAN','OTRO')) NOT NULL,
  precio_base NUMERIC(10,2) NOT NULL,
  unidad TEXT DEFAULT 'unidad',
  activo BOOLEAN DEFAULT true,
  stock_minimo_alerta NUMERIC DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE precios_servicios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,
  precio NUMERIC(10,4) NOT NULL,
  tipo TEXT CHECK (tipo IN ('ALMUERZO','CENA','AMANECIDA','DESAYUNO','COFFE_BREAK','ESPECIAL')) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

--- TABLAS DE INGRESO DIARIO (Portal Comedor) ---

CREATE TABLE liquidacion_diaria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha DATE NOT NULL,
  servicio TEXT NOT NULL,
  tipo_pago TEXT CHECK (tipo_pago IN ('CREDITO_RANSA','CONTADO')) NOT NULL,
  precio_unit NUMERIC(10,4),
  cantidad INTEGER DEFAULT 0,
  monto NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unit) STORED,
  ingresado_por UUID REFERENCES usuarios,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comedor_id, fecha, servicio, tipo_pago)
);

CREATE TABLE depositos_diarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha DATE NOT NULL,
  monto NUMERIC(10,2) NOT NULL,
  tipo TEXT CHECK (tipo IN ('DEPOSITO','YAPE','EFECTIVO')) NOT NULL,
  referencia TEXT,
  ingresado_por UUID REFERENCES usuarios,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comedor_id, fecha, tipo)
);

CREATE TABLE incidencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha DATE NOT NULL,
  tipo TEXT CHECK (tipo IN ('PERSONAL','EQUIPOS','INSUMOS','CLIENTE','OTRO')) NOT NULL,
  descripcion TEXT,
  estado TEXT CHECK (estado IN ('ABIERTA','EN_REVISION','CERRADA')) DEFAULT 'ABIERTA',
  resuelto_por UUID REFERENCES usuarios,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

--- TABLAS DE INGRESO SEMANAL (Portal Comedor) ---

CREATE TABLE semanas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  completado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comedor_id, fecha_inicio)
);

CREATE TABLE kardex_snack_ventas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_id UUID REFERENCES semanas NOT NULL,
  comedor_id UUID REFERENCES comedores NOT NULL,
  producto_id UUID REFERENCES kardex_productos NOT NULL,
  stock_inicial_qty NUMERIC(10,2) DEFAULT 0,
  stock_inicial_valor NUMERIC(10,2) DEFAULT 0,
  pedido_qty NUMERIC(10,2) DEFAULT 0,
  pedido_valor NUMERIC(10,2) DEFAULT 0,
  total_disponible_qty NUMERIC(10,2) GENERATED ALWAYS AS (stock_inicial_qty + pedido_qty) STORED,
  venta_credito NUMERIC(10,2) DEFAULT 0,
  venta_contado_yape NUMERIC(10,2) DEFAULT 0,
  total_vendido NUMERIC(10,2) GENERATED ALWAYS AS (venta_credito + venta_contado_yape) STORED,
  merma NUMERIC(10,2) DEFAULT 0,
  stock_final_qty NUMERIC(10,2) GENERATED ALWAYS AS (stock_inicial_qty + pedido_qty - venta_credito - venta_contado_yape - merma) STORED,
  stock_final_valor NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semana_id, producto_id)
);

CREATE TABLE kardex_pasteles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_id UUID REFERENCES semanas NOT NULL,
  comedor_id UUID REFERENCES comedores NOT NULL,
  producto_id UUID REFERENCES kardex_productos NOT NULL,
  stock_inicial_qty NUMERIC(10,2) DEFAULT 0,
  stock_inicial_valor NUMERIC(10,2) DEFAULT 0,
  pedido_qty NUMERIC(10,2) DEFAULT 0,
  pedido_valor NUMERIC(10,2) DEFAULT 0,
  total_disponible_qty NUMERIC(10,2) GENERATED ALWAYS AS (stock_inicial_qty + pedido_qty) STORED,
  venta_credito_yapes NUMERIC(10,2) DEFAULT 0,
  venta_contado NUMERIC(10,2) DEFAULT 0,
  total_vendido NUMERIC(10,2) GENERATED ALWAYS AS (venta_credito_yapes + venta_contado) STORED,
  merma NUMERIC(10,2) DEFAULT 0,
  stock_final_qty NUMERIC(10,2) GENERATED ALWAYS AS (stock_inicial_qty + pedido_qty - venta_credito_yapes - venta_contado - merma) STORED,
  stock_final_valor NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semana_id, producto_id)
);

CREATE TABLE pedido_pan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_id UUID REFERENCES semanas NOT NULL,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha DATE NOT NULL,
  producto TEXT NOT NULL,
  cantidad_pedido INTEGER DEFAULT 0,
  cantidad_vendida INTEGER DEFAULT 0,
  precio_unit NUMERIC(10,4),
  diferencia INTEGER GENERATED ALWAYS AS (cantidad_pedido - cantidad_vendida) STORED,
  justificacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semana_id, fecha, producto)
);

CREATE TABLE gastos_operativos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_id UUID REFERENCES semanas NOT NULL,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha DATE NOT NULL,
  categoria TEXT CHECK (categoria IN ('INSUMOS','TRANSPORTE','MANTENIMIENTO','PERSONAL','LIMPIEZA','OTRO')) NOT NULL,
  descripcion TEXT NOT NULL,
  precio_unit NUMERIC(10,2),
  cantidad NUMERIC(10,2),
  monto NUMERIC(10,2) NOT NULL,
  autorizado_por TEXT,
  comprobante_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE coffe_otros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_id UUID REFERENCES semanas NOT NULL,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha DATE NOT NULL,
  tipo TEXT CHECK (tipo IN ('CUMPLEAÑOS','COFFE_BREAK','EVENTO_CORPORATIVO','SPORADE_STAG','OTRO')) NOT NULL,
  solicitado_por TEXT,
  descripcion TEXT,
  cantidad INTEGER DEFAULT 0,
  valor_unit NUMERIC(10,2),
  total NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

--- TABLAS DE REPORTE DEL SISTEMA EXTERNO ---

CREATE TABLE reporte_credito (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_id UUID REFERENCES semanas,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL,
  tipo_comensal TEXT,
  apellidos TEXT,
  nombres TEXT,
  nombre_completo TEXT,
  id_empleado TEXT,
  fotocheck TEXT,
  dni TEXT,
  id_registro TEXT,
  id_ccosto TEXT,
  servicio TEXT,
  valor_empleado NUMERIC(10,4),
  valor_empresa NUMERIC(10,4),
  razon_social TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reporte_contado (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_id UUID REFERENCES semanas,
  comedor_id UUID REFERENCES comedores NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL,
  unidad TEXT,
  nombres TEXT,
  codigo_trab TEXT,
  nro_tarjeta TEXT,
  nro_documento TEXT,
  nro_ticket TEXT,
  planta TEXT,
  tipo_trab TEXT,
  cajero TEXT,
  tipo_pago TEXT,
  centro_costo TEXT,
  subdivision TEXT,
  producto TEXT,
  cantidad INTEGER,
  precio_unit NUMERIC(10,2),
  monto NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

--- TABLAS DE INTELIGENCIA Y ALERTAS ---

CREATE TABLE logistica_alertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comedor_id UUID REFERENCES comedores NOT NULL,
  producto_id UUID REFERENCES kardex_productos NOT NULL,
  fecha DATE NOT NULL,
  tipo TEXT CHECK (tipo IN ('STOCK_BAJO','MERMA_ALTA','DESPACHO','DESCUADRE','ANOMALIA')) NOT NULL,
  stock_actual NUMERIC,
  dias_cobertura NUMERIC,
  prioridad TEXT CHECK (prioridad IN ('ALTA','MEDIA','BAJA')) DEFAULT 'MEDIA',
  descripcion TEXT,
  atendido BOOLEAN DEFAULT false,
  atendido_por UUID REFERENCES usuarios,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id UUID NOT NULL,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  usuario_id UUID REFERENCES usuarios,
  created_at TIMESTAMPTZ DEFAULT now()
);

--- VISTAS SQL ---

CREATE OR REPLACE VIEW vw_ventas_semanales AS
SELECT 
  s.comedor_id,
  s.fecha_inicio,
  s.fecha_fin,
  SUM(ld.monto) as total_ventas,
  SUM(CASE WHEN ld.tipo_pago = 'CREDITO_RANSA' THEN ld.monto ELSE 0 END) as ventas_credito,
  SUM(CASE WHEN ld.tipo_pago = 'CONTADO' THEN ld.monto ELSE 0 END) as ventas_contado,
  COUNT(DISTINCT ld.fecha) as dias_operativos
FROM semanas s
LEFT JOIN liquidacion_diaria ld ON ld.comedor_id = s.comedor_id 
  AND ld.fecha BETWEEN s.fecha_inicio AND s.fecha_fin
GROUP BY s.comedor_id, s.fecha_inicio, s.fecha_fin;

CREATE OR REPLACE VIEW vw_stock_actual AS
SELECT DISTINCT ON (ksv.comedor_id, ksv.producto_id)
  ksv.comedor_id,
  ksv.producto_id,
  kp.nombre as producto_nombre,
  kp.categoria,
  kp.precio_base,
  kp.stock_minimo_alerta,
  ksv.stock_final_qty,
  ksv.stock_final_valor,
  s.fecha_inicio as semana_referencia,
  CASE WHEN ksv.venta_credito + ksv.venta_contado_yape > 0 
    THEN ksv.stock_final_qty / NULLIF((ksv.venta_credito + ksv.venta_contado_yape) / 5.0, 0)
    ELSE NULL END as dias_cobertura
FROM kardex_snack_ventas ksv
JOIN semanas s ON s.id = ksv.semana_id
JOIN kardex_productos kp ON kp.id = ksv.producto_id
ORDER BY ksv.comedor_id, ksv.producto_id, s.fecha_inicio DESC;

CREATE OR REPLACE VIEW vw_comensales_diarios AS
SELECT
  comedor_id,
  DATE(fecha_hora) as fecha,
  tipo_comensal,
  razon_social,
  COUNT(*) as total,
  SUM(valor_empleado) as total_valor
FROM reporte_credito
GROUP BY comedor_id, DATE(fecha_hora), tipo_comensal, razon_social;

CREATE OR REPLACE VIEW vw_margen_operativo AS
SELECT
  s.comedor_id,
  s.fecha_inicio,
  s.fecha_fin,
  COALESCE(SUM(ld.monto), 0) as ingresos,
  COALESCE(SUM(go.monto), 0) as gastos,
  COALESCE(SUM(ld.monto), 0) - COALESCE(SUM(go.monto), 0) as margen,
  CASE WHEN COALESCE(SUM(ld.monto), 0) > 0 
    THEN ROUND(((COALESCE(SUM(ld.monto), 0) - COALESCE(SUM(go.monto), 0)) / SUM(ld.monto)) * 100, 2)
    ELSE 0 END as margen_pct
FROM semanas s
LEFT JOIN liquidacion_diaria ld ON ld.comedor_id = s.comedor_id AND ld.fecha BETWEEN s.fecha_inicio AND s.fecha_fin
LEFT JOIN gastos_operativos go ON go.semana_id = s.id
GROUP BY s.comedor_id, s.fecha_inicio, s.fecha_fin;

--- FUNCION y TRIGGER PARA updated_at ---
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_comedores_updated_at BEFORE UPDATE ON comedores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kardex_productos_updated_at BEFORE UPDATE ON kardex_productos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_liquidacion_diaria_updated_at BEFORE UPDATE ON liquidacion_diaria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incidencias_updated_at BEFORE UPDATE ON incidencias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kardex_snack_ventas_updated_at BEFORE UPDATE ON kardex_snack_ventas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kardex_pasteles_updated_at BEFORE UPDATE ON kardex_pasteles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gastos_operativos_updated_at BEFORE UPDATE ON gastos_operativos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

--- POLÍTICAS RLS ---

-- Habilitar RLS en todas las tablas
ALTER TABLE comedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE kardex_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidacion_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE depositos_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE semanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE kardex_snack_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE kardex_pasteles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_pan ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_operativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffe_otros ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_contado ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas ADMIN (Total)
CREATE POLICY "admin_all_comedores" ON comedores FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_usuarios" ON usuarios FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_kardex_productos" ON kardex_productos FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_precios_servicios" ON precios_servicios FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_liquidacion_diaria" ON liquidacion_diaria FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_depositos_diarios" ON depositos_diarios FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_incidencias" ON incidencias FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_semanas" ON semanas FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_kardex_snack_ventas" ON kardex_snack_ventas FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_kardex_pasteles" ON kardex_pasteles FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_pedido_pan" ON pedido_pan FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_gastos_operativos" ON gastos_operativos FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_coffe_otros" ON coffe_otros FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_reporte_credito" ON reporte_credito FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_reporte_contado" ON reporte_contado FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_logistica_alertas" ON logistica_alertas FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));
CREATE POLICY "admin_all_audit_log" ON audit_log FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'ADMIN'));

-- Políticas COMEDOR (acceso restringido a los catálogos en lectura)
CREATE POLICY "comedor_read_comedores" ON comedores FOR SELECT USING (true);
CREATE POLICY "comedor_read_usuarios" ON usuarios FOR SELECT USING (auth.uid() = id);
CREATE POLICY "comedor_read_kardex_productos" ON kardex_productos FOR SELECT USING (true);
CREATE POLICY "comedor_read_precios_servicios" ON precios_servicios FOR SELECT USING (true);

-- Políticas COMEDOR (acceso a sus propios datos para lectura y modificación)
CREATE POLICY "comedor_propio_liquidacion" ON liquidacion_diaria FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = liquidacion_diaria.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_depositos" ON depositos_diarios FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = depositos_diarios.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_incidencias" ON incidencias FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = incidencias.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_semanas" ON semanas FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = semanas.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_kardex_snack_ventas" ON kardex_snack_ventas FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = kardex_snack_ventas.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_kardex_pasteles" ON kardex_pasteles FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = kardex_pasteles.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_pedido_pan" ON pedido_pan FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = pedido_pan.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_gastos_operativos" ON gastos_operativos FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = gastos_operativos.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_coffe_otros" ON coffe_otros FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = coffe_otros.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_reporte_credito" ON reporte_credito FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = reporte_credito.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_reporte_contado" ON reporte_contado FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = reporte_contado.comedor_id AND rol = 'COMEDOR'));
CREATE POLICY "comedor_propio_logistica_alertas" ON logistica_alertas FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE comedor_id = logistica_alertas.comedor_id AND rol = 'COMEDOR'));

--- SEED DATA ---
INSERT INTO precios_servicios (nombre, tipo, precio) VALUES 
('ALMUERZO RANSA', 'ALMUERZO', 12.70),
('CENA RANSA', 'CENA', 15.34),
('AMANECIDA', 'AMANECIDA', 15.34),
('ALMUERZO CONTADO 13', 'ALMUERZO', 13.00),
('ALMUERZO CONTADO 12', 'ALMUERZO', 12.00),
('DESAYUNO DOBLE DERCO', 'DESAYUNO', 10.50),
('COMBO 1', 'ALMUERZO', 6.60),
('COMBO 2', 'ALMUERZO', 8.90) ON CONFLICT DO NOTHING;

INSERT INTO kardex_productos (nombre, categoria, precio_base) VALUES 
('GASEOSA 1/2 L', 'GASEOSA', 3.50), ('AGUA MINERAL', 'AGUA', 3.00), ('GASEOSA 3LT', 'GASEOSA', 13.00),
('SPORADE', 'AGUA', 3.00), ('FRUGO/TAMPICO', 'SNACK', 2.50), ('FRUGOS CAJITA', 'SNACK', 2.00),
('GLASITAS', 'SNACK', 1.20), ('AGUA CHUPON', 'AGUA', 3.50), ('FRUGOS BOTELLA', 'SNACK', 2.50),
('TORTA CHOCOLATE', 'PASTEL', 4.00), ('ALFAJOR', 'PASTEL', 2.00), ('MOROCHA', 'GALLETA', 1.20),
('CHOCOTEJAS PEQUEÑA', 'CHOCOLATE', 1.00), ('FRAC', 'GALLETA', 1.00), ('TENTACION', 'GALLETA', 1.00),
('RITZ', 'GALLETA', 1.00), ('SODA FILM', 'GALLETA', 1.00), ('CHIPSAJOY', 'SNACK', 1.50),
('CHOCOSODA', 'GALLETA', 1.50), ('CUA CUA', 'CHOCOLATE', 1.00), ('SUBLIME', 'CHOCOLATE', 2.50),
('PEPSI', 'GASEOSA', 2.50), ('OREO', 'GALLETA', 1.20), ('CLUB SOCIAL', 'GALLETA', 1.00),
('VAINILLA', 'GALLETA', 1.20), ('PAPITAS LAYS', 'SNACK', 2.50), ('PIQUEOS/DORITOS', 'SNACK', 2.50),
('CUATES', 'SNACK', 1.50), ('TRIDENT', 'SNACK', 2.00), ('HALLS', 'SNACK', 1.50),
('MINI PICARA', 'CHOCOLATE', 2.00), ('MINI MOROCHA', 'GALLETA', 2.00), ('MINI CUA CUA', 'CHOCOLATE', 2.00),
('COCONUT', 'SNACK', 2.00), ('MUNICION', 'SNACK', 2.00), ('FRUTA MIXTA', 'SNACK', 2.00),
('PAY MANZANA', 'PASTEL', 3.50), ('EMPANADA VARIADA', 'PASTEL', 3.50), ('PIONONO MANJAR', 'PASTEL', 2.50),
('CUP KAKE', 'PASTEL', 1.50), ('PAY MEDIANO', 'PASTEL', 4.50), ('PAY PEQUEÑO', 'PASTEL', 3.50),
('GASEOSA 1.5LT', 'GASEOSA', 8.50), ('GATORADE', 'AGUA', 3.50), ('VOLT', 'GASEOSA', 3.00),
('PAPAS LIGHT', 'SNACK', 1.50), ('CHIFLES', 'SNACK', 1.50), ('GALLETA SODA', 'GALLETA', 1.00),
('CASINO', 'GALLETA', 1.00), ('CHOCMAN', 'CHOCOLATE', 1.00), ('PAN DERCO', 'PAN', 0.38),
('PAN RANSA', 'PAN', 0.38), ('BUDIN', 'PAN', 0.25) ON CONFLICT DO NOTHING;

INSERT INTO comedores (nombre, codigo) VALUES 
('RANSA', 'RAN-01'), ('COMEDOR 2', 'COM-02'), ('COMEDOR 3', 'COM-03'), ('COMEDOR 4', 'COM-04'),
('COMEDOR 5', 'COM-05'), ('COMEDOR 6', 'COM-06'), ('COMEDOR 7', 'COM-07'), ('COMEDOR 8', 'COM-08'),
('COMEDOR 9', 'COM-09'), ('COMEDOR 10', 'COM-10'), ('COMEDOR 11', 'COM-11'), ('COMEDOR 12', 'COM-12'),
('COMEDOR 13', 'COM-13'), ('COMEDOR 14', 'COM-14') ON CONFLICT DO NOTHING;
