#!/bin/sh
# =============================================================================
# Self-contained container entrypoint.
#
# Render's free plan provides no managed MySQL, so this image carries its own
# MariaDB server for the deliberately vulnerable ShopSphere sandbox:
#
#   1. initialise a data directory (ephemeral on Render free - re-seeded on
#      every restart/deploy, which is acceptable for sample data)
#   2. start MariaDB on 127.0.0.1:3306 (never exposed outside the container)
#   3. load database/schema.sql + seed.sql when the catalogue is empty
#   4. create the DML-only shop_app account
#   5. drop privileges and start the Express API
# =============================================================================
set -eu

DATADIR="${MARIADB_DATADIR:-/var/lib/shopsphere-mysql}"
SOCKET="/run/mysqld/mysqld.sock"
DB_NAME="${DB_NAME:-shopping_store}"
DB_USER="${DB_USER:-shop_app}"
DB_PASSWORD="${DB_PASSWORD:-ShopyieeDb2026Local}"

mkdir -p "$DATADIR" /run/mysqld
chown -R mysql:mysql "$DATADIR" /run/mysqld

# ---------------------------------------------------------------------------
# 1. Initialise the data directory on first boot.
# ---------------------------------------------------------------------------
if [ ! -d "$DATADIR/mysql" ]; then
  echo "[entrypoint] initialising MariaDB data directory"
  if command -v mariadb-install-db >/dev/null 2>&1; then
    mariadb-install-db --user=mysql --datadir="$DATADIR" --skip-test-db >/tmp/mariadb-init.log 2>&1
  else
    mysql_install_db --user=mysql --datadir="$DATADIR" --skip-test-db >/tmp/mariadb-init.log 2>&1
  fi
fi

# ---------------------------------------------------------------------------
# 2. Start MariaDB (loopback only) with small buffers for a 512 MB instance.
# ---------------------------------------------------------------------------
echo "[entrypoint] starting MariaDB"
if command -v mariadbd >/dev/null 2>&1; then MARIADBD=mariadbd; else MARIADBD=mysqld; fi
"$MARIADBD" --user=mysql --datadir="$DATADIR" --socket="$SOCKET" \
  --bind-address=127.0.0.1 --port=3306 --skip-networking=0 \
  --innodb-buffer-pool-size=64M --performance-schema=OFF --max-connections=20 \
  --skip-log-bin --key-buffer-size=8M --aria-pagecache-buffer-size=8M \
  --table-open-cache=64 >/tmp/mariadb.log 2>&1 &
MARIADB_PID=$!
trap 'kill "$MARIADB_PID" 2>/dev/null || true' INT TERM EXIT

i=0
until mysqladmin --socket="$SOCKET" -uroot ping >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[entrypoint] ERROR: MariaDB did not start"
    tail -30 /tmp/mariadb.log || true
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] MariaDB ready"

# ---------------------------------------------------------------------------
# 3. Seed the sample data when the catalogue is empty.
# ---------------------------------------------------------------------------
COUNT=$(mysql --socket="$SOCKET" -uroot -N -B -e "SELECT COUNT(*) FROM $DB_NAME.products" 2>/dev/null || echo 0)
if [ "${COUNT:-0}" -eq 0 ]; then
  echo "[entrypoint] loading schema and sample data"
  mysql --socket="$SOCKET" -uroot < /app/database/schema.sql
  mysql --socket="$SOCKET" -uroot < /app/database/seed.sql
fi

# ---------------------------------------------------------------------------
# 4. DML-only application account (mirrors database/grants.sql).
# ---------------------------------------------------------------------------
mysql --socket="$SOCKET" -uroot <<SQL
CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'%' IDENTIFIED BY '$DB_PASSWORD';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.* TO '$DB_USER'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# ---------------------------------------------------------------------------
# 5. Wait until the app account can actually reach MariaDB over TCP before
#    handing over to Node (Alpine ships `skip-networking` in its defaults).
# ---------------------------------------------------------------------------
i=0
until mysql -h127.0.0.1 -P3306 -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[entrypoint] ERROR: MariaDB is not accepting TCP connections"
    tail -30 /tmp/mariadb.log || true
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] MariaDB TCP ready"

# ---------------------------------------------------------------------------
# 6. Start the API as the unprivileged application user.
# ---------------------------------------------------------------------------
echo "[entrypoint] starting API"
exec su-exec shopsphere node server.js