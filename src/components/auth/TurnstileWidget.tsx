import { Turnstile } from "@marsidev/react-turnstile";
import { forwardRef, useRef, useState } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

/**
 * Cloudflare Turnstile CAPTCHA widget. Returns a token that must be passed
 * to Supabase Auth via `options.captchaToken` on signUp / signInWithPassword
 * / resetPasswordForEmail. Supabase verifies the token server-side using the
 * secret configured in Auth → Attack Protection.
 */
export const TurnstileWidget = forwardRef<HTMLDivElement, TurnstileWidgetProps>(
  ({ onVerify, onExpire, onError }, ref) => {
    const [hardError, setHardError] = useState(false);
    const [softError, setSoftError] = useState(false);
    const errorCount = useRef(0);
    if (!SITE_KEY) {
      console.warn("VITE_TURNSTILE_SITE_KEY missing — CAPTCHA disabled");
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          CAPTCHA is misconfigured (missing site key). Please contact support.
        </div>
      );
    }
    if (hardError) {
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive space-y-2">
          <p>Could not load CAPTCHA after several attempts.</p>
          <p className="text-muted-foreground">
            Disable ad-blockers / privacy extensions and refresh the page. If this
            persists, this domain may not be allowed in the Turnstile dashboard.
          </p>
          <button
            type="button"
            onClick={() => {
              errorCount.current = 0;
              setHardError(false);
              setSoftError(false);
            }}
            className="underline text-primary"
          >
            Try again
          </button>
        </div>
      );
    }
    return (
      <div ref={ref} className="flex flex-col items-center gap-2 min-h-[65px]">
        <Turnstile
          siteKey={SITE_KEY}
          onSuccess={(token) => {
            errorCount.current = 0;
            setSoftError(false);
            onVerify(token);
          }}
          onExpire={onExpire}
          onError={(err) => {
            // Turnstile fires onError for transient script / network glitches.
            // Only surface the hard error UI after several consecutive failures
            // so the widget keeps trying instead of disappearing on first blip.
            console.warn("Turnstile error:", err);
            errorCount.current += 1;
            setSoftError(true);
            if (errorCount.current >= 3) {
              setHardError(true);
              onError?.();
            }
          }}
          options={{
            theme: "auto",
            size: "normal",
            retry: "auto",
            refreshExpired: "auto",
          }}
        />
        {softError && !hardError && (
          <p className="text-xs text-muted-foreground">
            CAPTCHA is retrying… please wait.
          </p>
        )}
      </div>
    );
  }
);
TurnstileWidget.displayName = "TurnstileWidget";