import Link from "next/link";
import { experience } from "~/lib/experience";
import { me } from "~/lib/me";

const current = experience[0];

const links = [
  { label: "GitHub", href: me.github, external: true },
  { label: "LinkedIn", href: me.linkedin, external: true },
  { label: "Email", href: `mailto:${me.email}` },
  { label: "CV", href: me.cv, external: true },
];

export function Sidebar() {
  return (
    <aside className="relative flex flex-col justify-between overflow-hidden p-6 md:sticky md:top-0 md:h-screen md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[20%] -left-[20%] aspect-square w-[90%] bg-[radial-gradient(circle,rgba(255,44,44,0.07),transparent_60%)]"
      />

      <div className="relative">
        <h1 className="text-[clamp(56px,7.5vw,112px)] leading-[.9] font-semibold tracking-[-.05em]">
          William
          <br />
          Giles<span className="text-brand">.</span>
        </h1>
        <p className="mt-3 text-[clamp(22px,2.6vw,36px)] leading-none font-light tracking-[-.03em] text-[#555]">
          Software engineer
        </p>
      </div>

      <div className="relative mt-10 md:mt-0">
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-dim">
          <dt className="text-dimmer">Now</dt>
          <dd>
            <span className="mr-2 inline-block size-1.5 rounded-full bg-brand align-middle" aria-hidden />
            {current.position}, {current.company}
          </dd>
          <dt className="text-dimmer">Where</dt>
          <dd>{me.location}</dd>
          <dt className="text-dimmer">Focus</dt>
          <dd>{me.focus}</dd>
        </dl>

        <nav className="mt-7 flex gap-5 text-[13px]">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
