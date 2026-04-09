const https = require('https');

const token = 'sbp_85a6f004e0d76b3ca4c62cdc5a8755d565c32aa4';
const projectId = 'zuyqjhpiskokhtuuqltu';
const sql = `
ALTER TABLE comedor_campos_reporte ADD COLUMN IF NOT EXISTS valor_unit NUMERIC DEFAULT 0;
ALTER TABLE reporte_diario_valores ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC DEFAULT 0;
`;

const data = JSON.stringify({ query: sql });

const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${projectId}/database/query`,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => {
        body += d;
    });
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
    });
});

req.on('error', (e) => {
    console.error('Error:', e);
});

req.write(data);
req.end();
