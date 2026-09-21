# Forward Proxy 실전 테스트 가이드 (Test Guide)

이 문서는 구현된 **Forward Proxy 서버의 동작을 검증하기 위한 완벽한 테스트 매뉴얼**입니다.  
자동화 스크립트부터 `curl` 명령어 세부 분석, 프로그래밍 언어별 연동, 브라우저 테스트 및 트러블슈팅까지 단계별로 안내합니다.

---

## 📋 목차
1. [사전 준비 및 서버 실행](#1-사전-준비-및-서버-실행)
2. [원클릭 자동 검증 스크립트](#2-원클릭-자동-검증-스크립트)
3. [`curl`을 활용한 단계별 수동 검증](#3-curl을-활용한-단계별-수동-검증)
   - [3.1 HTTP GET 요청 (Absolute URI 확인)](#31-http-get-요청-absolute-uri-확인)
   - [3.2 HTTP POST 요청 (바디 스트리밍 확인)](#32-http-post-요청-바디-스트리밍-확인)
   - [3.3 HTTPS CONNECT 터널링 (TLS 핸드셰이크 관찰)](#33-https-connect-터널링-tls-핸드셰이크-관찰)
   - [3.4 도메인 차단(Blacklist) 테스트](#34-도메인-차단blacklist-테스트)
   - [3.5 대용량 파일 스트리밍 다운로드](#35-대용량-파일-스트리밍-다운로드)
4. [프로그래밍 언어별 클라이언트 연동 테스트](#4-프로그래밍-언어별-클라이언트-연동-테스트)
   - [4.1 Python (`requests`)](#41-python-requests)
   - [4.2 Node.js (`fetch` / `http`)](#42-nodejs-fetch--http)
5. [환경 변수 및 웹 브라우저 연동 테스트](#5-환경-변수-및-웹-브라우저-연동-테스트)
   - [5.1 터미널 환경 변수 설정](#51-터미널-환경-변수-설정)
   - [5.2 Chrome 브라우저 격리 실행](#52-chrome-브라우저-격리-실행)
6. [자주 발생하는 오류 및 트러블슈팅 (FAQ)](#6-자주-발생하는-오류-및-트러블슈팅-faq)

---

## 1. 사전 준비 및 서버 실행

모든 테스트는 로컬 프록시 서버(`127.0.0.1:8080`)가 켜져 있어야 합니다.

### 프록시 서버 실행
터미널을 열고 프로젝트 루트에서 다음 명령어를 실행합니다:
```bash
npm start
# 또는
node src/server.js
```

#### 정상 실행 로그
```text
=========================================
🚀 Forward Proxy Server is running on port 8080
- HTTP Proxy : http://127.0.0.1:8080
- Blocked Domains: blocked.com, www.blocked.com, malware.test, ads.example.com
=========================================
```

> **포트 확인 팁**: 포트 8080이 이미 사용 중인지 확인하려면 `lsof -i :8080`을 실행하세요.

---

## 2. 원클릭 자동 검증 스크립트

프록시 서버가 실행 중인 상태에서 **새 터미널 창**을 열고 아래 명령어를 실행하면 모든 핵심 기능(HTTP, HTTPS, 차단 정책)을 1초 만에 검증합니다.

```bash
npm run test:proxy
# 또는 bash test/test_proxy.sh
```

### 테스트 항목 및 예상 출력
```text
==========================================
🧪 Forward Proxy 기능 검증 테스트 시작
프록시 주소: http://127.0.0.1:8080
==========================================
✅ 프록시 서버 연결 확인 완료.

------------------------------------------
1. HTTP 요청 테스트 (http://example.com)
------------------------------------------
✅ [성공] HTTP 요청 정상 처리 (상태 코드: 200)

------------------------------------------
2. HTTPS CONNECT 터널링 테스트 (https://example.com)
------------------------------------------
✅ [성공] HTTPS 터널링 정상 처리 (상태 코드: 200)

------------------------------------------
3. HTTP 도메인 차단 테스트 (http://blocked.com)
------------------------------------------
✅ [성공] 차단된 도메인 정상 필터링 (상태 코드: 403)

------------------------------------------
4. HTTPS 도메인 차단 테스트 (https://blocked.com)
------------------------------------------
✅ [성공] HTTPS CONNECT 차단 정상 필터링 (프록시 응답 코드: 403)

==========================================
🎉 모든 테스트 완료!
==========================================
```

---

## 3. `curl`을 활용한 단계별 수동 검증

`curl`의 `-v` (verbose) 옵션을 사용하면 패킷 헤더와 프록시 협상 과정을 직접 눈으로 확인할 수 있습니다.

### 3.1 HTTP GET 요청 (Absolute URI 확인)
```bash
curl -v -x http://127.0.0.1:8080 http://example.com
```

#### 관찰 포인트
1. `> GET http://example.com/ HTTP/1.1`: 일반 요청(`GET / HTTP/1.1`)과 달리 **Absolute URI**가 전송됩니다.
2. `< HTTP/1.1 200 OK`: 목적지 서버로부터 받은 응답 헤더와 바디가 클라이언트로 정상 반환됩니다.
3. 프록시 콘솔: `[HTTP] GET http://example.com/` 로그가 찍힙니다.

---

### 3.2 HTTP POST 요청 (바디 스트리밍 확인)
프록시가 클라이언트의 Request Body를 목적지 서버로 끊김 없이 스트리밍하는지 테스트합니다.
```bash
curl -v -x http://127.0.0.1:8080 \
  -X POST http://httpbin.org/post \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Forward Proxy!"}'
```

#### 관찰 포인트
- 응답 JSON에 클라이언트가 전송한 `{"message": "Hello Forward Proxy!"}` 데이터가 그대로 반환되는지 확인합니다.

---

### 3.3 HTTPS CONNECT 터널링 (TLS 핸드셰이크 관찰)
HTTPS는 암호화 통신이므로 프록시에게 먼저 터널 개설(`CONNECT`)을 요청해야 합니다.
```bash
curl -v -x http://127.0.0.1:8080 https://example.com
```

#### 관찰 포인트 (출력 순서)
1. `* Establish HTTP proxy tunnel to example.com:443`
2. `> CONNECT example.com:443 HTTP/1.1` (프록시에게 목적지와의 TCP 연결 요청)
3. `< HTTP/1.1 200 Connection Established` (프록시가 목적지 연결 성공 후 응답)
4. `* TLSv1.3 (OUT), TLS handshake, Client hello (1):` (터널 통과 후 클라이언트와 목적지 간 직접 TLS 협상 시작)
5. `< HTTP/2 200` (암호화 통신을 통한 정상 응답 수신)

---

### 3.4 도메인 차단(Blacklist) 테스트
프록시의 `BLOCKED_DOMAINS`에 등록된 도메인(`blocked.com`)으로 요청을 보내 차단 동작을 검증합니다.

#### HTTP 차단 검증
```bash
curl -i -x http://127.0.0.1:8080 http://blocked.com
```
* **결과**: `HTTP/1.1 403 Forbidden` 반환 및 `403 Forbidden: 이 도메인은 프록시 정책에 의해 차단되었습니다.` 메시지 출력.

#### HTTPS 차단 검증
```bash
curl -v -x http://127.0.0.1:8080 https://blocked.com
```
* **결과**: 
  * `> CONNECT blocked.com:443 HTTP/1.1`
  * `< HTTP/1.1 403 Forbidden` (터널 개설이 즉시 거절됨)
  * `curl: (56) CONNECT tunnel failed, response 403`

> 💡 **curl 변수 팁**:  
> HTTPS 프록시 터널 개설 시의 프록시 응답 코드를 스크립트에서 추출하려면 `%{http_connect}` 변수를 사용합니다.
> ```bash
> curl -s -o /dev/null -w "%{http_connect}\n" -x http://127.0.0.1:8080 https://blocked.com
> # 출력: 403
> ```

---

### 3.5 대용량 파일 스트리밍 다운로드
프록시가 전체 파일을 메모리에 버퍼링하지 않고 `pipe()`를 통해 메모리 누수 없이 중계하는지 확인합니다.
Cloudflare의 공식 속도 측정 엔드포인트를 사용합니다 (10MB 또는 100MB).

```bash
# 10MB 테스트 (따옴표 필수)
curl -x http://127.0.0.1:8080 -o /dev/null "https://speed.cloudflare.com/__down?bytes=10485760"

# 100MB 테스트
curl -x http://127.0.0.1:8080 -o /dev/null "https://speed.cloudflare.com/__down?bytes=104857600"
```
* 진행률 표시줄(Progress bar)이 부드럽게 증가하며 정상 다운로드되는지 확인합니다.

---

## 4. 프로그래밍 언어별 클라이언트 연동 테스트

애플리케이션 코드 내에서 우리가 만든 프록시를 경유하도록 설정하는 방법입니다.

### 4.1 Python (`requests`)
```python
import requests

proxies = {
    "http": "http://127.0.0.1:8080",
    "https": "http://127.0.0.1:8080",
}

# 1. HTTP 테스트
res_http = requests.get("http://example.com", proxies=proxies)
print(f"HTTP Status: {res_http.status_code}")

# 2. HTTPS 테스트
res_https = requests.get("https://example.com", proxies=proxies)
print(f"HTTPS Status: {res_https.status_code}")
```

### 4.2 Node.js (`fetch` / `undici`)
Node.js v18+에서는 기본 `fetch`에 프록시 에이전트를 연결할 수 있습니다:
```javascript
const { ProxyAgent, fetch } = require('undici'); // 또는 https-proxy-agent 사용

const client = new ProxyAgent('http://127.0.0.1:8080');

async function test() {
  const res = await fetch('https://example.com', { dispatcher: client });
  console.log('Status:', res.status);
}
test();
```

---

## 5. 환경 변수 및 웹 브라우저 연동 테스트

### 5.1 터미널 환경 변수 설정
터미널 세션 전체의 네트워크 요청을 프록시로 통과시키려면 환경 변수를 등록합니다.
```bash
export http_proxy=http://127.0.0.1:8080
export https_proxy=http://127.0.0.1:8080

# 이제 -x 옵션 없이 일반 curl 명령어도 프록시를 거칩니다.
curl http://example.com
curl https://example.com

# 테스트 완료 후 원복
unset http_proxy https_proxy
```

### 5.2 Chrome 브라우저 격리 실행 (강화 가이드)

기존 개인 브라우징 환경(북마크, 로그인 세션, 확장 프로그램 등)을 전혀 건드리지 않고, **완전히 격리된 임시 프로필(Sandbox)**을 생성하여 프록시를 테스트합니다.

---

#### 5.2.1 원클릭 실행 스크립트
터미널에서 아래 명령어를 실행하면 모든 옵션이 적용된 격리된 Chrome 창이 바로 실행됩니다.
```bash
npm run test:chrome
# 또는 bash test/test_chrome.sh
```

---

#### 5.2.2 수동 CLI 명령어 및 주요 플래그 분석
수동으로 실행하거나 플래그를 커스텀하고 싶다면 다음 명령어를 사용합니다:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --user-data-dir=/tmp/chrome-proxy-test \
  --proxy-server="http://127.0.0.1:8080" \
  --no-first-run \
  --no-default-browser-check \
  "http://example.com"
```

| 플래그 | 역할 및 필요성 |
| :--- | :--- |
| `--user-data-dir=/tmp/chrome-proxy-test` | 기존 Chrome 프로필과 완전 분리된 임시 프로필 디렉터리를 지정합니다. 메인 Chrome에 영향을 주지 않습니다. |
| `--proxy-server="http://127.0.0.1:8080"` | Chrome의 모든 네트워크 트래픽(HTTP/HTTPS)을 우리가 만든 프록시로 강제 라우팅합니다. |
| `--no-first-run` | 새 프로필 생성 시 뜨는 "Chrome 시작하기/로그인" 첫 실행 팝업을 건너뜁니다. |
| `--no-default-browser-check` | "Chrome을 기본 브라우저로 설정하시겠습니까?" 팝업을 띄우지 않습니다. |

---

#### 5.2.3 브라우저에서 수행할 4가지 실전 검증 시나리오

1. **시나리오 1: 순수 HTTP 사이트 접속 (`http://neverssl.com` 또는 `http://example.com`)**
   - 주소창에 `http://neverssl.com` 입력 후 접속합니다.
   - **개발자 도구(F12)** -> **Network** 탭 -> 아무 요청이나 클릭 -> **Headers** 탭 확인:
     - `Remote Address`: **`127.0.0.1:8080`** (실제 서버 IP가 아니라 우리 프록시 IP로 통신 중임을 확인)
   - 프록시 서버 터미널에 `[HTTP] GET http://neverssl.com/` 로그가 기록됩니다.

2. **시나리오 2: HTTPS 사이트 접속 (`https://example.com` 또는 `https://google.com`)**
   - 주소창에 `https://example.com` 입력 후 접속합니다.
   - 브라우저는 정상적으로 자물쇠 아이콘(보안 연결)을 표시하며 페이지를 렌더링합니다.
   - 프록시 서버 터미널에는 `[HTTPS CONNECT] example.com:443` 로그가 출력되어, 터널을 통한 TLS 핸드셰이크가 성공했음을 확인할 수 있습니다.

3. **시나리오 3: 차단 도메인 접속 테스트 (`http://blocked.com` / `https://blocked.com`)**
   - 주소창에 `http://blocked.com` 입력:
     - 브라우저 화면에 `403 Forbidden: 이 도메인은 프록시 정책에 의해 차단되었습니다.` 텍스트가 즉시 표시됩니다.
   - 주소창에 `https://blocked.com` 입력:
     - 프록시가 `CONNECT` 요청을 `403`으로 거절하므로, 브라우저 화면에 **`ERR_TUNNEL_CONNECTION_FAILED`** 에러 페이지가 노출됩니다.
   - 프록시 서버 터미널에 `[BLOCKED] ... 요청 차단됨: blocked.com` 경고 로그가 출력됩니다.

4. **시나리오 4: Chrome 내부 프록시 상태 진단 (`chrome://net-internals/#proxy`)**
   - 주소창에 `chrome://net-internals/#proxy` 입력 후 접속합니다.
   - Chrome 내부 네트워킹 스택에 설정된 **Effective proxy settings**가 `PROXY 127.0.0.1:8080`으로 등록되어 있는지 직접 확인할 수 있습니다.

---

#### 5.2.4 테스트 완료 후 임시 데이터 정리
테스트가 끝난 후 Chrome 창을 닫고, 생성된 임시 프로필 폴더를 삭제하면 로컬 저장 공간이 깔끔하게 유지됩니다.
```bash
rm -rf /tmp/chrome-proxy-test
```


---

## 6. 자주 발생하는 오류 및 트러블슈팅 (FAQ)

### Q1. `curl: (7) Failed to connect to 127.0.0.1 port 8080: Connection refused`
- **원인**: 프록시 서버(`src/server.js`)가 실행되어 있지 않습니다.
- **해결**: 터미널에서 `npm start`로 서버를 먼저 실행하세요.

### Q2. `curl: (56) CONNECT tunnel failed, response 403`
- **원인**: 접근하려는 도메인이 `BLOCKED_DOMAINS`에 등록되어 프록시가 차단한 것입니다.
- **해결**: 정상적인 차단 동작입니다. 차단을 해제하려면 `src/server.js`의 `BLOCKED_DOMAINS`에서 해당 도메인을 제거하세요.

### Q3. `502 Bad Gateway: 목적지 서버에 연결할 수 없습니다`
- **원인**: 클라이언트가 요청한 목적지 서버의 도메인이 존재하지 않거나, 목적지 포트가 닫혀 있는 경우입니다.
- **해결**: 목적지 URL의 오타 여부나 인터넷 연결 상태를 확인하세요.
