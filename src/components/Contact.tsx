import Link from "next/link";
import { me } from "~/lib/me";

export function Contact() {
  return (
    <div className="mt-16 flex flex-wrap items-baseline justify-between gap-4 border-t border-hair-strong pt-6">
      <a href={`mailto:${me.email}`} className="text-[22px] font-medium tracking-tight hover:text-brand hover:no-underline">
        {me.email}
      </a>
      <nav className="flex gap-5 text-[13px] text-dim">
        <Link href={me.github} target="_blank" rel="noopener">GitHub</Link>
        <Link href={me.linkedin} target="_blank" rel="noopener">LinkedIn</Link>
        <Link href={me.cv} target="_blank">CV</Link>
      </nav>
    </div>
  );
}
