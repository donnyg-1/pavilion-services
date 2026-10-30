export const config = {
  appUrl: () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  paymentsMode: (): "stripe" | "mock" => (process.env.STRIPE_SECRET_KEY ? "stripe" : "mock"),
  emailMode: (): "resend" | "log" => (process.env.RESEND_API_KEY ? "resend" : "log"),
  emailFrom: () => process.env.EMAIL_FROM || "Pavilion <onboarding@resend.dev>",
  adminEmail: () => process.env.ADMIN_EMAIL || "",
  /** Minutes a spot is held while the resident saves their card. Stripe Checkout's minimum expiry is 30. */
  holdMinutes: 30,
};

export function url(path: string) {
  return `${config.appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
