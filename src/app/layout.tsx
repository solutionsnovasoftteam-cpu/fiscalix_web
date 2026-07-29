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

const themeBootstrapScript = `
(() => {
  try {
    const storedPreferences = window.localStorage.getItem("fiscalix-user-preferences");
    let preferenceTheme = null;
    if (storedPreferences) {
      try {
        preferenceTheme = JSON.parse(storedPreferences)?.theme;
      } catch {}
    }
    const storedTheme = preferenceTheme || window.localStorage.getItem("fiscalix-theme");
    const theme = storedTheme === "light" ? "light" : "dark";
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("theme-light", theme === "light");
      document.documentElement.style.colorScheme = theme;
      if (document.body) {
        document.body.dataset.theme = theme;
        document.body.classList.toggle("theme-light", theme === "light");
        document.body.style.colorScheme = theme;
      }
    };
    applyTheme();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", applyTheme, { once: true });
    }
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${jakarta.variable} ${manrope.variable}`} lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {children}
      </body>
    </html>
  );
}
