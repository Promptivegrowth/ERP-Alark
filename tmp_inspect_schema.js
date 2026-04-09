const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    console.log('Querying samples from comedor_campos_reporte...');
    const { data, error } = await supabase
        .from('comedor_campos_reporte')
        .select('*')
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Samples:', JSON.stringify(data, null, 2));

    // Also check categories
    const categories = Array.from(new Set(data.map(d => d.categoria)));
    console.log('Detected categories:', categories);
}

inspect();
