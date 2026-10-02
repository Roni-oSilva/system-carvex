"use server";

import { audit } from "@/lib/audit";
import { act, UserError } from "./guard";
import { createBackup, verifyBackup } from "./backup";

export async function createBackupAction(form: FormData): Promise<void> {
  await act(form, "/settings/backups", async (s) => {
    try {
      const id = await createBackup();
      await audit({ action: "backup.create", userId: s.userId, entity: "backup", entityId: id, category: "security" });
    } catch {
      throw new UserError("Não foi possível gerar o backup. Verifique se o pg_dump está instalado e o banco acessível.");
    }
    return { msg: "Backup gerado e arquivo validado. Rode o teste de restauração para confirmar." };
  });
}

export async function verifyBackupAction(form: FormData): Promise<void> {
  await act(form, "/settings/backups", async (s) => {
    const id = String(form.get("id"));
    try {
      await verifyBackup(id);
    } catch {
      await audit({ action: "backup.verify", userId: s.userId, entity: "backup", entityId: id, result: "FAILURE", category: "security" });
      throw new UserError("Teste de restauração FALHOU. Não confie neste backup.");
    }
    await audit({ action: "backup.verify", userId: s.userId, entity: "backup", entityId: id, category: "security" });
    return { msg: "Teste de restauração OK: o backup foi restaurado em um banco temporário e conferido." };
  });
}
