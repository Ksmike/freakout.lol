/**
 * RLS integration tests — run against the real database.
 *
 * These tests prove that cross-firm and cross-user reads are rejected
 * at the database layer when RLS session variables are set.
 *
 * Run with: yarn test:integration
 *
 * Each test creates its own isolated data and cleans up after itself.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { withFirmContext, withUserContext } from "@/lib/db-context";
import { Prisma } from "@/lib/generated/prisma/client";

// ─── Test data helpers ────────────────────────────────────────────────────────

async function createTestFirm(slug: string) {
  return db.firm.create({
    data: {
      name: `Test Firm ${slug}`,
      slug: `test-rls-${slug}-${Date.now()}`,
    },
    select: { id: true, slug: true },
  });
}

async function createTestUser(email: string) {
  return db.user.create({
    data: {
      email: `rls-test-${Date.now()}-${email}`,
      password: "hashed",
      locale: "en",
    },
    select: { id: true },
  });
}

async function createTestProject(firmId: string, userId: string, name: string) {
  return db.project.create({
    data: {
      name,
      firmId,
      userId,
      status: "DRAFT",
    },
    select: { id: true },
  });
}

// ─── Cleanup tracking ─────────────────────────────────────────────────────────

const createdFirmIds: string[] = [];
const createdUserIds: string[] = [];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RLS — Project table", () => {
  let firmA: { id: string };
  let firmB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let projectA: { id: string };
  let projectB: { id: string };

  beforeAll(async () => {
    firmA = await createTestFirm("a");
    firmB = await createTestFirm("b");
    userA = await createTestUser("user-a@rls.test");
    userB = await createTestUser("user-b@rls.test");

    createdFirmIds.push(firmA.id, firmB.id);
    createdUserIds.push(userA.id, userB.id);

    // Create memberships so FirmModel.ensureDefaultForUser works
    await db.firmMembership.createMany({
      data: [
        { firmId: firmA.id, userId: userA.id, role: "OWNER", status: "ACTIVE", acceptedAt: new Date() },
        { firmId: firmB.id, userId: userB.id, role: "OWNER", status: "ACTIVE", acceptedAt: new Date() },
      ],
    });

    projectA = await createTestProject(firmA.id, userA.id, "RLS Project A");
    projectB = await createTestProject(firmB.id, userB.id, "RLS Project B");
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await db.project.deleteMany({ where: { firmId: { in: createdFirmIds } } });
    await db.firmMembership.deleteMany({ where: { firmId: { in: createdFirmIds } } });
    await db.firm.deleteMany({ where: { id: { in: createdFirmIds } } });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it("firm A can read its own project when context is set", async () => {
    const projects = await withFirmContext(
      { firmId: firmA.id, userId: userA.id },
      (tx) => tx.project.findMany({ where: { firmId: firmA.id } })
    );

    const ids = projects.map((p) => p.id);
    expect(ids).toContain(projectA.id);
    expect(ids).not.toContain(projectB.id);
  });

  it("firm B cannot read firm A project when context is set to firm B", async () => {
    const projects = await withFirmContext(
      { firmId: firmB.id, userId: userB.id },
      (tx) =>
        tx.project.findMany({
          where: { id: projectA.id }, // explicitly try to read firm A's project
        })
    );

    // RLS should filter this out — firm B's context cannot see firm A's project
    expect(projects).toHaveLength(0);
  });

  it("direct read without context returns all rows (RLS allows when var unset)", async () => {
    // Without context, the policy falls back to allowing access.
    // This is intentional — background workers and migrations need unrestricted access.
    const project = await db.project.findUnique({ where: { id: projectA.id } });
    expect(project).not.toBeNull();
  });

  it("firm A cannot read firm B project even with explicit WHERE bypass attempt", async () => {
    // Simulate a bug where application code forgets to filter by firmId
    // but the RLS context is correctly set to firm A.
    const projects = await withFirmContext(
      { firmId: firmA.id, userId: userA.id },
      (tx) =>
        tx.project.findMany({
          // No firmId filter — relies entirely on RLS
          where: { name: "RLS Project B" },
        })
    );

    expect(projects).toHaveLength(0);
  });
});

describe("RLS — DiligenceJob table", () => {
  let firmA: { id: string };
  let firmB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let projectA: { id: string };
  let projectB: { id: string };
  let jobA: { id: string };

  beforeAll(async () => {
    firmA = await createTestFirm("dj-a");
    firmB = await createTestFirm("dj-b");
    userA = await createTestUser("dj-user-a@rls.test");
    userB = await createTestUser("dj-user-b@rls.test");

    createdFirmIds.push(firmA.id, firmB.id);
    createdUserIds.push(userA.id, userB.id);

    await db.firmMembership.createMany({
      data: [
        { firmId: firmA.id, userId: userA.id, role: "OWNER", status: "ACTIVE", acceptedAt: new Date() },
        { firmId: firmB.id, userId: userB.id, role: "OWNER", status: "ACTIVE", acceptedAt: new Date() },
      ],
    });

    projectA = await createTestProject(firmA.id, userA.id, "RLS DJ Project A");
    projectB = await createTestProject(firmB.id, userB.id, "RLS DJ Project B");

    // Create a diligence job for user A
    jobA = await db.diligenceJob.create({
      data: {
        projectId: projectA.id,
        userId: userA.id,
        selectedProvider: "OPENAI",
        selectedModel: "gpt-4o-mini",
        status: "QUEUED",
        inputDocumentCount: 0,
      },
      select: { id: true },
    });
  });

  afterAll(async () => {
    await db.diligenceJob.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.project.deleteMany({ where: { firmId: { in: createdFirmIds } } });
    await db.firmMembership.deleteMany({ where: { firmId: { in: createdFirmIds } } });
    await db.firm.deleteMany({ where: { id: { in: createdFirmIds } } });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it("user A can read their own diligence job", async () => {
    const jobs = await withUserContext(userA.id, (tx) =>
      tx.diligenceJob.findMany({ where: { userId: userA.id } })
    );

    const ids = jobs.map((j) => j.id);
    expect(ids).toContain(jobA.id);
  });

  it("user B cannot read user A diligence job when context is set to user B", async () => {
    const jobs = await withUserContext(userB.id, (tx) =>
      tx.diligenceJob.findMany({
        where: { id: jobA.id }, // explicitly try to read user A's job
      })
    );

    expect(jobs).toHaveLength(0);
  });

  it("user B cannot read user A job even without a userId filter", async () => {
    // Simulate a bug where application code omits the userId filter
    const jobs = await withUserContext(userB.id, (tx) =>
      tx.diligenceJob.findMany({
        where: { projectId: projectA.id }, // no userId filter
      })
    );

    expect(jobs).toHaveLength(0);
  });
});

describe("RLS — EvidenceMapping table", () => {
  let firmA: { id: string };
  let firmB: { id: string };
  let userA: { id: string };
  let projectA: { id: string };
  let graphId: string;
  let requirementId: string;

  beforeAll(async () => {
    firmA = await createTestFirm("em-a");
    firmB = await createTestFirm("em-b");
    userA = await createTestUser("em-user-a@rls.test");

    createdFirmIds.push(firmA.id, firmB.id);
    createdUserIds.push(userA.id);

    await db.firmMembership.create({
      data: { firmId: firmA.id, userId: userA.id, role: "OWNER", status: "ACTIVE", acceptedAt: new Date() },
    });

    projectA = await createTestProject(firmA.id, userA.id, "RLS EM Project A");

    // Create a minimal graph + requirement for the mapping
    const graph = await db.knowledgeGraphDefinition.create({
      data: { slug: `rls-test-graph-${Date.now()}`, name: "RLS Test Graph", status: "PUBLISHED" },
      select: { id: true },
    });
    graphId = graph.id;

    const node = await db.ontologyNode.create({
      data: { graphId, slug: "rls-test-node", label: "RLS Node", kind: "QUESTION" },
      select: { id: true },
    });

    const req = await db.evidenceRequirement.create({
      data: { graphId, nodeId: node.id, title: "RLS Test Requirement" },
      select: { id: true },
    });
    requirementId = req.id;

    // Create an evidence mapping for firm A
    await db.evidenceMapping.create({
      data: {
        projectId: projectA.id,
        requirementId,
        userId: userA.id,
        firmId: firmA.id,
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    await db.evidenceMapping.deleteMany({ where: { firmId: { in: createdFirmIds } } });
    await db.evidenceRequirement.deleteMany({ where: { graphId } });
    await db.ontologyNode.deleteMany({ where: { graphId } });
    await db.knowledgeGraphDefinition.deleteMany({ where: { id: graphId } });
    await db.project.deleteMany({ where: { firmId: { in: createdFirmIds } } });
    await db.firmMembership.deleteMany({ where: { firmId: { in: createdFirmIds } } });
    await db.firm.deleteMany({ where: { id: { in: createdFirmIds } } });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it("firm A can read its own evidence mappings", async () => {
    const mappings = await withFirmContext(
      { firmId: firmA.id, userId: userA.id },
      (tx) => tx.evidenceMapping.findMany({ where: { firmId: firmA.id } })
    );

    expect(mappings.length).toBeGreaterThan(0);
    expect(mappings.every((m) => m.firmId === firmA.id)).toBe(true);
  });

  it("firm B cannot read firm A evidence mappings", async () => {
    const mappings = await withFirmContext(
      { firmId: firmB.id },
      (tx) =>
        tx.evidenceMapping.findMany({
          where: { projectId: projectA.id }, // no firmId filter — relies on RLS
        })
    );

    expect(mappings).toHaveLength(0);
  });
});
