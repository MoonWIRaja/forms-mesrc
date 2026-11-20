"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/config";
import { initPwaInstallListener } from "@/lib/pwa-install";

function isEditableOrInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], button, a, label, [role='button'], [role='option']",
    ),
  );
}

function isTextEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], code, pre"));
}

// Registers the service worker, captures PWA install prompt, and locks browser zoom/drag gestures
// so mobile/standalone PWA behaves like a true native app.
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

    // 1. Block iOS Safari pinch-to-zoom gestures (Safari ignores user-scalable=no)
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });

    // 2. Block multi-finger pinch zoom on iOS/Android touchscreens
    const preventMultiTouchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener("touchmove", preventMultiTouchZoom, { passive: false });

    // 3. Block rapid double-tap zoom on non-interactive canvas/text areas
    let lastTouchEnd = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300 && !isEditableOrInteractive(e.target)) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

    // 4. Block Ctrl/trackpad pinch-zoom when running as an installed standalone PWA
    const isStandalone =
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches);
    const preventCtrlWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey && isStandalone) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", preventCtrlWheelZoom, { passive: false });

    // 5. Block native browser long-press context menu on buttons/cards/images on touch devices
    const isTouchDevice =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    const preventTouchContextMenu = (e: MouseEvent) => {
      if ((isTouchDevice || isStandalone) && !isTextEditable(e.target)) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", preventTouchContextMenu);

    return () => {
      cleanupInstall();
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchmove", preventMultiTouchZoom);
      document.removeEventListener("touchend", preventDoubleTapZoom);
      window.removeEventListener("wheel", preventCtrlWheelZoom);
      document.removeEventListener("contextmenu", preventTouchContextMenu);
    };
  }, []);

  return null;
}
