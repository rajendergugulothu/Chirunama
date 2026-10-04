"use client";

import { usePathname } from "next/navigation";
import { useRef, type MouseEvent, type ReactNode } from "react";

// A <details> dropdown for the header. The layout stays mounted across client-side
// navigation, so the menu closes itself when one of its links is followed (even to the page
// already open) and is keyed on the path so back and forward close it too.
export function NavMenu({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);

  function closeOnLink(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a") && menu.current) menu.current.open = false;
  }

  return (
    <details key={pathname} ref={menu} className="relative min-w-0">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-line px-3 py-1 text-sm hover:bg-brand-soft [&::-webkit-details-marker]:hidden">
        {summary}
        <span aria-hidden="true" className="text-xs text-muted">
          ▾
        </span>
      </summary>
      <div
        onClick={closeOnLink}
        className="absolute right-0 z-10 mt-2 flex w-48 flex-col rounded-xl border border-line bg-surface py-1 text-sm shadow-lg"
      >
        {children}
      </div>
    </details>
  );
}
