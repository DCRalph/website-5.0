export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 pt-10 pb-5 text-xs font-medium tracking-[.08em] text-dim uppercase first:pt-6">
      <span className="size-1.5 bg-brand" aria-hidden />
      {children}
    </h2>
  );
}
