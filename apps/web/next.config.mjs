import os from "node:os";

// Static export for GitHub Pages. No server runtime features (API routes, middleware, Server Actions).
// NEXT_PUBLIC_BASE_PATH is a PLACEHOLDER until the beta URL strategy is confirmed:
//   project site  -> "/<repository-name>"
//   custom domain -> "" (empty)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const localNetworkIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((iface) => iface && iface.family === "IPv4" && iface.address)
  .map((iface) => iface.address);

const allowedDevOrigins = Array.from(
  new Set([
    "localhost",
    "127.0.0.1",
    "172.20.112.1",
    "192.168.1.177",
    "*.local",
    ...localNetworkIps,
  ]),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
  allowedDevOrigins,
};

export default nextConfig;
