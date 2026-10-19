import { createServer } from 'node:http';

// Тестовый upstream проверяет реальное прохождение запроса через Vite proxy.
// Это не FastAPI и не проверка PostgreSQL.
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('X-Finsmart-Test-Upstream', 'true');
  if (request.url === '/api/v1/health/ready' && request.method === 'GET') {
    response.end(JSON.stringify({ status: 'ok' }));
  } else {
    response.writeHead(404).end(JSON.stringify({ detail: 'Not Found' }));
  }
});

server.listen(18080, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { server.close(); });
}
