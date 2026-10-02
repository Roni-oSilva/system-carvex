import { headers } from "next/headers";
import { hmac } from "./crypto";

/** IP do cliente. Só confie em x-forwarded-for atrás de proxy reverso próprio (ver docs/SECURITY.md). */
export async function clientInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { ip, ipHash: hmac(`ip:${ip}`), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

export function describeDevice(ua: string | null): string {
  if (!ua) return "Dispositivo desconhecido";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "SO desconhecido";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${br} em ${os}`;
}
