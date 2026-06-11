const http = require('http');

const data = JSON.stringify({ code: 'test_user_code' });

const options = {
  hostname: 'localhost',
  port: 18080,
  path: '/api/user/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const token = JSON.parse(body).data.token;
    
    const myRoomsOptions = {
      hostname: 'localhost',
      port: 18080,
      path: '/api/room/my',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req2 = http.request(myRoomsOptions, res2 => {
      let body2 = '';
      res2.on('data', chunk => body2 += chunk);
      res2.on('end', () => {
        console.log("Response from /api/room/my:");
        console.log(body2);
      });
    });
    req2.end();
  });
});

req.write(data);
req.end();
