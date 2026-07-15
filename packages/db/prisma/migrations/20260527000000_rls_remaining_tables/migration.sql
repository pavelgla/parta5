-- Enable Row Level Security on remaining tenant-scoped tables (FORCE applies to table owners too)
ALTER TABLE "BlockView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlockView" FORCE ROW LEVEL SECURITY;
ALTER TABLE "FileAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FileAsset" FORCE ROW LEVEL SECURITY;
ALTER TABLE "VideoAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VideoAsset" FORCE ROW LEVEL SECURITY;
ALTER TABLE "LearningEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningEvent" FORCE ROW LEVEL SECURITY;

-- Policies: allow access when app.current_school_id matches schoolId
CREATE POLICY school_isolation ON "BlockView"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "FileAsset"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "VideoAsset"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "LearningEvent"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);
