#!/usr/bin/env bash
# 显式安装当前平台的 Vite/Tailwind 原生 binding（规避 npm optional deps bug）
set -euo pipefail

cd wpx-app

case "$(uname -s)/$(uname -m)" in
  Linux/x86_64)
    pkgs="@rolldown/binding-linux-x64-gnu@1.0.0-rc.17 @tailwindcss/oxide-linux-x64-gnu@4.3.1"
    ;;
  Linux/aarch64|Linux/arm64)
    pkgs="@rolldown/binding-linux-arm64-gnu@1.0.0-rc.17 @tailwindcss/oxide-linux-arm64-gnu@4.3.1"
    ;;
  Darwin/arm64)
    pkgs="@rolldown/binding-darwin-arm64@1.0.0-rc.17 @tailwindcss/oxide-darwin-arm64@4.3.1"
    ;;
  Darwin/x86_64)
    pkgs="@rolldown/binding-darwin-x64@1.0.0-rc.17 @tailwindcss/oxide-darwin-x64@4.3.1"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    pkgs="@rolldown/binding-win32-x64-msvc@1.0.0-rc.17 @tailwindcss/oxide-win32-x64-msvc@4.3.1"
    ;;
  *)
    echo "Unsupported platform: $(uname -s)/$(uname -m)"
    exit 1
    ;;
esac

echo "Installing native bindings: $pkgs"
npm install --no-save --legacy-peer-deps $pkgs
