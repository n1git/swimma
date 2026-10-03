"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

export function TurnstileWidget({ siteKey, nonce, onToken }: { siteKey: string; nonce?: string; onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | null = null;
    const timer = setInterval(() => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (!api || !ref.current || widgetId) return;
      widgetId = api.render(ref.current, {
        sitekey: siteKey,
        language: "id",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
      clearInterval(timer);
    }, 200);
    return () => {
      clearInterval(timer);
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (api && widgetId) api.remove(widgetId);
    };
  }, [siteKey, onToken]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" nonce={nonce} />
      <div ref={ref} />
    </>
  );
}
