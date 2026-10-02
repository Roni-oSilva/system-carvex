import type { Metadata } from "next";
import "./globals.css";
import { Decor } from "@/components/decor";

export const metadata: Metadata = { title: "Carvex", description: "Central privada de prospecção, vendas e gestão", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body><Decor /><div className="relative z-10">{children}</div></body>
    </html>
  );
}
