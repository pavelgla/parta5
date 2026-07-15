#!/usr/bin/env bash
# Creates the least-privilege application role (parta5_app) used by web/worker.
# Mounted into /docker-entrypoint-initdb.d — runs once, on first cluster init.
# The migrate service keeps using the owner role (parta5), since migrations need DDL.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	DO
	\$\$
	BEGIN
	  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parta5_app') THEN
	    CREATE ROLE parta5_app LOGIN PASSWORD '${POSTGRES_APP_PASSWORD}'
	      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
	  END IF;
	END
	\$\$;

	GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO parta5_app;
	GRANT USAGE ON SCHEMA public TO parta5_app;
EOSQL
