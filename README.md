# Forward Proxy Toy Project 🚀

클라이언트 측에서 외부 인터넷과의 통신을 중계하는 **Forward Proxy(포워드 프록시)**의 개념을 학습하고 직접 구현해보는 토이 프로젝트입니다.

---

## 📚 학습 문서 (Documentation)

1. [**Forward Proxy 개념 및 동작 원리**](docs/FORWARD_PROXY_CONCEPT.md)
   - Forward Proxy의 정의 및 Reverse Proxy와의 차이점
   - HTTP 요청 처리 방식 (Absolute URI)
   - HTTPS 요청 처리 방식 (`CONNECT` 메서드 및 TCP 터널링)
   - 사내망 접근 제어, 캐싱, SSL Bump 등 심화 개념

2. [**테스트 가이드**](docs/TEST_GUIDE.md)
   - `curl -x` 명령어를 통한 HTTP / HTTPS 터널링 동작 검증
   - 환경 변수(`http_proxy`, `https_proxy`) 설정 테스트
   - 크롬 브라우저 프록시 연동 테스트
   - 도메인 필터링 및 스트리밍 검증 방법

---

## 📁 디렉터리 구조

```text
ForwardProxy/
├── docs/
│   ├── FORWARD_PROXY_CONCEPT.md   # 개념 및 동작 원리 설명
│   └── TEST_GUIDE.md              # 테스트 방법 및 검증 시나리오
├── src/
│   └── server.js                  # Forward Proxy 서버 구현체 (Node.js)
├── test/
│   └── test_proxy.sh              # 자동화된 검증 테스트 스크립트
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 빠른 시작 (Quick Start)

### 1. 프록시 서버 실행
외부 라이브러리 설치 없이 Node.js 내장 모듈만으로 구동됩니다.
```bash
npm start
# 또는 node src/server.js
```
기본적으로 `http://127.0.0.1:8080`에서 프록시 서버가 실행됩니다.

### 2. 기능 테스트 실행
프록시 서버가 실행된 상태에서 다른 터미널 창을 열고 아래 명령어를 실행합니다:

- **CLI 자동 검증**:
  ```bash
  npm run test:proxy
  # 또는 bash test/test_proxy.sh
  ```

- **격리된 Chrome 브라우저 실행**:
  ```bash
  npm run test:chrome
  # 또는 bash test/test_chrome.sh
  ```


---

## 🛠 구현 기능 (Features)

- [x] **HTTP 요청 중계**: Absolute URI 파싱, 목적지 요청 및 응답 스트림 파이핑
- [x] **HTTPS `CONNECT` 터널링**: TCP 소켓 간 양방향 바이트 파이프(Blind Relay)
- [x] **도메인 접근 제어(Filtering)**: 차단 목록(`BLOCKED_DOMAINS`)에 등록된 사이트 접속 시 `403 Forbidden` 반환
- [x] **실시간 로깅**: `[HTTP]`, `[HTTPS CONNECT]`, `[BLOCKED]` 등 요청 이벤트 콘솔 출력
- [x] **검증 스크립트**: curl 기반의 자동화 검증 스크립트 제공
