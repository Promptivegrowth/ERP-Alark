const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const COMEDOR_ID = '38c4b14d-91b6-4993-9c59-dc3c01c0d0d0'; // GCI

async function checkFields() {
    console.log('Querying fields for GCI...');
    const { data, error } = await supabase
        .from('comedor_campos_reporte')
        .select('*')
        .eq('comedor_id', COMEDOR_ID)
        .order('id');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

checkFields();
