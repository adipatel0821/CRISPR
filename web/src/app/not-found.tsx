import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-ink-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">
        Back to the start
      </Link>
    </div>
  );
}
