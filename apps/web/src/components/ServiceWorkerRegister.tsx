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

function findScrollableParent(
  start: EventTarget | null,
  axis: "y" | "x",
): HTMLElement | null {
  let el = start instanceof HTMLElement ? start : null;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    if (axis === "y") {
      const oy = style.overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) {
        return el;
      }
    } else {
      const ox = style.overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 1) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return null;
}

// Registers the service worker, captures PWA install prompt, and locks browser zoom,
// rubber-band overscroll, pull-to-refresh, and horizontal drag gestures so mobile PWA
// behaves like a true native iOS / Android app.
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

    const isStandalone =
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches);
    const isTouchDevice =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    // 1. Block iOS Safari pinch-to-zoom gestures (Safari ignores user-scalable=no)
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });

    // 2. Block multi-touch pinch zoom AND iOS WKWebView rubber-band bounce / horizontal drag
    let startX = 0;
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      // Multi-finger pinch zoom -> always block
      if (e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      if (!isTouchDevice && !isStandalone) return;
      // Allow range sliders & native text selection inside focused inputs
      if (
        e.target instanceof HTMLInputElement &&
        e.target.type === "range"
      ) {
        return;
      }

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Sideways drag outside a horizontally scrollable table -> block (no web horizontal shift!)
      if (Math.abs(dx) > Math.abs(dy) + 4) {
        const scrollerX = findScrollableParent(e.target, "x");
        if (!scrollerX) {
          e.preventDefault();
          return;
        }
        const atLeft = scrollerX.scrollLeft <= 0 && dx > 0;
        const atRight =
          scrollerX.scrollLeft + scrollerX.clientWidth >= scrollerX.scrollWidth - 1 && dx < 0;
        if (atLeft || atRight) {
          e.preventDefault();
        }
        return;
      }

      // Vertical drag -> only allow inside a scrollable parent, and block rubber-band at top/bottom edge
      const scrollerY = findScrollableParent(e.target, "y");
      if (!scrollerY) {
        e.preventDefault();
        return;
      }

      const atTop = scrollerY.scrollTop <= 0 && dy > 0;
      const atBottom =
        scrollerY.scrollTop + scrollerY.clientHeight >= scrollerY.scrollHeight - 1 && dy < 0;
      if (atTop || atBottom) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });

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
    const preventCtrlWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey && isStandalone) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", preventCtrlWheelZoom, { passive: false });

    // 5. Block native browser long-press context menu on buttons/cards/images on touch devices
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
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", preventDoubleTapZoom);
      window.removeEventListener("wheel", preventCtrlWheelZoom);
      document.removeEventListener("contextmenu", preventTouchContextMenu);
    };
  }, []);

  return null;
}
