-- Enable Row Level Security on quiz-engine tables (FORCE applies to table owners too)
ALTER TABLE "QuestionBank" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionBank" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Quiz" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quiz" FORCE ROW LEVEL SECURITY;
ALTER TABLE "QuizQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuizQuestion" FORCE ROW LEVEL SECURITY;
ALTER TABLE "QuizAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuizAttempt" FORCE ROW LEVEL SECURITY;
ALTER TABLE "QuizResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuizResponse" FORCE ROW LEVEL SECURITY;

-- Policies: allow access when app.current_school_id matches schoolId
CREATE POLICY school_isolation ON "QuestionBank"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "Question"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "Quiz"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "QuizQuestion"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "QuizAttempt"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY school_isolation ON "QuizResponse"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true)::uuid);
