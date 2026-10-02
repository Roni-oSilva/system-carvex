import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Carvex", description: "Central privada de prospecção, vendas e gestão", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
