export const config = {
  appUrl: () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  paymentsMode: (): "stripe" | "mock" => (process.env.STRIPE_SECRET_KEY ? "stripe" : "mock"),
  /** Safe to send to the browser. Read at request time so it isn't baked into the build. */
  stripePublishableKey: () => process.env.STRIPE_PUBLISHABLE_KEY || "",
  emailMode: (): "resend" | "log" => (process.env.RESEND_API_KEY ? "resend" : "log"),
  emailFrom: () => process.env.EMAIL_FROM || "Pavilion <onboarding@resend.dev>",
  adminEmail: () => process.env.ADMIN_EMAIL || "",
  /** Minutes a spot is held while the resident saves their card. */
  holdMinutes: 30,
};

export function url(path: string) {
  return `${config.appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
