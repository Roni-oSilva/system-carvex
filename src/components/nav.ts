import { Banknote, Bot, FolderKanban, Kanban, LayoutDashboard, MessageSquare, Search, Settings, ShoppingBag, Users, Workflow, BarChart3, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Prospecção", href: "/prospeccao", icon: Search },
  { label: "CRM", href: "/crm", icon: Kanban },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Mensagens", href: "/mensagens", icon: MessageSquare },
  { label: "Vendas", href: "/vendas", icon: ShoppingBag },
  { label: "Projetos", href: "/projetos", icon: FolderKanban },
  { label: "Financeiro", href: "/financeiro", icon: Banknote },
  { label: "Automações", href: "/automacoes", icon: Workflow },
  { label: "IA", href: "/ia", icon: Bot },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Configurações", href: "/settings/security", icon: Settings },
];

export const isActive = (href: string, current: string) =>
  href === "/" ? current === "/" : current === href || current.startsWith("/" + href.split("/")[1]);
