import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    const headers = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    if (isProduction) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com https://accounts.google.com https://js.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://utfs.io",
      "font-src 'self'",
      "connect-src 'self' https://api.uploadthing.com https://accounts.google.com https://*.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];

    headers.push({
      key: "Content-Security-Policy",
      value: cspDirectives.join("; ") + ";",
    });

    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },
};

// Only enable the Sentry webpack plugin when a DSN is configured. This keeps
// local dev / CI builds fast and avoids warnings when Sentry auth is absent.
const hasSentryDsn = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

export default hasSentryDsn
  ? withSentryConfig(nextConfig, { silent: true })
  : nextConfig;
