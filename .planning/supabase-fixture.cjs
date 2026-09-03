const http = require('node:http');
http.createServer((req,res) => {
  res.setHeader('Content-Type','application/json');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','*');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (req.url.startsWith('/auth/')) { res.statusCode=401; res.end(JSON.stringify({message:'No local guest session'})); return; }
  res.setHeader('Content-Range','*/0');
  res.end('[]');
}).listen(3134,'127.0.0.1');
