"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function TopScrollTable({ children }: { children: ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const top = topRef.current;
    const spacer = spacerRef.current;
    const table = tableRef.current;
    if (!top || !spacer || !table) return;
    let syncing = false;
    const updateWidth = () => { spacer.style.width = `${table.scrollWidth}px`; };
    const syncTop = () => { if (!syncing) { syncing = true; table.scrollLeft = top.scrollLeft; syncing = false; } };
    const syncTable = () => { if (!syncing) { syncing = true; top.scrollLeft = table.scrollLeft; syncing = false; } };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(table);
    top.addEventListener("scroll", syncTop);
    table.addEventListener("scroll", syncTable);
    return () => { observer.disconnect(); top.removeEventListener("scroll", syncTop); table.removeEventListener("scroll", syncTable); };
  }, []);

  return <><div ref={topRef} aria-label="Scroll product models horizontally" style={{ overflowX: "auto", overflowY: "hidden", height: 18, marginBottom: 6 }}><div ref={spacerRef} style={{ height: 1 }}/></div><div ref={tableRef} className="table-wrap">{children}</div></>;
}
