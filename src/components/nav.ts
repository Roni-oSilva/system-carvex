import { Banknote, Bot, FolderKanban, Kanban, LayoutDashboard, MessageSquare, Search, Settings, ShoppingBag, Users, Workflow, BarChart3, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; phase?: number };

// `phase` presente = módulo ainda não implementado (aparece desabilitado, sem link).
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Prospecção", href: "/prospeccao", icon: Search, phase: 3 },
  { label: "CRM", href: "/crm", icon: Kanban, phase: 2 },
  { label: "Clientes", href: "/clientes", icon: Users, phase: 2 },
  { label: "Mensagens", href: "/mensagens", icon: MessageSquare, phase: 4 },
  { label: "Vendas", href: "/vendas", icon: ShoppingBag, phase: 5 },
  { label: "Projetos", href: "/projetos", icon: FolderKanban, phase: 6 },
  { label: "Financeiro", href: "/financeiro", icon: Banknote, phase: 7 },
  { label: "Automações", href: "/automacoes", icon: Workflow, phase: 8 },
  { label: "IA", href: "/ia", icon: Bot, phase: 9 },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3, phase: 7 },
  { label: "Configurações", href: "/settings/security", icon: Settings },
];
