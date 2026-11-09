import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/config";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Forms MESRC",
    short_name: "Forms MESRC",
    description: "Company forms, appeals and complaints.",
    lang: "en",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#f3efe6",
    theme_color: "#1c1917",
    icons: [
      { src: `${BASE_PATH}/icons/logo.svg`, sizes: "any", type: "image/svg+xml" },
      { src: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}