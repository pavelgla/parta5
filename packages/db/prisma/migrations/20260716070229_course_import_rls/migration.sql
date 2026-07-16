-- Enable Row Level Security on CourseImport (FORCE applies to table owners too)
ALTER TABLE "CourseImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseImport" FORCE ROW LEVEL SECURITY;

CREATE POLICY school_isolation ON "CourseImport"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);
