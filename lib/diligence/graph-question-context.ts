import { db } from "@/lib/db";
import { STAGE_TO_GRAPH_NODE_SLUG } from "@/lib/diligence/stages";
import {
  OntologyNodeKind,
  type DiligenceStageName,
} from "@/lib/generated/prisma/client";

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

type GraphRequirement = {
  title: string;
  description: string | null;
  priority: string;
  node: {
    slug: string;
    label: string;
    description: string | null;
    kind: OntologyNodeKind;
  };
};

function compareRequirements(a: GraphRequirement, b: GraphRequirement) {
  return (
    (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99) ||
    a.title.localeCompare(b.title)
  );
}

function formatRequirement(requirement: GraphRequirement): string {
  const description = requirement.description
    ? ` - ${requirement.description}`
    : "";
  return `- [${requirement.priority}] ${requirement.title}${description}`;
}

export async function loadGraphQuestionPromptContext(input: {
  projectId: string;
  stage: DiligenceStageName;
}): Promise<string | null> {
  const nodeSlug = STAGE_TO_GRAPH_NODE_SLUG[input.stage];
  if (!nodeSlug) {
    return null;
  }

  const goal = await db.assistanceGoal.findUnique({
    where: { projectId: input.projectId },
    select: {
      graph: {
        select: {
          name: true,
          slug: true,
          nodes: {
            where: {
              slug: nodeSlug,
              kind: OntologyNodeKind.QUESTION,
            },
            select: {
              slug: true,
              label: true,
              description: true,
              kind: true,
            },
            take: 1,
          },
          evidenceRequirements: {
            select: {
              title: true,
              description: true,
              priority: true,
              node: {
                select: {
                  slug: true,
                  label: true,
                  description: true,
                  kind: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!goal) {
    return null;
  }

  const node = goal.graph.nodes[0] ?? null;
  const requirements = goal.graph.evidenceRequirements
    .filter(
      (requirement) =>
        requirement.node.slug === nodeSlug &&
        requirement.node.kind === OntologyNodeKind.QUESTION
    )
    .sort(compareRequirements);

  if (!node && requirements.length === 0) {
    return null;
  }

  const questionLabel = node?.label ?? nodeSlug;
  const questionDescription = node?.description
    ? [`Question description: ${node.description}`]
    : [];

  return [
    "### Selected knowledge graph question workflow",
    `Graph: ${goal.graph.name} (${goal.graph.slug})`,
    `Question node: ${questionLabel}`,
    ...questionDescription,
    "Use these graph requirements as the source of truth for this stage. If they differ from the fallback checklist above, prefer the graph.",
    "Evidence requirements:",
    ...(requirements.length > 0
      ? requirements.map(formatRequirement)
      : ["- No evidence requirements are defined for this graph question."]),
  ].join("\n");
}
