import http from 'node:http';
import { readFileSync } from 'node:fs';
const targets = { '/auth/v1': 'auth:9999', '/rest/v1': 'rest:3000' };
http
  .createServer((request, response) => {
    if (request.url === '/templates/invite') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(readFileSync('/runtime/invite.html'));
      return;
    }
    const prefix = Object.keys(targets).find(
      (path) => request.url === path || request.url.startsWith(`${path}/`),
    );
    if (!prefix) {
      response.writeHead(404);
      response.end();
      return;
    }
    const [hostname, port] = targets[prefix].split(':');
    const upstream = http.request(
      {
        hostname,
        port,
        path: request.url.slice(prefix.length) || '/',
        method: request.method,
        headers: request.headers,
      },
      (result) => {
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response);
      },
    );
    upstream.on('error', () => {
      response.writeHead(503);
      response.end();
    });
    request.pipe(upstream);
  })
  .listen(8080, '0.0.0.0');
