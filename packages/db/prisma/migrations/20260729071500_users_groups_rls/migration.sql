-- Enable Row Level Security on group tables (FORCE applies to table owners too)
ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Group" FORCE ROW LEVEL SECURITY;
ALTER TABLE "GroupMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMembership" FORCE ROW LEVEL SECURITY;

-- Policies: allow access when app.current_school_id matches schoolId
CREATE POLICY school_isolation ON "Group"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "GroupMembership"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);
