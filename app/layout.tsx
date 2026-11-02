import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "VEYRION OS | Gestão inteligente",
  description: "Tecnologia. Inteligência. Crescimento. CRM, locação e vendas B2B.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}