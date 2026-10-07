import Link from "next/link";

const TABS = [
  ["security", "Segurança", "/settings/security"],
  ["regras", "Regras comerciais", "/settings/regras"],
  ["integracoes", "Integrações", "/settings/integracoes"],
  ["backups", "Backups", "/settings/backups"],
  ["dados", "Dados e LGPD", "/settings/dados"],
  ["auditoria", "Auditoria", "/settings/auditoria"],
] as const;

export function SettingsTabs({ current }: { current: string }) {
  return (
    <div className="flex flex-wrap gap-1 no-print" role="tablist">
      {TABS.map(([k, label, href]) => (
        <Link key={k} href={href} role="tab" aria-selected={current === k} className={`btn-ghost ${current === k ? "!font-bold !bg-[#e0e7ff]" : ""}`}>{label}</Link>
      ))}
    </div>
  );
}
