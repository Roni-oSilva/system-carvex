import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://x";
  process.env.DATA_ENCRYPTION_KEY = "ab".repeat(32);
  process.env.APP_SECRET = "s".repeat(40);
});

describe("crypto", () => {
  it("criptografa e descriptografa (AES-256-GCM)", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    const enc = encrypt("segredo");
    expect(enc).not.toContain("segredo");
    expect(decrypt(enc)).toBe("segredo");
  });
  it("detecta adulteração", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    const parts = encrypt("x").split(".");
    parts[3] = Buffer.from("zz").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
  it("tokens aleatórios são únicos", async () => {
    const { randomToken } = await import("./crypto");
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe("totp", () => {
  it("bate com o vetor RFC 6238 (SHA-1, T=59 → ...287082)", async () => {
    const { base32Encode, hotp } = await import("./totp");
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(hotp(secret, Math.floor(59 / 30))).toBe("287082");
  });
  it("aceita código atual e rejeita errado/formato inválido", async () => {
    const { generateSecret, hotp, verifyTotp } = await import("./totp");
    const s = generateSecret();
    const now = Date.now();
    expect(verifyTotp(s, hotp(s, Math.floor(now / 30000)), now)).toBe(true);
    expect(verifyTotp(s, "abc", now)).toBe(false);
  });
});

describe("password", () => {
  it("política de senha", async () => {
    const { passwordPolicyError } = await import("./password");
    expect(passwordPolicyError("curta")).not.toBeNull();
    expect(passwordPolicyError("aaaaaaaaaaaaaaaa")).not.toBeNull();
    expect(passwordPolicyError("Senha-Forte-123!")).toBeNull();
  });
  it("argon2id: hash e verificação", async () => {
    const { hashPassword, verifyPassword } = await import("./password");
    const h = await hashPassword("Senha-Forte-123!");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "Senha-Forte-123!")).toBe(true);
    expect(await verifyPassword(h, "errada")).toBe(false);
    expect(await verifyPassword("lixo", "x")).toBe(false);
  });
});

describe("rate limit em memória", () => {
  it("bloqueia após o limite", async () => {
    const { rateLimit } = await import("./rate-limit");
    expect(Array.from({ length: 4 }, () => rateLimit("k", 3, 1000))).toEqual([true, true, true, false]);
  });
});
