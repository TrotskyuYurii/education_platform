const http = require('http');

function ping(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runChecks() {
  try {
    console.log('1. Checking /api/core/features...');
    let res = await ping('/api/core/features');
    console.log(`Status: ${res.status}, Body: ${res.body.substring(0, 100)}`);

    console.log('\n2. Checking /api/auth/login (without data)...');
    res = await ping('/api/auth/login', 'POST', {});
    console.log(`Status: ${res.status}, Body: ${res.body.substring(0, 100)}`);

    console.log('\n3. Checking /api/progress (unauthenticated)...');
    res = await ping('/api/progress');
    console.log(`Status: ${res.status}, Body: ${res.body.substring(0, 100)}`);

  } catch (e) {
    console.error('Error during checks:', e.message);
  }
}

runChecks();
