import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  debug: false,
  beforeSend(event) {
    // Scrub potential PII from URLs and request data before sending to Sentry.
    if (event.request?.url) {
      try {
        const url = new URL(event.request.url);
        url.searchParams.delete("token");
        event.request.url = url.toString();
      } catch {
        // Keep original URL if parsing fails.
      }
    }
    if (event.request?.query_string) {
      delete event.request.query_string;
    }
    return event;
  },
});
