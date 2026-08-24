#!/usr/bin/env bash
# 显式安装当前平台的 Vite/Tailwind 原生 binding（规避 npm optional deps bug）
set -euo pipefail

cd wpx-app

case "$(uname -s)/$(uname -m)" in
  Linux/x86_64)
    rolldown_pkg="@rolldown/binding-linux-x64-gnu@1.0.0-rc.17"
    oxide_pkg="@tailwindcss/oxide-linux-x64-gnu@4.3.1"
    ;;
  Linux/aarch64|Linux/arm64)
    rolldown_pkg="@rolldown/binding-linux-arm64-gnu@1.0.0-rc.17"
    oxide_pkg="@tailwindcss/oxide-linux-arm64-gnu@4.3.1"
    ;;
  Darwin/arm64)
    rolldown_pkg="@rolldown/binding-darwin-arm64@1.0.0-rc.17"
    oxide_pkg="@tailwindcss/oxide-darwin-arm64@4.3.1"
    ;;
  Darwin/x86_64)
    rolldown_pkg="@rolldown/binding-darwin-x64@1.0.0-rc.17"
    oxide_pkg="@tailwindcss/oxide-darwin-x64@4.3.1"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    rolldown_pkg="@rolldown/binding-win32-x64-msvc@1.0.0-rc.17"
    oxide_pkg="@tailwindcss/oxide-win32-x64-msvc@4.3.1"
    ;;
  *)
    echo "Unsupported platform: $(uname -s)/$(uname -m)"
    exit 1
    ;;
esac

pkgs="$rolldown_pkg $oxide_pkg"
echo "Installing native bindings: $pkgs"

# 顶层 hoisted（供 require.resolve 预检）
npm install --no-save --legacy-peer-deps $pkgs

# rolldown / oxide 运行时从各自 package 目录解析 optional binding
rolldown_dir="$(node -e "console.log(require('path').dirname(require.resolve('rolldown/package.json')))")"
oxide_dir="$(node -e "console.log(require('path').dirname(require.resolve('@tailwindcss/oxide/package.json')))")"

echo "Installing rolldown binding into $rolldown_dir"
npm install --no-save --legacy-peer-deps --prefix "$rolldown_dir" "$rolldown_pkg"

echo "Installing oxide binding into $oxide_dir"
npm install --no-save --legacy-peer-deps --prefix "$oxide_dir" "$oxide_pkg"

echo "Native bindings installed (hoisted + nested)"
