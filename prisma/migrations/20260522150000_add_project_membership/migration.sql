-- Add ProjectMembership for optional per-project ring-fencing

CREATE TABLE "ProjectMembership" (
    "id"        TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "firmId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMembership_projectId_userId_key" ON "ProjectMembership"("projectId", "userId");
CREATE INDEX "ProjectMembership_projectId_idx" ON "ProjectMembership"("projectId");
CREATE INDEX "ProjectMembership_userId_firmId_idx" ON "ProjectMembership"("userId", "firmId");

ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
