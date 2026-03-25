const fs = require('fs');

async function testQuery() {
  const token = 'sbp_85a6f004e0d76b3ca4c62cdc5a8755d565c32aa4';
  const ref = 'zuyqjhpiskokhtuuqltu';

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/pg-meta/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-client-info': 'supabase-cli/1.0.0'
    },
    body: JSON.stringify({
      query: 'SELECT 1 as result;'
    })
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
}

testQuery().catch(console.error);
