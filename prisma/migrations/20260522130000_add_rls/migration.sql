-- Stage 3.5: Row-Level Security
-- Enables RLS on tenant-critical tables and creates policies scoped to
-- app.current_firm_id and app.current_user_id session variables.
--
-- Design:
--   - Application code sets these variables via SET LOCAL inside a transaction.
--   - If the variable is not set (e.g. background workers, migrations), the
--     policy falls back to allowing access so existing code is not broken.
--     Background workers must set the variables explicitly for full isolation.
--   - The application model layer still filters by firmId/userId in WHERE
--     clauses. RLS is the second layer that catches any missed filter.

-- ─── Helper: safe current_setting that returns NULL when unset ───────────────
-- We use current_setting(name, true) — the second arg suppresses the error
-- when the variable is not set, returning '' instead.

-- ─── Project ─────────────────────────────────────────────────────────────────
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" FORCE ROW LEVEL SECURITY;

CREATE POLICY "project_firm_isolation" ON "Project"
  USING (
    current_setting('app.current_firm_id', true) = ''
    OR "firmId" = current_setting('app.current_firm_id', true)
  );

-- ─── DiligenceJob ─────────────────────────────────────────────────────────────
ALTER TABLE "DiligenceJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceJob" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_job_user_isolation" ON "DiligenceJob"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceStageRun ────────────────────────────────────────────────────────
-- Scoped via jobId → DiligenceJob, but we add a direct policy for safety.
ALTER TABLE "DiligenceStageRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceStageRun" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_stage_run_isolation" ON "DiligenceStageRun"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR EXISTS (
      SELECT 1 FROM "DiligenceJob" j
      WHERE j.id = "DiligenceStageRun"."jobId"
        AND j."userId" = current_setting('app.current_user_id', true)
    )
  );

-- ─── DiligenceArtifact ────────────────────────────────────────────────────────
ALTER TABLE "DiligenceArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceArtifact" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_artifact_user_isolation" ON "DiligenceArtifact"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceChunk ───────────────────────────────────────────────────────────
ALTER TABLE "DiligenceChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceChunk" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_chunk_user_isolation" ON "DiligenceChunk"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceFinding ─────────────────────────────────────────────────────────
ALTER TABLE "DiligenceFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceFinding" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_finding_user_isolation" ON "DiligenceFinding"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceClaim ───────────────────────────────────────────────────────────
ALTER TABLE "DiligenceClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceClaim" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_claim_user_isolation" ON "DiligenceClaim"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceEntity ──────────────────────────────────────────────────────────
ALTER TABLE "DiligenceEntity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceEntity" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_entity_user_isolation" ON "DiligenceEntity"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceContradiction ───────────────────────────────────────────────────
ALTER TABLE "DiligenceContradiction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceContradiction" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_contradiction_user_isolation" ON "DiligenceContradiction"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceQuestionAnswer ──────────────────────────────────────────────────
ALTER TABLE "DiligenceQuestionAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceQuestionAnswer" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_qa_user_isolation" ON "DiligenceQuestionAnswer"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceEvidenceGap ─────────────────────────────────────────────────────
ALTER TABLE "DiligenceEvidenceGap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceEvidenceGap" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_evidence_gap_user_isolation" ON "DiligenceEvidenceGap"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceOpenQuestion ────────────────────────────────────────────────────
ALTER TABLE "DiligenceOpenQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceOpenQuestion" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_open_question_user_isolation" ON "DiligenceOpenQuestion"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── DiligenceDocumentClassification ─────────────────────────────────────────
ALTER TABLE "DiligenceDocumentClassification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiligenceDocumentClassification" FORCE ROW LEVEL SECURITY;

CREATE POLICY "diligence_doc_class_user_isolation" ON "DiligenceDocumentClassification"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── ProjectDocument ──────────────────────────────────────────────────────────
ALTER TABLE "ProjectDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectDocument" FORCE ROW LEVEL SECURITY;

CREATE POLICY "project_document_user_isolation" ON "ProjectDocument"
  USING (
    current_setting('app.current_user_id', true) = ''
    OR "userId" = current_setting('app.current_user_id', true)
  );

-- ─── EvidenceMapping ──────────────────────────────────────────────────────────
ALTER TABLE "EvidenceMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EvidenceMapping" FORCE ROW LEVEL SECURITY;

CREATE POLICY "evidence_mapping_firm_isolation" ON "EvidenceMapping"
  USING (
    current_setting('app.current_firm_id', true) = ''
    OR "firmId" = current_setting('app.current_firm_id', true)
  );

-- ─── AssistanceGoal ───────────────────────────────────────────────────────────
-- Scoped via projectId → Project (which has firm RLS), no direct userId/firmId.
-- We rely on the Project policy cascading through joins in application queries.
-- No direct RLS needed here since it's always accessed via project context.

-- ─── AuditLog ─────────────────────────────────────────────────────────────────
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_firm_isolation" ON "AuditLog"
  USING (
    current_setting('app.current_firm_id', true) = ''
    OR "firmId" = current_setting('app.current_firm_id', true)
  );
