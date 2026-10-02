import { requireUser } from "@/server/session";

// Toda a área autenticada exige sessão válida (validada no servidor, não só no middleware).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
