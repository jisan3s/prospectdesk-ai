import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const dev = process.env.NODE_ENV === "development";
    const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid.example").origin;
    const csp = [
      "default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'",
      // Cache Components stream inline bootstrap scripts. Nonce CSP requires a
      // separate rendering migration; do not silently disable the existing shell.
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'", "font-src 'self'", "img-src 'self' data: blob:",
      `connect-src 'self' ${supabase}${dev ? " ws: wss:" : ""}`,
    ].join("; ");
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ...(!dev ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ] }, { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }] }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
