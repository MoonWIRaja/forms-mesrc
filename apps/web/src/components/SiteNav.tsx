import Link from "next/link";

export default function SiteNav() {
  return (
    <nav className="nav" aria-label="Primary">
      <Link href="/">Home</Link>
      <Link href="/sign-in/">Sign in</Link>
      <Link href="/forms/">Forms</Link>
      <Link href="/admin/">Admin</Link>
      <Link href="/maintenance/">Maintenance</Link>
    </nav>
  );
}