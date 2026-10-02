/**
 * Executado a cada boot (docker/entrypoint.sh) e manualmente: `npm run bootstrap`.
 *  1. Semeia configurações padrão (idempotente).
 *  2. Cria o proprietário a partir de OWNER_EMAIL/OWNER_PASSWORD se ainda não existir nenhum.
 *  3. OWNER_RESET=1 redefine a senha do proprietário e encerra suas sessões (recuperação de acesso). Remova a variável depois.
 * Não existe cadastro público de usuários.
 */
import { PrismaClient } from "@prisma/client";
import { seedConfig } from "../prisma/seed";
import { hashPassword, passwordPolicyError } from "../src/lib/password";

async function main() {
  const db = new PrismaClient();
  try {
    await seedConfig(db);
    const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const password = process.env.OWNER_PASSWORD;
    const name = process.env.OWNER_NAME?.trim() || "Proprietário";
    const owner = await db.user.findFirst({ where: { role: "OWNER", deletedAt: null } });

    if (!owner) {
      if (!email || !password) { console.warn("[bootstrap] Nenhum proprietário existe. Defina OWNER_EMAIL e OWNER_PASSWORD e reinicie."); return; }
      const policy = passwordPolicyError(password);
      if (policy) throw new Error(`OWNER_PASSWORD inválida: ${policy}`);
      await db.user.create({ data: { email, name, passwordHash: await hashPassword(password), role: "OWNER" } });
      console.log(`[bootstrap] Proprietário criado: ${email}. Ative o 2FA em Configurações → Segurança.`);
    } else if (process.env.OWNER_RESET === "1") {
      if (!password) throw new Error("OWNER_RESET=1 exige OWNER_PASSWORD.");
      const policy = passwordPolicyError(password);
      if (policy) throw new Error(`OWNER_PASSWORD inválida: ${policy}`);
      await db.user.update({ where: { id: owner.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), active: true } });
      await db.session.updateMany({ where: { userId: owner.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await db.auditLog.create({ data: { action: "auth.owner_reset", userId: owner.id, category: "security", meta: { via: "bootstrap" } } });
      console.log("[bootstrap] Senha do proprietário redefinida e sessões encerradas. Remova OWNER_RESET.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error("[bootstrap] ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
