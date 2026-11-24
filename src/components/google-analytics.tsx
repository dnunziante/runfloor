"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type ConsentChoice = "accepted" | "declined" | null;
type GaEventName =
  | "page_view" | "platform_navigation" | "pricing_view" | "industry_landing_view"
  | "signup_cta_click" | "trial_start_click" | "login_click" | "demo_request_click"
  | "begin_checkout" | "upgrade_click" | "sign_up" | "login" | "trial_start"
  | "purchase" | "contact_form_submit";

const SALES_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
const CONSENT_KEY = "runfloor.analytics-consent.v1";
const allowedEvents = new Set<GaEventName>([
  "page_view", "platform_navigation", "pricing_view", "industry_landing_view",
  "signup_cta_click", "trial_start_click", "login_click", "demo_request_click",
  "begin_checkout", "upgrade_click", "sign_up", "login", "trial_start",
  "purchase", "contact_form_submit",
]);
const industryAliases: Record<string, string> = {
  rv: "rv", retail: "retail", influencer: "influencers", influencers: "influencers",
  "home-services": "home_services", automotive: "automotive", auto: "automotive",
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __runFloorGaReady?: string;
  }
}

export function googleAnalyticsMeasurementIdForHostname(hostname: string) {
  const host = hostname.toLowerCase();
  const productionHost = host === "runfloorsales.com" || host === "www.runfloorsales.com";
  return productionHost && SALES_MEASUREMENT_ID === "G-8GDCD9C0CQ" ? SALES_MEASUREMENT_ID : null;
}

function privacySignalIsSet() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

function safePath(pathname: string) {
  return pathname.split("/").map((segment) => (
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) || /^\d{10,}$/.test(segment) || /^[A-Za-z0-9_-]{32,}$/.test(segment)
      ? ":id"
      : segment
  )).join("/") || "/";
}

function sendEvent(name: GaEventName, measurementId: string, params: Record<string, string> = {}) {
  if (!allowedEvents.has(name) || typeof window.gtag !== "function") return;
  window.gtag("event", name, { ...params, send_to: measurementId });
}

