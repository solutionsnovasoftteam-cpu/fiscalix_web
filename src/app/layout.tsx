import type { Metadata } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = { title: "Fiscalix | Control fiscal simple", description: "Administra tus obligaciones fiscales desde un solo lugar." };

const jakarta = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jakarta",
});

const manrope = Manrope({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-manrope",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html className={`${jakarta.variable} ${manrope.variable}`} lang="es"><body>{children}</body></html>;
}
