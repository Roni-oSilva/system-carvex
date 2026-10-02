import { Banknote, Bot, FolderKanban, Kanban, LayoutDashboard, MessageSquare, Search, Settings, ShoppingBag, Users, Workflow, BarChart3, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; color: string };

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, color: "#2f5bff" },
  { label: "Prospecção", href: "/prospeccao", icon: Search, color: "#14b8a6" },
  { label: "CRM", href: "/crm", icon: Kanban, color: "#8a5cf6" },
  { label: "Clientes", href: "/clientes", icon: Users, color: "#ff6fa5" },
  { label: "Mensagens", href: "/mensagens", icon: MessageSquare, color: "#38a8f8" },
  { label: "Vendas", href: "/vendas", icon: ShoppingBag, color: "#ff9f1c" },
  { label: "Projetos", href: "/projetos", icon: FolderKanban, color: "#e0a800" },
  { label: "Financeiro", href: "/financeiro", icon: Banknote, color: "#16a34a" },
  { label: "Automações", href: "/automacoes", icon: Workflow, color: "#6366f1" },
  { label: "IA", href: "/ia", icon: Bot, color: "#d946ef" },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3, color: "#0e9aa7" },
  { label: "Configurações", href: "/settings/security", icon: Settings, color: "#64748b" },
];

export const isActive = (href: string, current: string) =>
  href === "/" ? current === "/" : current === href || current.startsWith("/" + href.split("/")[1]);
