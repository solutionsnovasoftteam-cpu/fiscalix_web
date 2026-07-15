import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Fiscalix | Control fiscal simple", description: "Administra tus obligaciones fiscales desde un solo lugar." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
