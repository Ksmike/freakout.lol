import { db } from "@/lib/db";
import {
  GraphDefinitionStatus,
  EvidenceRequirementStatus,
  Prisma,
} from "@/lib/generated/prisma/client";

// ─── Public types ─────────────────────────────────────────────────────────────

export type GraphSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  version: number;
  status: GraphDefinitionStatus;
  requirementCount: number;
  isEnabledForFirm: boolean;
};

export type GraphWithRequirements = GraphSummary & {
  requirements: RequirementSummary[];
  outputTemplates: OutputTemplateSummary[];
};

export type RequirementSummary = {
  id: string;
  nodeId: string;
  nodeSlug: string;
  nodeLabel: string;
  nodeKind: string;
  title: string;
  description: string | null;
  priority: string;
};

export type OutputTemplateSummary = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  schema: unknown;
};

export type MappingSummary = {
  requirementId: string;
  requirementTitle: string;
  nodeLabel: string;
  nodeKind: string;
  priority: string;
  status: EvidenceRequirementStatus;
  analystNote: string | null;
  chunkRefs: unknown;
  claimRefs: unknown;
  findingRefs: unknown;
};

export type GapSummary = {
  requirementId: string;
  requirementTitle: string;
  nodeLabel: string;
  nodeKind: string;
  priority: string;
  status: EvidenceRequirementStatus;
};

// ─── GraphModel ───────────────────────────────────────────────────────────────

