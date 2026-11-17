"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/config";
import { initPwaInstallListener } from "@/lib/pwa-install";

// Registers the public-assets-only service worker in production builds and captures PWA install prompt.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    const cleanupInstall = initPwaInstallListener();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
        .catch(() => {
          /* PWA install is an enhancement; the site works without it. */
        });
    }
    return cleanupInstall;
  }, []);
  return null;
}
