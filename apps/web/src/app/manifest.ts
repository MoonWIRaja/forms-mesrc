import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME, BASE_PATH } from "@/lib/config";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Forms`,
    short_name: APP_SHORT_NAME,
    description: "Kayangan Bumi Medical — Official Forms, Complaints & Judging Portal.",
    lang: "en",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#f4f1e8",
    theme_color: "#0f5132",
    icons: [
      { src: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