export const GraphModel = {
  // ── Platform-level graph listing ─────────────────────────────────────────

  async listPublished(): Promise<GraphSummary[]> {
    const graphs = await db.knowledgeGraphDefinition.findMany({
      where: { status: GraphDefinitionStatus.PUBLISHED },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { evidenceRequirements: true } },
      },
    });

    return graphs.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      version: g.version,
      status: g.status,
      requirementCount: g._count.evidenceRequirements,
      isEnabledForFirm: false,
    }));
  },

  async listAll(): Promise<GraphSummary[]> {
    const graphs = await db.knowledgeGraphDefinition.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { evidenceRequirements: true } },
      },
    });

    return graphs.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      version: g.version,
      status: g.status,
      requirementCount: g._count.evidenceRequirements,
      isEnabledForFirm: false,
    }));
  },

  async findById(graphId: string) {
    return db.knowledgeGraphDefinition.findUnique({
      where: { id: graphId },
      include: {
        nodes: { orderBy: { kind: "asc" } },
        evidenceRequirements: {
          include: { node: true },
          orderBy: [{ node: { kind: "asc" } }, { priority: "asc" }],
        },
        outputTemplates: { orderBy: { kind: "asc" } },
        _count: { select: { evidenceRequirements: true } },
      },
    });
  },

  async findBySlug(slug: string) {
    return db.knowledgeGraphDefinition.findUnique({
      where: { slug },
      include: {
        nodes: { orderBy: { kind: "asc" } },
        evidenceRequirements: {
          include: { node: true },
          orderBy: [{ node: { kind: "asc" } }, { priority: "asc" }],
        },
        outputTemplates: { orderBy: { kind: "asc" } },
        _count: { select: { evidenceRequirements: true } },
      },
    });
  },

  // ── Firm graph enablement ─────────────────────────────────────────────────

  async listEnabledForFirm(firmId: string): Promise<GraphSummary[]> {
    const enablements = await db.firmGraphEnablement.findMany({
      where: { firmId },
      include: {
        graph: {
          include: { _count: { select: { evidenceRequirements: true } } },
        },
      },
      orderBy: { enabledAt: "asc" },
    });

    return enablements.map((e) => ({
      id: e.graph.id,
      slug: e.graph.slug,
      name: e.graph.name,
      description: e.graph.description,
      version: e.graph.version,
      status: e.graph.status,
      requirementCount: e.graph._count.evidenceRequirements,
      isEnabledForFirm: true,
    }));
  },

  async listPublishedWithEnablementStatus(firmId: string): Promise<GraphSummary[]> {
    const [graphs, enablements] = await Promise.all([
      db.knowledgeGraphDefinition.findMany({
        where: { status: GraphDefinitionStatus.PUBLISHED },
        orderBy: { name: "asc" },
        include: { _count: { select: { evidenceRequirements: true } } },
      }),
      db.firmGraphEnablement.findMany({
        where: { firmId },
        select: { graphId: true },
      }),
    ]);

    const enabledIds = new Set(enablements.map((e) => e.graphId));

    return graphs.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      version: g.version,
      status: g.status,
      requirementCount: g._count.evidenceRequirements,
      isEnabledForFirm: enabledIds.has(g.id),
    }));
  },

  async enableForFirm(input: {
    firmId: string;
    graphId: string;
    enabledBy: string;
  }): Promise<void> {
    await db.firmGraphEnablement.upsert({
      where: { firmId_graphId: { firmId: input.firmId, graphId: input.graphId } },
      create: {
        firmId: input.firmId,
        graphId: input.graphId,
        enabledBy: input.enabledBy,
      },
      update: { enabledBy: input.enabledBy, enabledAt: new Date() },
    });
  },

  async disableForFirm(input: { firmId: string; graphId: string }): Promise<void> {
    await db.firmGraphEnablement.deleteMany({
      where: { firmId: input.firmId, graphId: input.graphId },
    });
  },

  async isEnabledForFirm(firmId: string, graphId: string): Promise<boolean> {
    const count = await db.firmGraphEnablement.count({
      where: { firmId, graphId },
    });
    return count > 0;
  },

  // ── Assistance goal (per project) ─────────────────────────────────────────

  async getGoalForProject(projectId: string) {
    return db.assistanceGoal.findUnique({
      where: { projectId },
      include: {
        graph: {
          include: {
            evidenceRequirements: {
              include: { node: true },
              orderBy: [{ node: { kind: "asc" } }, { priority: "asc" }],
            },
            outputTemplates: { orderBy: { kind: "asc" } },
          },
        },
      },
    });
  },

  async setGoalForProject(input: {
    projectId: string;
    graphId: string;
  }): Promise<void> {
    await db.assistanceGoal.upsert({
      where: { projectId: input.projectId },
      create: { projectId: input.projectId, graphId: input.graphId },
      update: { graphId: input.graphId },
    });
  },

  // ── Evidence mappings ─────────────────────────────────────────────────────

  async getMappingsForProject(projectId: string): Promise<MappingSummary[]> {
    const mappings = await db.evidenceMapping.findMany({
      where: { projectId },
      include: {
        requirement: { include: { node: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return mappings.map((m) => ({
      requirementId: m.requirementId,
      requirementTitle: m.requirement.title,
      nodeLabel: m.requirement.node.label,
      nodeKind: m.requirement.node.kind,
      priority: m.requirement.priority,
      status: m.status,
      analystNote: m.analystNote,
      chunkRefs: m.chunkRefs,
      claimRefs: m.claimRefs,
      findingRefs: m.findingRefs,
    }));
  },

  async getGapsForProject(projectId: string): Promise<GapSummary[]> {
    // Get the assistance goal to know which requirements apply
    const goal = await this.getGoalForProject(projectId);
    if (!goal) return [];

    const requirements = goal.graph.evidenceRequirements;

    // Get existing mappings
    const mappings = await db.evidenceMapping.findMany({
      where: { projectId },
      select: { requirementId: true, status: true },
    });
    const mappingMap = new Map(mappings.map((m) => [m.requirementId, m.status]));

    // Return requirements that are OPEN or PARTIAL
    return requirements
      .filter((req) => {
        const status = mappingMap.get(req.id) ?? EvidenceRequirementStatus.OPEN;
        return (
          status === EvidenceRequirementStatus.OPEN ||
          status === EvidenceRequirementStatus.PARTIAL
        );
      })
      .map((req) => ({
        requirementId: req.id,
        requirementTitle: req.title,
        nodeLabel: req.node.label,
        nodeKind: req.node.kind,
        priority: req.priority,
        status: mappingMap.get(req.id) ?? EvidenceRequirementStatus.OPEN,
      }));
  },

  async upsertMapping(input: {
    projectId: string;
    requirementId: string;
    userId: string;
    firmId: string;
    status: EvidenceRequirementStatus;
    analystNote?: string | null;
    chunkRefs?: unknown;
    claimRefs?: unknown;
    findingRefs?: unknown;
  }): Promise<void> {
    await db.evidenceMapping.upsert({
      where: {
        projectId_requirementId: {
          projectId: input.projectId,
          requirementId: input.requirementId,
        },
      },
      create: {
        projectId: input.projectId,
        requirementId: input.requirementId,
        userId: input.userId,
        firmId: input.firmId,
        status: input.status,
        analystNote: input.analystNote ?? null,
        chunkRefs: (input.chunkRefs as Prisma.InputJsonValue) ?? null,
        claimRefs: (input.claimRefs as Prisma.InputJsonValue) ?? null,
        findingRefs: (input.findingRefs as Prisma.InputJsonValue) ?? null,
      },
      update: {
        status: input.status,
        analystNote: input.analystNote ?? null,
        ...(input.chunkRefs !== undefined && { chunkRefs: input.chunkRefs as Prisma.InputJsonValue }),
        ...(input.claimRefs !== undefined && { claimRefs: input.claimRefs as Prisma.InputJsonValue }),
        ...(input.findingRefs !== undefined && { findingRefs: input.findingRefs as Prisma.InputJsonValue }),
      },
    });
  },

  // ── Platform admin: create/update graph definitions ───────────────────────

  async createGraph(input: {
    slug: string;
    name: string;
    description?: string;
  }) {
    return db.knowledgeGraphDefinition.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        status: GraphDefinitionStatus.DRAFT,
      },
    });
  },

  async publishGraph(graphId: string): Promise<void> {
    await db.knowledgeGraphDefinition.update({
      where: { id: graphId },
      data: { status: GraphDefinitionStatus.PUBLISHED },
    });
  },

  async deprecateGraph(graphId: string): Promise<void> {
    await db.knowledgeGraphDefinition.update({
      where: { id: graphId },
      data: { status: GraphDefinitionStatus.DEPRECATED },
    });
  },

  async addNode(input: {
    graphId: string;
    slug: string;
    label: string;
    description?: string;
    kind: string;
    metadata?: object;
  }) {
    return db.ontologyNode.create({
      data: {
        graphId: input.graphId,
        slug: input.slug,
        label: input.label,
        description: input.description ?? null,
        kind: input.kind as Parameters<typeof db.ontologyNode.create>[0]["data"]["kind"],
        metadata: (input.metadata as Prisma.InputJsonValue) ?? null,
      },
    });
  },

  async addRequirement(input: {
    graphId: string;
    nodeId: string;
    title: string;
    description?: string;
    priority?: string;
  }) {
    return db.evidenceRequirement.create({
      data: {
        graphId: input.graphId,
        nodeId: input.nodeId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "medium",
      },
    });
  },

  async addOutputTemplate(input: {
    graphId: string;
    slug: string;
    name: string;
    kind: string;
    schema: object;
  }) {
    return db.outputTemplate.create({
      data: {
        graphId: input.graphId,
        slug: input.slug,
        name: input.name,
        kind: input.kind as Parameters<typeof db.outputTemplate.create>[0]["data"]["kind"],
        schema: input.schema as Prisma.InputJsonValue,
      },
    });
  },
};
