#!/usr/bin/env bash
# =============================================================================
# 数据库初始化脚本（Linux / macOS）
# 用法：
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=wpx \
#     PGPASSWORD=xxxx bash scripts/init-db.sh
# 依赖：psql 命令
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "${SCRIPT_DIR}/.." && pwd )"
SQL_FILE="${ROOT_DIR}/sql/init.sql"

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "[init-db] ERROR: ${SQL_FILE} not found" >&2
  exit 1
fi

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=wpx}"

echo "[init-db] Connecting ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
echo "[init-db] Applying ${SQL_FILE}"

# 使用 ON_ERROR_STOP=1，任何一条 SQL 失败立即退出
psql \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --variable=ON_ERROR_STOP=1 \
  --echo-errors \
  --file="${SQL_FILE}"

echo "[init-db] Done."