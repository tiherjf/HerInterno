import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intranet HER — Hospital Evandro Ribeiro",
  description: "Sistema de Intranet do Hospital Evandro Ribeiro — Juiz de Fora, MG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
