#!/usr/bin/env bash
# Unix CI：Vite 构建，失败时将日志写入 Job Summary
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/vite-build.log"

cd "$ROOT/wpx-app"

echo "[ci-unix-build] node $(node --version) pwd $(pwd)"

node scripts/ci-verify-native-bindings.mjs

echo "[ci-unix-build] starting vite build..."
if npm run build 2>&1 | tee "$LOG"; then
  echo "[ci-unix-build] vite build OK"
  exit 0
fi

echo "[ci-unix-build] vite build FAILED"
if [ -f "$LOG" ]; then
  tail -40 "$LOG" | while IFS= read -r line; do
    echo "::error title=Vite build::$line"
  done
fi
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Vite build failed ($(uname -s)/$(uname -m))"
    echo '```'
    tail -120 "$LOG" || true
    echo '```'
  } >> "$GITHUB_STEP_SUMMARY"
fi

exit 1
