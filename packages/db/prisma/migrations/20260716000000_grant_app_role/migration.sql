-- Grant least-privilege access to parta5_app (the runtime role used by web/worker).
-- The role is created out-of-band by docker/postgres-init/01-app-role.sh (or manually
-- for existing installations) — this migration only wires up its privileges, and is a
-- no-op if the role doesn't exist yet (e.g. a local dev DB that hasn't been re-created).
DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parta5_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO parta5_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO parta5_app;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO parta5_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO parta5_app;
  ELSE
    RAISE NOTICE 'Role parta5_app does not exist — skipping grants (create it via docker/postgres-init/01-app-role.sh or manually, then re-run these grants).';
  END IF;
END
$$;
