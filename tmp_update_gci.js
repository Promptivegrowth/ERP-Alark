const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const COMEDOR_ID = '0289e381-86ad-441c-a3ed-d2c0784ed0d0'; // GCI

const fields = [
    { nombre_campo: 'DESAYUNOS SISTEMA', categoria: 'DESAYUNO', orden: 1 },
    { nombre_campo: 'DESAYUNO TECSUR', categoria: 'DESAYUNO', orden: 2 },
    { nombre_campo: 'DESAYUNO GCI', categoria: 'DESAYUNO', orden: 3 },
    { nombre_campo: 'ALMUERZO SEGURIDAD', categoria: 'ALMUERZO', orden: 4 },
    { nombre_campo: 'ALMUERZO SISTEMA', categoria: 'ALMUERZO', orden: 5 },
    { nombre_campo: 'ALMUERZO ADICIONAL', categoria: 'ALMUERZO', orden: 6 },
    { nombre_campo: 'ALM FAC TECSUR', categoria: 'ALMUERZO', orden: 7 },
    { nombre_campo: 'PAN DEBIL', categoria: 'PAN', orden: 8 },
    { nombre_campo: 'PAN FUERTE', categoria: 'PAN', orden: 9 },
    { nombre_campo: 'TOTAL PACK DESC', categoria: 'EXTRA', orden: 10 },
    { nombre_campo: 'TOTAL DESCARTABLES', categoria: 'EXTRA', orden: 11 },
    { nombre_campo: 'CAFÉ', categoria: 'EXTRA', orden: 12 },
    { nombre_campo: 'COMBO 1', categoria: 'EXTRA', orden: 13 },
    { nombre_campo: 'COMBO 2', categoria: 'EXTRA', orden: 14 }
];

async function updateGCI() {
    console.log('Cleaning existing fields for GCI (ID: ' + COMEDOR_ID + ')...');

    const { error: deleteError } = await supabase
        .from('comedor_campos_reporte')
        .delete()
        .eq('comedor_id', COMEDOR_ID);

    if (deleteError) {
        console.error('Error during deletion:', deleteError);
        return;
    }

    console.log('Inserting new fields for GCI...');
    const dataToInsert = fields.map(f => ({
        comedor_id: COMEDOR_ID,
        nombre_campo: f.nombre_campo,
        categoria: f.categoria,
        orden: f.orden,
        valor_unit: 0,
        activo: true,
        es_readonly: false
    }));

    const { data, error } = await supabase
        .from('comedor_campos_reporte')
        .insert(dataToInsert)
        .select();

    if (error) {
        console.error('Error during insertion:', error);
        return;
    }

    console.log('Successfully updated GCI with ' + data.length + ' fields.');
    data.forEach(d => console.log('[' + d.categoria + '] ' + d.nombre_campo));
}

updateGCI();
