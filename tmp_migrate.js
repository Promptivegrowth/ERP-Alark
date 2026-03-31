const fs = require('fs');
const path = require('path');

// Verified credentials from .supabase_keys.json / user info
const token = 'sbp_85a6f004e0d76b3ca4c62cdc5a8755d565c32aa4';
const ref = 'zuyqjhpiskokhtuuqltu';

const sqlFile = path.join('supabase', 'migrations', '20260331000001_emergency_requests.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

async function run() {
    console.log('Applying migration via Management API query to:', ref);

    try {
        // Attempting the endpoint that usually works for the CLI/Dashboard
        const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-client-info': 'supabase-cli/1.0.0'
            },
            body: JSON.stringify({
                query: sql
            })
        });

        const text = await res.text();
        if (res.ok) {
            console.log('Migration applied successfully ✓');
        } else {
            console.error('Migration failed Status:', res.status);
            console.error('Response:', text);

            // Trying one more variation if 404
            if (res.status === 404) {
                console.log('Trying /sql endpoint...');
                const res2 = await fetch(`https://api.supabase.com/v1/projects/${ref}/sql`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: sql })
                });
                console.log('Res2 Status:', res2.status);
                console.log('Res2 Details:', await res2.text());
            }
        }
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

run();
