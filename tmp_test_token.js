const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));

const SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const SRK = envConfig.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

const ACCESS_TOKEN = 'sbp_2816f9a765e3302a5df6c04d1895e36bbca64bcc';

// Using Supabase Management API v1 with correct endpoint
async function runMigration(sql, label) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/migrations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: label,
            statements: [sql]
        })
    });

    const text = await res.text();
    if (!res.ok) {
        // Try alternative endpoint
        const res2 = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        });
        const text2 = await res2.text();
        if (!res2.ok) {
            console.error(`FAIL [${label}]: ${text2.substring(0, 150)}`);
            return false;
        }
        console.log(`OK [${label}] via query endpoint`);
        return true;
    }
    console.log(`OK [${label}]`);
    return true;
}

async function main() {
    console.log('Project ref:', projectRef);

    // First test the token works at all
    const testRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const testText = await testRes.text();
    console.log('Token test:', testRes.status, testText.substring(0, 100));
}
main().catch(console.error);
