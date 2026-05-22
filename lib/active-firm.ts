/**
 * Active firm cookie helpers.
 *
 * The active firm preference is stored in a short-lived HTTP-only cookie.
 * On every server request, `getActiveFirmId` reads this cookie and passes
 * it to FirmModel.getActiveFirmSummaryForUser as the preferred firm.
 *
 * If the cookie is absent or the user is no longer a member of that firm,
 * FirmModel falls back to the user's first active membership.
 */

import { cookies } from "next/headers";

const COOKIE_NAME = "active_firm_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function getActiveFirmIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}

export async function setActiveFirmCookie(firmId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, firmId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearActiveFirmCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
