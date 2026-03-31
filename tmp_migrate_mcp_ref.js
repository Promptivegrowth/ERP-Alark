const fs = require('fs');
const path = require('path');

// Token provided by user
const token = 'sbp_85a6f004e0d76b3ca4c62cdc5a8755d565c32aa4';
// Use the project Ref/ID found via MCP: cpmpadwapkazldrptdor
const ref = 'cpmpadwapkazldrptdor';

const sqlFile = path.join('supabase', 'migrations', '20260331000001_emergency_requests.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

async function run() {
    console.log('Applying migration to project:', ref);

    try {
        const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/pg-meta/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: sql
            })
        });

        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

run();
