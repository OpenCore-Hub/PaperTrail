import { createLogger } from "@/lib/logger";

const log = createLogger("hcaptcha");

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

interface HcaptchaSiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verify an hCaptcha client token with the hCaptcha siteverify endpoint.
 *
 * If HCAPTCHA_SECRET is not configured, the function returns `true` in
 * development so local development can proceed, but returns `false` in
 * production to fail closed.
 */
export async function verifyHcaptchaToken(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      log.error({}, "hcaptcha.secret_missing");
    } else {
      log.warn({}, "hcaptcha.secret_missing_dev");
    }
    return process.env.NODE_ENV !== "production";
  }

  try {
    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });

    if (!response.ok) {
      log.error(
        { status: response.status },
        "hcaptcha.verify_request_failed",
      );
      return false;
    }

    const data = (await response.json()) as HcaptchaSiteverifyResponse;

    if (!data.success) {
      log.warn(
        { errorCodes: data["error-codes"] },
        "hcaptcha.verify_rejected",
      );
    }

    return data.success;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error({ error: message }, "hcaptcha.verify_exception");
    return false;
  }
}
