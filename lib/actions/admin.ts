"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateUserSystemRole(
  userId: string,
  role: "ADMIN" | "USER"
): Promise<{ error?: string }> {
  const session = await auth();

  if (session?.user?.systemRole !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  if (session.user.id === userId) {
    return { error: "You cannot change your own system role." };
  }

  await db.user.update({
    where: { id: userId },
    data: { systemRole: role },
  });

  revalidatePath("/admin/users");
  return {};
}