function eventOnce(name: GaEventName, measurementId: string, path: string, key = "") {
  const dedupeKey = `runfloor.ga.conversion:${name}:${key || path}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, "1");
  } catch { /* Tracking still works when browser storage is unavailable. */ }
  sendEvent(name, measurementId);
}

function initializeGoogleTag(measurementId: string) {
  if (window.__runFloorGaReady === measurementId) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) { window.dataLayer?.push(args); };
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false, anonymize_ip: true });
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.__runFloorGaReady = measurementId;

  const scriptId = `runfloor-ga-${measurementId}`;
  if (!document.getElementById(scriptId)) {
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }
}

function conversionFromElement(element: HTMLElement, measurementId: string, path: string) {
  const names = (element.dataset.rfAnalyticsEvents || element.dataset.rfAnalyticsEvent || "")
    .split(",").map((name) => name.trim()).filter((name): name is GaEventName => allowedEvents.has(name as GaEventName));
  const key = element.dataset.rfAnalyticsId || "";
  for (const name of names) eventOnce(name, measurementId, path, key);
}

function eventForClick(element: HTMLElement, measurementId: string) {
  const link = element.closest("a");
  const href = link?.getAttribute("href") || "";
  const label = (element.getAttribute("aria-label") || element.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
  let event: GaEventName | null = null;
  let params: Record<string, string> = {};

  if (/^https?:/i.test(href)) {
    try {
      const host = new URL(href, window.location.origin).hostname.toLowerCase();
      const platform = host === "runfloorsales.com" || host === "www.runfloorsales.com" ? "sales" : host === "runfloormarketing.com" || host === "www.runfloormarketing.com" ? "marketing" : host === "runfloorai.com" || host === "www.runfloorai.com" ? "runfloorai" : "";
      if (platform) { event = "platform_navigation"; params = { destination_platform: platform }; }
    } catch { /* Ignore malformed destinations. */ }
  }
  if (!event && (/\/login(?:\/|$|\?)/.test(href) || /^(log in|sign in)(\b| to )/.test(label))) event = "login_click";
  if (!event && (/\/pricing(?:\/|$|\?)/.test(href))) event = "pricing_view";
  if (!event && (/\/demo(?:\/|$|\?)/.test(href) || /view demo|request a demo|schedule a demo/.test(label))) event = "demo_request_click";
  if (!event && /checkout|subscribe|secure payment|pay now/.test(label)) event = "begin_checkout";
  if (!event && /upgrade/.test(label)) event = "upgrade_click";
  if (!event && /free trial|start.*trial|trial/.test(label)) event = "trial_start_click";
  if (!event && /sign up|signup|create account|get started/.test(label)) event = "signup_cta_click";
  if (!event && element.closest("form") && /^\\/pricing(?:\\/|$)/.test(window.location.pathname)) event = "begin_checkout";
  if (event) sendEvent(event, measurementId, params);
}

function ConsentNotice({ onChoose }: { onChoose: (choice: Exclude<ConsentChoice, null>) => void }) {
  return <aside aria-label="Analytics privacy choice" className="rf-ga-consent">
    <div><strong>Help us improve RunFloor</strong><p>Allow Google Analytics to measure site use. We don’t send form entries or personal details.</p></div>
    <div className="rf-ga-consent-actions">
      <button type="button" onClick={() => onChoose("declined")}>Decline</button>
      <button type="button" onClick={() => onChoose("accepted")}>Allow analytics</button>
    </div>
    <style>{`
      .rf-ga-consent{position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:760px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 18px;background:#071529;color:#fff;border:1px solid rgba(94,184,255,.55);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.35);font:14px/1.45 Arial,sans-serif}
      .rf-ga-consent p{margin:4px 0 0;color:#c9d7e8;font-size:12px}
      .rf-ga-consent-actions{display:flex;flex:0 0 auto;gap:8px}
      .rf-ga-consent button{min-height:38px;padding:8px 12px;border:1px solid #8294aa;border-radius:8px;background:transparent;color:#fff;font:600 12px Arial,sans-serif;cursor:pointer}
      .rf-ga-consent button:last-child{border-color:#148fff;background:#087cf0}
      .rf-ga-consent button:focus-visible{outline:3px solid #68c8ff;outline-offset:2px}
      @media(max-width:620px){.rf-ga-consent{align-items:stretch;flex-direction:column;gap:12px}.rf-ga-consent-actions{justify-content:flex-end}}
    `}</style>
  </aside>;
}

export function GoogleAnalytics() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const lastPath = useRef("");
  const [measurementId, setMeasurementId] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentChoice>(null);
  const [privacyBlocked, setPrivacyBlocked] = useState(false);

  useEffect(() => {
    const id = googleAnalyticsMeasurementIdForHostname(window.location.hostname);
    setMeasurementId(id);
    if (privacySignalIsSet()) { setPrivacyBlocked(true); setConsent("declined"); return; }
    try {
      const saved = localStorage.getItem(CONSENT_KEY);
      if (saved === "accepted" || saved === "declined") setConsent(saved);
    } catch { setConsent(null); }
  }, []);

  useEffect(() => {
    if (!measurementId || consent !== "accepted" || privacyBlocked) return;
    initializeGoogleTag(measurementId);
    const path = safePath(pathname);
    if (lastPath.current !== path) {
      lastPath.current = path;
      const location = `${window.location.origin}${path}`;
      sendEvent("page_view", measurementId, { page_path: path, page_location: location });
      if (/^\/pricing(?:\/|$)/.test(path)) sendEvent("pricing_view", measurementId);
      const industrySegment = path.toLowerCase().split("/").map((part) => industryAliases[part]).find(Boolean);
      if (industrySegment) sendEvent("industry_landing_view", measurementId, { industry: industrySegment });
    }

    const params = new URLSearchParams(search);
    const marker = params.get("rf_ga_event");
    if (marker) {
      marker.split(",").map((name) => name.trim()).filter((name): name is GaEventName => allowedEvents.has(name as GaEventName))
        .forEach((name) => eventOnce(name, measurementId, path));
      params.delete("rf_ga_event");
      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = params.toString();
      window.history.replaceState(window.history.state, "", cleanUrl);
    }
    document.querySelectorAll<HTMLElement>("[data-rf-analytics-event], [data-rf-analytics-events]").forEach((element) => conversionFromElement(element, measurementId, path));
  }, [consent, measurementId, pathname, privacyBlocked, search]);

  useEffect(() => {
    if (!measurementId || consent !== "accepted" || privacyBlocked) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const actionable = target.closest<HTMLElement>("a,button,[role='button'],input[type='submit']");
      if (actionable) eventForClick(actionable, measurementId);
    };
    const onCustomEvent = (event: Event) => {
      const name = (event as CustomEvent<{ name?: string }>).detail?.name;
      if (name && allowedEvents.has(name as GaEventName)) eventOnce(name as GaEventName, measurementId, safePath(window.location.pathname));
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("runfloor:analytics", onCustomEvent);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("runfloor:analytics", onCustomEvent);
    };
  }, [consent, measurementId, privacyBlocked]);

  const chooseConsent = (choice: Exclude<ConsentChoice, null>) => {
    setConsent(choice);
    try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* The choice still applies for this page view. */ }
  };

  return measurementId && !privacyBlocked && consent === null
    ? <ConsentNotice onChoose={chooseConsent} />
    : null;
}
