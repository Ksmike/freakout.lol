import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import type { ApiKeyProvider } from "@/lib/generated/prisma/client";

export const UserApiKeyModel = {
  async listForUser(userId: string) {
    return db.userApiKey.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        encryptedKey: true,
        keyHint: true,
        defaultModel: true,
        enabled: true,
        lastValidatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async listEnabledForUser(userId: string) {
    return db.userApiKey.findMany({
      where: { userId, enabled: true },
      select: {
        id: true,
        provider: true,
        defaultModel: true,
        enabled: true,
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async findForUser(input: { userId: string; provider: ApiKeyProvider }) {
    return db.userApiKey.findUnique({
      where: {
        userId_provider: {
          userId: input.userId,
          provider: input.provider,
        },
      },
    });
  },

  async findByIdForUser(input: { userId: string; userApiKeyId: string }) {
    return db.userApiKey.findFirst({
      where: {
        id: input.userApiKeyId,
        userId: input.userId,
      },
    });
  },

  decryptApiKey(encryptedKey: string): string {
    return decrypt(encryptedKey);
  },

  encryptApiKey(rawKey: string): string {
    return encrypt(rawKey);
  },
};
