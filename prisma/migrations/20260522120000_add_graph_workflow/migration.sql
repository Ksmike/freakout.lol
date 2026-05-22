-- Stage 3.4: Graph Workflow MVP
-- Adds KnowledgeGraphDefinition, OntologyNode, OntologyEdge, FirmGraphEnablement,
-- AssistanceGoal, EvidenceRequirement, EvidenceMapping, OutputTemplate

-- CreateEnum
CREATE TYPE "GraphDefinitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');
CREATE TYPE "OntologyNodeKind" AS ENUM ('ENTITY', 'CONTROL', 'EVIDENCE_TYPE', 'QUESTION', 'OUTPUT_SECTION', 'RISK_CATEGORY');
CREATE TYPE "OntologyEdgeKind" AS ENUM ('REQUIRES', 'SATISFIES', 'CONTRADICTS', 'MAPS_TO', 'ESCALATES_TO', 'PART_OF');
CREATE TYPE "EvidenceRequirementStatus" AS ENUM ('OPEN', 'PARTIAL', 'SATISFIED', 'WAIVED');
CREATE TYPE "OutputTemplateKind" AS ENUM ('REPORT', 'QUESTIONNAIRE', 'REVIEW_PACK', 'EXPORT_BUNDLE');

-- CreateTable: KnowledgeGraphDefinition
CREATE TABLE "KnowledgeGraphDefinition" (
    "id"          TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "version"     INTEGER NOT NULL DEFAULT 1,
    "status"      "GraphDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeGraphDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OntologyNode
CREATE TABLE "OntologyNode" (
    "id"          TEXT NOT NULL,
    "graphId"     TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "description" TEXT,
    "kind"        "OntologyNodeKind" NOT NULL,
    "metadata"    JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OntologyNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OntologyEdge
CREATE TABLE "OntologyEdge" (
    "id"        TEXT NOT NULL,
    "graphId"   TEXT NOT NULL,
    "sourceId"  TEXT NOT NULL,
    "targetId"  TEXT NOT NULL,
    "kind"      "OntologyEdgeKind" NOT NULL,
    "weight"    DOUBLE PRECISION,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OntologyEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FirmGraphEnablement
CREATE TABLE "FirmGraphEnablement" (
    "id"        TEXT NOT NULL,
    "firmId"    TEXT NOT NULL,
    "graphId"   TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledBy" TEXT NOT NULL,
    CONSTRAINT "FirmGraphEnablement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AssistanceGoal
CREATE TABLE "AssistanceGoal" (
    "id"        TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "graphId"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssistanceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EvidenceRequirement
CREATE TABLE "EvidenceRequirement" (
    "id"          TEXT NOT NULL,
    "graphId"     TEXT NOT NULL,
    "nodeId"      TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "priority"    TEXT NOT NULL DEFAULT 'medium',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EvidenceMapping
CREATE TABLE "EvidenceMapping" (
    "id"            TEXT NOT NULL,
    "projectId"     TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "firmId"        TEXT NOT NULL,
    "status"        "EvidenceRequirementStatus" NOT NULL DEFAULT 'OPEN',
    "chunkRefs"     JSONB,
    "claimRefs"     JSONB,
    "findingRefs"   JSONB,
    "analystNote"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EvidenceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OutputTemplate
CREATE TABLE "OutputTemplate" (
    "id"        TEXT NOT NULL,
    "graphId"   TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "kind"      "OutputTemplateKind" NOT NULL,
    "schema"    JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutputTemplate_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "KnowledgeGraphDefinition_slug_key" ON "KnowledgeGraphDefinition"("slug");
CREATE UNIQUE INDEX "OntologyNode_graphId_slug_key" ON "OntologyNode"("graphId", "slug");
CREATE UNIQUE INDEX "OntologyEdge_graphId_sourceId_targetId_kind_key" ON "OntologyEdge"("graphId", "sourceId", "targetId", "kind");
CREATE UNIQUE INDEX "FirmGraphEnablement_firmId_graphId_key" ON "FirmGraphEnablement"("firmId", "graphId");
CREATE UNIQUE INDEX "AssistanceGoal_projectId_key" ON "AssistanceGoal"("projectId");
CREATE UNIQUE INDEX "EvidenceMapping_projectId_requirementId_key" ON "EvidenceMapping"("projectId", "requirementId");
CREATE UNIQUE INDEX "OutputTemplate_graphId_slug_key" ON "OutputTemplate"("graphId", "slug");

-- Regular indexes
CREATE INDEX "KnowledgeGraphDefinition_status_idx" ON "KnowledgeGraphDefinition"("status");
CREATE INDEX "KnowledgeGraphDefinition_slug_version_idx" ON "KnowledgeGraphDefinition"("slug", "version");
CREATE INDEX "OntologyNode_graphId_kind_idx" ON "OntologyNode"("graphId", "kind");
CREATE INDEX "OntologyEdge_graphId_idx" ON "OntologyEdge"("graphId");
CREATE INDEX "OntologyEdge_sourceId_idx" ON "OntologyEdge"("sourceId");
CREATE INDEX "OntologyEdge_targetId_idx" ON "OntologyEdge"("targetId");
CREATE INDEX "FirmGraphEnablement_firmId_idx" ON "FirmGraphEnablement"("firmId");
CREATE INDEX "AssistanceGoal_graphId_idx" ON "AssistanceGoal"("graphId");
CREATE INDEX "EvidenceRequirement_graphId_idx" ON "EvidenceRequirement"("graphId");
CREATE INDEX "EvidenceRequirement_nodeId_idx" ON "EvidenceRequirement"("nodeId");
CREATE INDEX "EvidenceMapping_projectId_status_idx" ON "EvidenceMapping"("projectId", "status");
CREATE INDEX "EvidenceMapping_requirementId_idx" ON "EvidenceMapping"("requirementId");
CREATE INDEX "EvidenceMapping_firmId_idx" ON "EvidenceMapping"("firmId");
CREATE INDEX "OutputTemplate_graphId_kind_idx" ON "OutputTemplate"("graphId", "kind");

-- Foreign keys
ALTER TABLE "OntologyNode" ADD CONSTRAINT "OntologyNode_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "KnowledgeGraphDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OntologyEdge" ADD CONSTRAINT "OntologyEdge_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "KnowledgeGraphDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OntologyEdge" ADD CONSTRAINT "OntologyEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OntologyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OntologyEdge" ADD CONSTRAINT "OntologyEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "OntologyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FirmGraphEnablement" ADD CONSTRAINT "FirmGraphEnablement_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FirmGraphEnablement" ADD CONSTRAINT "FirmGraphEnablement_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "KnowledgeGraphDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistanceGoal" ADD CONSTRAINT "AssistanceGoal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistanceGoal" ADD CONSTRAINT "AssistanceGoal_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "KnowledgeGraphDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceRequirement" ADD CONSTRAINT "EvidenceRequirement_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "KnowledgeGraphDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceRequirement" ADD CONSTRAINT "EvidenceRequirement_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "OntologyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceMapping" ADD CONSTRAINT "EvidenceMapping_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceMapping" ADD CONSTRAINT "EvidenceMapping_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "EvidenceRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceMapping" ADD CONSTRAINT "EvidenceMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceMapping" ADD CONSTRAINT "EvidenceMapping_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutputTemplate" ADD CONSTRAINT "OutputTemplate_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "KnowledgeGraphDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
