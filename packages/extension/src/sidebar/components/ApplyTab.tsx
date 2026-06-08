function TabPlaceholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-card border border-am-border bg-am-surface p-5">
      <h2 className="text-[15px] font-semibold text-am-text">{title}</h2>
      <p className="mt-2 text-[13px] text-am-text-secondary">{subtitle}</p>
    </div>
  );
}

export function ApplyTab() {
  return (
    <TabPlaceholder
      title="Apply"
      subtitle="Autofill job applications with one click — coming in Phase 4."
    />
  );
}
