import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "hda_admin";

/** Opaque cookie value derived from the password (raw password never stored). */
export function tokenFor(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function adminConfigured(): boolean {
  return typeof process.env.ADMIN_PASSWORD === "string" && process.env.ADMIN_PASSWORD.length > 0;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function checkPassword(password: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof password !== "string") return false;
  return safeEqual(password, expected);
}

/** True if the current request carries a valid admin cookie. */
export function isAuthed(): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const cookie = cookies().get(ADMIN_COOKIE)?.value;
  return !!cookie && safeEqual(cookie, tokenFor(expected));
}
