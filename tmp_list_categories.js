const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listCategories() {
    console.log('Querying all categories...');
    const { data, error } = await supabase
        .from('comedor_campos_reporte')
        .select('categoria');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const categories = Array.from(new Set(data.map(d => d.categoria)));
    console.log('Unique categories:', categories);
}

listCategories();
