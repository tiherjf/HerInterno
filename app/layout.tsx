import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/pwa/RegisterSW";

export const metadata: Metadata = {
  title: "Intranet HER — Hospital Evandro Ribeiro",
  description: "Sistema de Intranet do Hospital Evandro Ribeiro — Juiz de Fora, MG",
  applicationName: "Intranet HER",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Intranet HER",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
