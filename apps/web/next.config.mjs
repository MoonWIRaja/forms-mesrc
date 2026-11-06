// Static export for GitHub Pages. No server runtime features (API routes, middleware, Server Actions).
// NEXT_PUBLIC_BASE_PATH is a PLACEHOLDER until the beta URL strategy is confirmed:
//   project site  -> "/<repository-name>"
//   custom domain -> "" (empty)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;