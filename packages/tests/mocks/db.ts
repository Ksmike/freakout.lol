import { vi } from "vitest";

// Mock Prisma client for unit tests.
// Each model method is a vi.fn() so tests can set return values per-case.
export const mockDb = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  firm: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  firmMembership: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn().mockResolvedValue(1),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  planEntitlement: {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn(),
  },
  usageMeter: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "meter-1", firmId: "firm-1", periodStart: new Date(), uploadsCount: 0, runsCount: 0, exportsCount: 0 }),
    update: vi.fn(),
  },
  account: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  verificationToken: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  project: {
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));
