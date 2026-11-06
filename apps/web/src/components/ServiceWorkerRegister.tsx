"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/config";

// Registers the public-assets-only service worker in production builds.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
      .catch(() => {
        /* PWA install is an enhancement; the site works without it. */
      });
  }, []);
  return null;
}