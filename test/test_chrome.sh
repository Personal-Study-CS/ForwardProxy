#!/usr/bin/env bash

# Chrome Isolated Sandbox Launcher for Forward Proxy Testing
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TEMP_PROFILE="/tmp/chrome-proxy-test"
PROXY_ADDR="http://127.0.0.1:8080"

# 1. Chrome 설치 여부 확인
if [ ! -f "$CHROME_BIN" ]; then
    echo "❌ Google Chrome을 찾을 수 없습니다: $CHROME_BIN"
    echo "Chrome이 설치되어 있는지 확인해 주세요."
    exit 1
fi

# 2. 프록시 서버 구동 여부 확인
if ! nc -z -w 2 127.0.0.1 8080 2>/dev/null; then
    echo "⚠️ 경고: 127.0.0.1:8080 에 프록시 서버가 실행 중이지 않습니다."
    echo "먼저 다른 터미널에서 'npm start'를 실행해 주세요."
    exit 1
fi

echo "=========================================="
echo "🌐 Chrome 격리 샌드박스 실행"
echo "- 프록시 서버 : $PROXY_ADDR"
echo "- 임시 프로필 : $TEMP_PROFILE"
echo "=========================================="
echo "팁: 개발자 도구(F12) Network 탭에서 Remote Address가 127.0.0.1:8080으로 표시됩니다."
echo ""

# 3. 격리된 Chrome 실행
# --user-data-dir : 기존 개인 북마크/쿠키/확장프로그램과 완전 분리된 독립 환경 생성
# --proxy-server : 모든 트래픽을 우리가 만든 프록시로 라우팅
# --no-first-run : 첫 실행 안내 위저드 생략
# --no-default-browser-check : 기본 브라우저 설정 팝업 차단
"$CHROME_BIN" \
  --user-data-dir="$TEMP_PROFILE" \
  --proxy-server="$PROXY_ADDR" \
  --no-first-run \
  --no-default-browser-check \
  "http://example.com" \
  "https://example.com" >/dev/null 2>&1 &

echo "✅ Chrome 격리 창이 실행되었습니다."
