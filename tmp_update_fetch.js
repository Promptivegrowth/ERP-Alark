const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY;

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
    console.log('Refining GCI fields with better categorization...');

    const dataToInsert = fields.map(f => ({
        comedor_id: COMEDOR_ID,
        nombre_campo: f.nombre_campo,
        categoria: f.categoria,
        orden: f.orden,
        activo: true,
        es_readonly: false
    }));

    const url = `${SUPABASE_URL}/rest/v1/comedor_campos_reporte`;

    console.log('Cleaning GCI fields...');
    await fetch(`${url}?comedor_id=eq.${COMEDOR_ID}`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });

    console.log('Inserting refined fields...');
    const insRes = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(dataToInsert)
    });

    if (!insRes.ok) {
        const err = await insRes.text();
        console.error('Insert error:', err);
        return;
    }

    const data = await insRes.json();
    console.log('Successfully updated GCI with ' + data.length + ' refined fields.');
    data.forEach(d => console.log(d.orden + '. [' + d.categoria + '] ' + d.nombre_campo));
}

updateGCI();
