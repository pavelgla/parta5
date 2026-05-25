-- Enable Row Level Security on tenant-scoped tables (FORCE applies to table owners too)
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Module" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ContentBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentBlock" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" FORCE ROW LEVEL SECURITY;

-- Policies: allow access when app.current_school_id matches school_id
CREATE POLICY school_isolation ON "Course"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "Module"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "Lesson"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "ContentBlock"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "Enrollment"
  USING (
    EXISTS (
      SELECT 1 FROM "Course" c
      WHERE c.id = "Enrollment"."courseId"
        AND c."schoolId" = current_setting('app.current_school_id', true)::uuid
    )
  );
