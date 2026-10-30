import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">The link may be mistyped or out of date. Check the latest email from your HOA.</p>
      <Link href="/" className="mt-6 inline-block font-semibold text-pine-700">Go to Pavilion</Link>
    </main>
  );
}
