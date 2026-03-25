const fs = require('fs');

async function testQuery() {
    const token = 'sbp_85a6f004e0d76b3ca4c62cdc5a8755d565c32aa4';
    const ref = 'zuyqjhpiskokhtuuqltu';

    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const keys = await res.json();
    fs.writeFileSync('keys2.json', JSON.stringify(keys, null, 2), 'utf8');
}

testQuery().catch(console.error);
