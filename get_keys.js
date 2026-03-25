const token = 'sbp_85a6f004e0d76b3ca4c62cdc5a8755d565c32aa4';
const ref = 'zuyqjhpiskokhtuuqltu';

async function getApiKeys() {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!res.ok) {
        console.error('Failed to fetch keys', res.status, await res.text());
        return;
    }
    const keys = await res.json();
    console.log(JSON.stringify(keys, null, 2));
}

getApiKeys();
