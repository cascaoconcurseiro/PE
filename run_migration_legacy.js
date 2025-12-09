
const https = require('https');
const fs = require('fs');
const path = require('path');

const supabaseHost = 'mlqzeihukezlozooqhko.supabase.co';
const supabasePath = '/rest/v1/rpc/exec';
const supabaseKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const sqlPath = path.join(process.cwd(), 'SHARED_EXPENSES_MIGRATION.sql');
console.log('Reading SQL file:', sqlPath);
const query = fs.readFileSync(sqlPath, 'utf8');

const postData = JSON.stringify({ query: query });

const options = {
    hostname: supabaseHost,
    port: 443,
    path: supabasePath,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('Sending request to Supabase...');

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Migration executed successfully!');
        } else {
            console.error('❌ Migration failed.');
            console.error('Response Body:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('Problem with request:', e.message);
});

req.write(postData);
req.end();
