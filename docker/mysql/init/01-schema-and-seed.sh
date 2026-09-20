#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  ShopSphere - MySQL first-boot initialiser
#
#  The official MySQL image executes every file inside
#  /docker-entrypoint-initdb.d the first time the data volume is created.
#
#  This script
#    1. applies the table definitions (schema.sql),
#    2. creates the application account and grants it DML only (grants.sql),
#       substituting the real DB_PASSWORD for the `change_me_app_password`
#       placeholder the file ships with, and
#    3. loads the fabricated sample catalogue (seed.sql).
#
#  It only ever runs against a brand new volume.  To re-run it:
#      docker compose down -v && docker compose up --build
# ---------------------------------------------------------------------------
set -euo pipefail

: "${DB_PASSWORD:?DB_PASSWORD must be set (see .env.example)}"
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD must be set (see .env.example)}"

SCHEMA_FILE=/opt/shopsphere/schema.sql
GRANTS_FILE=/opt/shopsphere/grants.sql
SEED_FILE=/opt/shopsphere/seed.sql
PLACEHOLDER='change_me_app_password'

MYSQL_ARGS=(--protocol=socket --default-character-set=utf8mb4 -uroot -p"${MYSQL_ROOT_PASSWORD}")

# Escape the characters that are special on the right-hand side of a sed
# substitution so that passwords containing & | \ are handled correctly.
escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

if [ ! -f "$SCHEMA_FILE" ] || [ ! -f "$GRANTS_FILE" ] || [ ! -f "$SEED_FILE" ]; then
  echo "[init] ERROR: expected $SCHEMA_FILE, $GRANTS_FILE and $SEED_FILE to be mounted read-only" >&2
  exit 1
fi

echo "[init] creating schema"
mysql "${MYSQL_ARGS[@]}" < "$SCHEMA_FILE"

echo "[init] creating application account (password from DB_PASSWORD)"
sed "s|${PLACEHOLDER}|$(escape_sed_replacement "$DB_PASSWORD")|g" "$GRANTS_FILE" \
  | mysql "${MYSQL_ARGS[@]}"

# Belt and braces: make sure the account password matches even if the grants
# file is ever applied without the substitution step.
mysql "${MYSQL_ARGS[@]}" <<SQL
ALTER USER 'shop_app'@'%' IDENTIFIED BY '${DB_PASSWORD}';
FLUSH PRIVILEGES;
SQL

echo "[init] loading sample catalogue"
mysql "${MYSQL_ARGS[@]}" < "$SEED_FILE"

echo "[init] done - $(mysql "${MYSQL_ARGS[@]}" -N -B -e \
  "SELECT CONCAT(COUNT(*), ' products') FROM shopping_store.products")"
