const { Client } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));

// Try different Supabase postgres connection formats  
// Supabase uses: postgresql://postgres.[project-ref]:[db-password]@aws-0-[region].pooler.supabase.com:5432/postgres
// The DB password is separate from service role key - it's set in dashboard

// Check if there's a supabase config file
const configs = [
    'supabase/.temp/project-ref',
    '.supabase/config.toml',
    'supabase/config.toml'
];
for (const f of configs) {
    if (fs.existsSync(f)) {
        console.log(f + ':', fs.readFileSync(f, 'utf8').substring(0, 200));
    }
}

// Look for postgres password in env
const possibleKeys = Object.keys(envConfig).filter(k =>
    k.toLowerCase().includes('db') ||
    k.toLowerCase().includes('postgres') ||
    k.toLowerCase().includes('pass') ||
    k.toLowerCase().includes('pwd')
);
console.log('Possible DB keys:', possibleKeys);
