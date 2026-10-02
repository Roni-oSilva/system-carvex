import { hash, verify } from "@node-rs/argon2";

// argon2id (Algorithm = 2), parâmetros alinhados às recomendações OWASP.
const OPTS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => hash(pw, OPTS);

export async function verifyPassword(hashed: string, pw: string): Promise<boolean> {
  try {
    return await verify(hashed, pw);
  } catch {
    return false;
  }
}

/** Retorna mensagem de erro ou null se a senha é aceitável. */
export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 12) return "A senha deve ter ao menos 12 caracteres.";
  if (pw.length > 128) return "A senha deve ter no máximo 128 caracteres.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return "Use ao menos 3 tipos de caractere (minúscula, maiúscula, número, símbolo).";
  if (/^(.)\1+$/.test(pw)) return "Senha muito previsível.";
  return null;
}

// Hash fictício para igualar o tempo de resposta quando o e-mail não existe (evita enumeração de usuários).
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm8";
