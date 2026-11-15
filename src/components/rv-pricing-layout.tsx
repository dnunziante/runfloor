"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function RvPricingLayout({ children }: { children: ReactNode }) {
  const layout = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = layout.current;
    const card = container?.querySelector<HTMLElement>(".rv-price-card");
    if (!container || !card) return;
    const header = document.querySelector<HTMLElement>(".lp-nav");
    let frame = 0;

    function measure() {
      if (!container || !card) return;
      const headerPosition = header ? getComputedStyle(header).position : "static";
      const offset = header && ["fixed", "sticky"].includes(headerPosition)
        ? Math.ceil(header.getBoundingClientRect().height) + 24
        : 32;
      const fits = window.innerWidth >= 900 && card.getBoundingClientRect().height + offset + 24 <= window.innerHeight;
      container.style.setProperty("--rv-sticky-top", `${offset}px`);
      container.dataset.sticky = String(fits);
    }

    function scheduleMeasure() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(card);
    if (header) observer.observe(header);
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, []);

  return <div className="rv-pricing-layout" ref={layout}>{children}</div>;
}
