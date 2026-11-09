import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteNav from "@/components/SiteNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { APP_NAME, BASE_PATH } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Company forms, appeals and complaints.",
  manifest: "manifest.webmanifest",
  icons: {
    icon: [
      { url: `${BASE_PATH}/icons/logo.svg`, type: "image/svg+xml" },
      { url: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: APP_NAME },
};

export const viewport: Viewport = { themeColor: "#1c1917", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="app-frame">
          <SiteNav />
          <main id="main" className="shell">{children}</main>
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}