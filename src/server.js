/**
 * Forward Proxy Server Implementation in Node.js
 *
 * 이 서버는 두 가지 핵심 프로토콜 흐름을 처리합니다:
 * 1. HTTP 요청 중계 ('request' 이벤트):
 *    - 클라이언트가 'GET http://example.com/path HTTP/1.1' 형태로 보낸 Absolute URI 요청을 처리합니다.
 *    - 목적지 서버로 새 HTTP 요청을 생성하고, 스트림 파이핑(req.pipe -> proxyReq, proxyRes.pipe -> res)을 수행합니다.
 *
 * 2. HTTPS CONNECT 터널링 ('connect' 이벤트):
 *    - 클라이언트가 'CONNECT example.com:443 HTTP/1.1' 형태로 터널 개설을 요청하면
 *    - 목적지 서버와 TCP 소켓을 맺은 뒤 '200 Connection Established'를 응답합니다.
 *    - 이후 클라이언트 소켓과 서버 소켓 간의 양방향 바이트 스트림(Blind Relay)을 수행합니다.
 */

const http = require('http');
const net = require('net');
const url = require('url');

// 기본 포트 설정
const PORT = process.env.PORT || 8080;

// 접근 차단 도메인 목록 (블랙리스트 예시)
const BLOCKED_DOMAINS = new Set([
  'blocked.com',
  'www.blocked.com',
  'malware.test',
  'ads.example.com'
]);

/**
 * 도메인이 차단 목록에 포함되어 있는지 확인하는 헬퍼 함수
 */
function isBlocked(hostname) {
  if (!hostname) return false;
  // 포트 번호가 포함되어 있다면 제거 (예: blocked.com:443 -> blocked.com)
  const cleanHost = hostname.split(':')[0].toLowerCase();
  return BLOCKED_DOMAINS.has(cleanHost);
}

// 1. HTTP 서버 인스턴스 생성
const server = http.createServer();

/**
 * =================================================================
 * [1] HTTP 요청 처리 ('request' 이벤트)
 * =================================================================
 */
server.on('request', (req, res) => {
  const parsedUrl = url.parse(req.url);
  const hostname = parsedUrl.hostname;

  console.log(`[HTTP] ${req.method} ${req.url}`);

  // 1. 도메인 접근 제어(Filtering)
  if (isBlocked(hostname)) {
    console.warn(`[BLOCKED] HTTP 요청 차단됨: ${hostname}`);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: 이 도메인은 프록시 정책에 의해 차단되었습니다.\n');
    return;
  }

  // 2. 목적지 서버로 보낼 요청 옵션 구성
  // Hop-by-hop 헤더(프록시와 클라이언트 간의 연결에만 유효한 헤더) 제거
  const headers = { ...req.headers };
  delete headers['proxy-connection'];
  delete headers['proxy-authorization'];

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: req.method,
    headers: headers
  };

  // 3. 목적지 서버로 새 HTTP 요청 생성
  const proxyReq = http.request(options, (proxyRes) => {
    // 목적지 서버의 응답 헤더를 클라이언트에게 그대로 전달
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    // 목적지 서버의 응답 바디 스트림을 클라이언트로 파이핑
    proxyRes.pipe(res, { end: true });
  });

  // 4. 에러 처리 (목적지 서버 연결 실패 등)
  proxyReq.on('error', (err) => {
    console.error(`[HTTP ERROR] ${parsedUrl.hostname}: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`502 Bad Gateway: 목적지 서버에 연결할 수 없습니다. (${err.message})\n`);
    }
  });

  // 5. 클라이언트가 보낸 요청 바디(POST 데이터 등)를 목적지 서버 요청으로 파이핑
  req.pipe(proxyReq, { end: true });
});

/**
 * =================================================================
 * [2] HTTPS CONNECT 터널링 처리 ('connect' 이벤트)
 * =================================================================
 */
/**
 * =================================================================
 * [2] HTTPS CONNECT 터널링 처리 ('connect' 이벤트)
 * =================================================================
 */
server.on('connect', (req, clientSocket, head) => {
  let serverSocket = null;

  // 1. 클라이언트 소켓 에러 핸들러를 최우선으로 등록
  // (curl 등이 403 Forbidden 응답 수신 후 즉시 소켓을 리셋(RST)할 때 ECONNRESET 발생 방지)
  clientSocket.on('error', (err) => {
    if (err.code !== 'ECONNRESET') {
      console.warn(`[CLIENT SOCKET ERROR] ${err.message}`);
    }
    if (serverSocket) {
      serverSocket.destroy();
    }
  });

  // req.url 예시: "example.com:443"
  const [targetHost, targetPortStr] = req.url.split(':');
  const targetPort = parseInt(targetPortStr, 10) || 443;

  console.log(`[HTTPS CONNECT] ${req.url}`);

  // 2. 도메인 접근 제어(Filtering)
  if (isBlocked(targetHost)) {
    console.warn(`[BLOCKED] HTTPS CONNECT 요청 차단됨: ${targetHost}`);
    clientSocket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n403 Forbidden: 차단된 도메인입니다.\n');
    clientSocket.end();
    return;
  }

  // 3. 목적지 서버로 TCP 소켓 연결 생성
  serverSocket = net.connect(targetPort, targetHost, () => {
    // 목적지와 TCP 연결 성공 시 클라이언트에게 200 Connection Established 응답
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

    // CONNECT 요청 직후 도착한 초기 데이터(head 버퍼)가 있다면 목적지 서버로 먼저 전송
    if (head && head.length > 0) {
      serverSocket.write(head);
    }

    // 4. 양방향 데이터 스트림 파이핑 (Blind Relay)
    // 클라이언트 -> 목적지 서버
    clientSocket.pipe(serverSocket);
    // 목적지 서버 -> 클라이언트
    serverSocket.pipe(clientSocket);
  });

  // 5. 목적지 서버 소켓 에러 및 종료 처리
  serverSocket.on('error', (err) => {
    console.error(`[TUNNEL ERROR] ${req.url}: ${err.message}`);
    if (clientSocket.writable) {
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.end();
    }
  });

  serverSocket.on('end', () => {
    clientSocket.end();
  });

  clientSocket.on('end', () => {
    if (serverSocket) {
      serverSocket.end();
    }
  });
});

// 클라이언트 연결 에러 처리 (비정상 종료 등)
server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) {
    return;
  }
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Forward Proxy Server is running on port ${PORT}`);
  console.log(`- HTTP Proxy : http://127.0.0.1:${PORT}`);
  console.log(`- Blocked Domains: ${Array.from(BLOCKED_DOMAINS).join(', ')}`);
  console.log(`=========================================`);
});

