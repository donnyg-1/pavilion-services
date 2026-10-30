import { cookies } from "next/headers";

// One-shot admin message that survives a revalidation, for row actions whose
// controls disappear once they succeed (e.g. "Complete & charge" turns into "Refund").
const COOKIE = "pv_flash";

export async function setFlash(r: { ok: boolean; message: string }) {
  (await cookies()).set(COOKIE, JSON.stringify(r), { path: "/admin", maxAge: 30, httpOnly: false, sameSite: "lax" });
}

export async function readFlash(): Promise<{ ok: boolean; message: string } | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
