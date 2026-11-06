import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteNav from "@/components/SiteNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Company forms, appeals and complaints.",
  manifest: "manifest.webmanifest",
  appleWebApp: { capable: true, title: APP_NAME },
};

export const viewport: Viewport = { themeColor: "#1d4ed8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <SiteNav />
        <main id="main" className="shell">{children}</main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}