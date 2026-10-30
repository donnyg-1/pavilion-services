import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, Logo } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo href="/admin" suffix="Services admin" />
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-bold">Sign in</h1>
          <p className="mt-1 mb-5 text-sm text-muted">Pavilion staff only.</p>
          <LoginForm next={next?.startsWith("/admin") ? next : "/admin"} />
        </Card>
      </div>
    </main>
  );
}
