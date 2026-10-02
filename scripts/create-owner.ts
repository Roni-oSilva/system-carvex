/**
 * Cria (ou redefine) o usuário proprietário. Não existe cadastro público.
 * Uso: OWNER_EMAIL=voce@exemplo.com OWNER_NAME="Seu Nome" OWNER_PASSWORD='...' npm run owner:create
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, passwordPolicyError } from "../src/lib/password";

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const name = process.env.OWNER_NAME?.trim() || "Proprietário";
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) throw new Error("Defina OWNER_EMAIL e OWNER_PASSWORD.");
  const policy = passwordPolicyError(password);
  if (policy) throw new Error(policy);

  const db = new PrismaClient();
  try {
    const existing = await db.user.count({ where: { role: "OWNER", deletedAt: null } });
    const passwordHash = await hashPassword(password);
    if (existing > 0 && process.env.OWNER_RESET !== "1") {
      throw new Error("Já existe um proprietário. Use OWNER_RESET=1 para redefinir a senha dele.");
    }
    await db.user.upsert({
      where: { email },
      update: { passwordHash, passwordChangedAt: new Date(), active: true },
      create: { email, name, passwordHash, role: "OWNER" },
    });
    console.log(`Proprietário pronto: ${email}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
