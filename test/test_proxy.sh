#!/usr/bin/env bash

# Test script for Forward Proxy
PROXY_HOST="127.0.0.1"
PROXY_PORT="8080"
PROXY_URL="http://${PROXY_HOST}:${PROXY_PORT}"

echo "=========================================="
echo "🧪 Forward Proxy 기능 검증 테스트 시작"
echo "프록시 주소: ${PROXY_URL}"
echo "=========================================="

# 0. 프록시 서버 실행 여부 확인
if ! nc -z -w 2 ${PROXY_HOST} ${PROXY_PORT} 2>/dev/null; then
    echo "❌ 에러: ${PROXY_HOST}:${PROXY_PORT} 에서 프록시 서버가 실행 중이지 않습니다."
    echo "먼저 'npm start' 또는 'node src/server.js'를 실행해 주세요."
    exit 1
fi

echo "✅ 프록시 서버 연결 확인 완료."
echo ""

# 1. HTTP 테스트
echo "------------------------------------------"
echo "1. HTTP 요청 테스트 (http://example.com)"
echo "------------------------------------------"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -x ${PROXY_URL} http://example.com)
if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ [성공] HTTP 요청 정상 처리 (상태 코드: $HTTP_STATUS)"
else
    echo "❌ [실패] HTTP 요청 비정상 (상태 코드: $HTTP_STATUS)"
fi
echo ""

# 2. HTTPS CONNECT 터널링 테스트
echo "------------------------------------------"
echo "2. HTTPS CONNECT 터널링 테스트 (https://example.com)"
echo "------------------------------------------"
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -x ${PROXY_URL} https://example.com)
if [ "$HTTPS_STATUS" -eq 200 ]; then
    echo "✅ [성공] HTTPS 터널링 정상 처리 (상태 코드: $HTTPS_STATUS)"
else
    echo "❌ [실패] HTTPS 터널링 비정상 (상태 코드: $HTTPS_STATUS)"
fi
echo ""

# 3. HTTP 차단(Blacklist) 테스트
echo "------------------------------------------"
echo "3. HTTP 도메인 차단 테스트 (http://blocked.com)"
echo "------------------------------------------"
BLOCKED_HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -x ${PROXY_URL} http://blocked.com)
if [ "$BLOCKED_HTTP_STATUS" -eq 403 ]; then
    echo "✅ [성공] 차단된 도메인 정상 필터링 (상태 코드: $BLOCKED_HTTP_STATUS)"
else
    echo "❌ [실패] 차단 실패 또는 예기치 않은 상태 코드 (상태 코드: $BLOCKED_HTTP_STATUS)"
fi
echo ""

# 4. HTTPS 차단(Blacklist) 테스트
echo "------------------------------------------"
echo "4. HTTPS 도메인 차단 테스트 (https://blocked.com)"
echo "------------------------------------------"
# CONNECT 터널링 단계에서의 프록시 응답 코드는 curl의 %{http_connect} 변수로 확인합니다.
BLOCKED_HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_connect}" -x ${PROXY_URL} https://blocked.com)
if [ "$BLOCKED_HTTPS_STATUS" -eq 403 ]; then
    echo "✅ [성공] HTTPS CONNECT 차단 정상 필터링 (프록시 응답 코드: $BLOCKED_HTTPS_STATUS)"
else
    echo "❌ [실패] HTTPS CONNECT 차단 실패 (프록시 응답 코드: $BLOCKED_HTTPS_STATUS)"
fi
echo ""

echo "=========================================="
echo "🎉 모든 테스트 완료!"
echo "=========================================="
