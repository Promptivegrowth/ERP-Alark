const token = 'sbp_85a6f004e0d76b3ca4c62cdc5a8755d565c32aa4';
const projectId = 'zuyqjhpiskokhtuuqltu';
const sql = `
ALTER TABLE comedor_campos_reporte ADD COLUMN IF NOT EXISTS valor_unit NUMERIC DEFAULT 0;
ALTER TABLE reporte_diario_valores ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC DEFAULT 0;
`;

async function run() {
    try {
        const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        });

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
