const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const s = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' }
});

// We'll use the Supabase REST API to run DDL via the 'query' endpoint
// which is available via the postgres connection
async function runDDL(sql, label) {
    const url = `${envConfig.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
    // Try using pg directly via postgres URL
    const { data, error } = await s.from('comedores').select('id').limit(1); // test connection
    if (error) { console.error('Connection test failed:', error.message); return; }

    // Use supabase auth.admin for DDL via headers
    const res = await fetch(`${envConfig.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: { 'apikey': envConfig.SUPABASE_SERVICE_ROLE_KEY }
    });
    console.log('Connection OK, URL:', envConfig.NEXT_PUBLIC_SUPABASE_URL);
    return true;
}

async function main() {
    // Test connection first
    const { data, error } = await s.from('comedores').select('id').limit(1);
    if (error) { console.error('Cannot connect:', error.message); return; }
    console.log('Connected. Comedores count test OK');

    // Use supabase-js to call a stored procedure or use the pg module
    // Since we don't have pg installed, we'll use fetch to the /queries endpoint
    const SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
    const SRK = envConfig.SUPABASE_SERVICE_ROLE_KEY;
    const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

    console.log('Project ref:', projectRef);

    const statements = [
        `CREATE TABLE IF NOT EXISTS reporte_semanal (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), comedor_id UUID REFERENCES comedores(id) NOT NULL, semana_inicio DATE NOT NULL, semana_fin DATE NOT NULL, estado VARCHAR(20) DEFAULT 'borrador', notas TEXT, created_by UUID, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(comedor_id, semana_inicio))`,
        `CREATE TABLE IF NOT EXISTS reporte_semanal_campos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), comedor_id UUID REFERENCES comedores(id) NOT NULL, nombre_campo TEXT NOT NULL, seccion TEXT DEFAULT 'GENERAL', precio_ref NUMERIC(10,2), precio_editable BOOLEAN DEFAULT true, activo BOOLEAN DEFAULT true, orden INTEGER DEFAULT 0, es_facturable BOOLEAN DEFAULT true, categoria_cruce TEXT, UNIQUE(comedor_id, nombre_campo))`,
        `CREATE TABLE IF NOT EXISTS reporte_semanal_valores (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reporte_semanal_id UUID REFERENCES reporte_semanal(id) ON DELETE CASCADE, campo_id UUID REFERENCES reporte_semanal_campos(id), dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), cantidad INTEGER DEFAULT 0, precio_unitario NUMERIC(10,2) DEFAULT 0, UNIQUE(reporte_semanal_id, campo_id, dia_semana))`,
        `CREATE TABLE IF NOT EXISTS system_report_lotes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), comedor_id UUID REFERENCES comedores(id), semana_inicio DATE NOT NULL, nombre_archivo TEXT, total_filas INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now())`,
        `CREATE TABLE IF NOT EXISTS system_report_uploads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), comedor_id UUID REFERENCES comedores(id), upload_id UUID NOT NULL, semana_inicio DATE NOT NULL, fecha TIMESTAMPTZ, apellidos TEXT, nombres TEXT, dni VARCHAR(12), servicio TEXT NOT NULL, servicio_canonico TEXT, cantidad INTEGER DEFAULT 1, tipo_pago VARCHAR(15) DEFAULT 'Credito', valor_empleado NUMERIC(10,2), valor_empresa NUMERIC(10,2), razon_social TEXT, centro_costo TEXT, tipo_trabajador TEXT, created_at TIMESTAMPTZ DEFAULT now())`,
    ];

    for (const [i, sql] of statements.entries()) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_ddl`, {
            method: 'POST',
            headers: { 'apikey': SRK, 'Authorization': `Bearer ${SRK}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ statement: sql })
        });
        if (res.ok) {
            console.log(`stmt ${i + 1} OK via exec_ddl`);
        } else {
            // Fallback: use pg-based approach via postgres protocol
            const text = await res.text();
            console.log(`stmt ${i + 1} exec_ddl failed: ${text.substring(0, 100)} — trying alternative...`);
        }
    }
}
main().catch(console.error);
