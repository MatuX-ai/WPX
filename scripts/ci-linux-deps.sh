#!/usr/bin/env bash
# GitHub Actions Linux 构建依赖（兼容 Ubuntu 22.04 / 24.04 包名差异）
set -euo pipefail

pick_pkg() {
  for pkg in "$@"; do
    if apt-cache policy "$pkg" 2>/dev/null | grep -qE 'Candidate: [0-9]'; then
      echo "$pkg"
      return 0
    fi
  done
  echo "ERROR: no installable package among: $*" >&2
  return 1
}

sudo apt-get update

specs=(
  "libgtk-3-0 libgtk-3-0t64"
  "libnotify4"
  "libnss3"
  "libxss1"
  "libxtst6"
  "xdg-utils"
  "libatspi2.0-0 libatspi2.0-0t64"
  "libuuid1"
  "libsecret-1-0"
  "libasound2 libasound2t64"
  "libatk1.0-0 libatk1.0-0t64"
  "libatk-bridge2.0-0 libatk-bridge2.0-0t64"
  "libcups2 libcups2t64"
  "libdrm2"
  "libxkbcommon0"
  "libxcomposite1"
  "libxdamage1"
  "libxrandr2"
  "libgbm1"
  "libpango-1.0-0 libpango-1.0-0t64"
  "libcairo2 libcairo2t64"
  "libxshmfence1"
)

pkgs=()
for spec in "${specs[@]}"; do
  # shellcheck disable=SC2206
  candidates=($spec)
  pkgs+=("$(pick_pkg "${candidates[@]}")")
done

echo "Installing: ${pkgs[*]}"
sudo apt-get install -y --no-install-recommends "${pkgs[@]}"
