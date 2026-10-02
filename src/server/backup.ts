import "server-only";
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

const run = promisify(execFile);
export const backupDir = () => path.resolve(env().DATA_DIR, "backups");

/** Remove ?schema=… (o pg_dump não aceita). */
const pgUrl = () => { const u = new URL(process.env.DATABASE_URL!); u.search = ""; return u; };

function sha256(file: string) {
  return new Promise<string>((res, rej) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (d) => h.update(d)).on("end", () => res(h.digest("hex"))).on("error", rej);
  });
}

async function tableCount(url: string) {
  const { stdout } = await run("psql", [url, "-Atc", "select count(*) from information_schema.tables where table_schema='public'"]);
  return Number(stdout.trim());
}

/** Gera dump (formato custom), grava SHA-256 e já verifica a integridade lendo o índice do arquivo. */
export async function createBackup() {
  const rec = await db.backupRecord.create({ data: { status: "PROCESSING" } });
  try {
    await mkdir(backupDir(), { recursive: true, mode: 0o700 });
    const file = path.join(backupDir(), `carvex-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
    await run("pg_dump", ["--format=custom", "--no-owner", `--file=${file}`, pgUrl().toString()], { timeout: 300_000 });
    await run("pg_restore", ["--list", file], { timeout: 60_000 }); // arquivo legível?
    const { size } = await stat(file);
    await db.backupRecord.update({ where: { id: rec.id }, data: { status: "DONE", location: path.basename(file), sizeBytes: size, sha256: await sha256(file), finishedAt: new Date() } });
    return rec.id;
  } catch (e) {
    log.error("backup_failed", { err: e });
    await db.backupRecord.update({ where: { id: rec.id }, data: { status: "ERROR", error: "Falha ao gerar backup (veja o log do servidor)", finishedAt: new Date() } });
    throw e;
  }
}

/** Teste de restauração: restaura num banco temporário, compara nº de tabelas e apaga o temporário. */
export async function verifyBackup(id: string) {
  const rec = await db.backupRecord.findUniqueOrThrow({ where: { id } });
  if (rec.status !== "DONE" || !rec.location) throw new Error("backup inválido");
  const file = path.join(backupDir(), path.basename(rec.location));
  if ((await sha256(file)) !== rec.sha256) throw new Error("checksum divergente");
  const base = pgUrl();
  const tmpName = `carvex_restore_${randomBytes(4).toString("hex")}`;
  const admin = new URL(base); admin.pathname = "/postgres";
  const tmp = new URL(base); tmp.pathname = `/${tmpName}`;
  await run("psql", [admin.toString(), "-qc", `CREATE DATABASE ${tmpName}`]);
  try {
    await run("pg_restore", ["--no-owner", `--dbname=${tmp.toString()}`, file], { timeout: 300_000 });
    const [a, b] = await Promise.all([tableCount(base.toString()), tableCount(tmp.toString())]);
    if (a !== b) throw new Error(`tabelas origem=${a} restauradas=${b}`);
  } finally {
    await run("psql", [admin.toString(), "-qc", `DROP DATABASE IF EXISTS ${tmpName}`]).catch(() => undefined);
  }
  await db.backupRecord.update({ where: { id }, data: { verifiedAt: new Date() } });
}

/** Retenção: apaga arquivos e registros mais antigos que `days`. */
export async function pruneBackups(days = 14) {
  const cutoff = new Date(Date.now() - days * 86400_000);
  const old = await db.backupRecord.findMany({ where: { createdAt: { lt: cutoff } } });
  for (const r of old) if (r.location) await unlink(path.join(backupDir(), path.basename(r.location))).catch(() => undefined);
  await db.backupRecord.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
  const known = new Set((await db.backupRecord.findMany({ select: { location: true } })).map((r) => r.location));
  for (const f of await readdir(backupDir()).catch(() => [] as string[])) if (!known.has(f) && f.endsWith(".dump")) await unlink(path.join(backupDir(), f)).catch(() => undefined);
  return old.length;
}
