import type { IconName } from "./pixel-icon";

export type NavItem = { label: string; href: string; icon: IconName };

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Prospecção", href: "/prospeccao", icon: "globe" },
  { label: "CRM", href: "/crm", icon: "folder" },
  { label: "Clientes", href: "/clientes", icon: "users" },
  { label: "Mensagens", href: "/mensagens", icon: "note" },
  { label: "Vendas", href: "/vendas", icon: "bag" },
  { label: "Projetos", href: "/projetos", icon: "window" },
  { label: "Financeiro", href: "/financeiro", icon: "money" },
  { label: "Automações", href: "/automacoes", icon: "gear" },
  { label: "IA", href: "/ia", icon: "robot" },
  { label: "Relatórios", href: "/relatorios", icon: "chart" },
  { label: "Configurações", href: "/settings/security", icon: "sliders" },
];

export const isActive = (href: string, current: string) =>
  href === "/" ? current === "/" : current === href || current.startsWith("/" + href.split("/")[1]);
