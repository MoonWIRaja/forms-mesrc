import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteNav from "@/components/SiteNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { APP_NAME, APP_SHORT_NAME, BASE_PATH } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Kayangan Bumi Medical — Official Forms, Staff Complaints, and Competition Evaluation Portal.",
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${BASE_PATH}/favicon.ico`, sizes: "any" },
      { url: `${BASE_PATH}/icons/favicon-32.png`, sizes: "32x32", type: "image/png" },
      { url: `${BASE_PATH}/icons/favicon-16.png`, sizes: "16x16", type: "image/png" },
      { url: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    shortcut: [`${BASE_PATH}/favicon.ico`],
    apple: [
      { url: `${BASE_PATH}/icons/apple-touch-icon.png`, sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f5132",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

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
