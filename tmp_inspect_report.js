const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    console.log('Fetching last report...');
    const { data: report, error: err1 } = await supabase
        .from('reporte_diario')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(1)
        .single();

    if (err1) {
        console.error('Error fetching report:', err1);
        return;
    }
    console.log('Report Structure:', Object.keys(report));
    console.log('Sample Report:', report);

    console.log('Fetching values for this report...');
    const { data: values, error: err2 } = await supabase
        .from('reporte_diario_valores')
        .select('*, comedor_campos_reporte(*)')
        .eq('reporte_id', report.id);

    if (err2) {
        console.error('Error fetching values:', err2);
    } else {
        console.log('Values Structure:', Object.keys(values[0] || {}));
        console.log('Sample Value:', values[0]);
    }
}

inspect();
