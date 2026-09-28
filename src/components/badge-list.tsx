import type { BadgeCheck } from "@/lib/types";

// Every badge states exactly what was checked, by whom and when. Never a blanket "100% safe".
export function BadgeList({
  badges,
  labels,
  detail,
  compact = false,
}: {
  badges: BadgeCheck[];
  labels: Record<string, string>;
  detail?: (by: string, on: string) => string;
  compact?: boolean;
}) {
  if (badges.length === 0) return null;

  return (
    <ul className={compact ? "flex flex-wrap gap-1" : "flex flex-col gap-2"}>
      {badges.map((badge) => (
        <li key={badge.type} className={compact ? "" : "flex flex-col"}>
          <span className="inline-block w-fit rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
            ✓ {labels[badge.type]}
          </span>
          {!compact && detail && <span className="text-sm text-muted">{detail(badge.checkedBy, badge.checkedOn)}</span>}
        </li>
      ))}
    </ul>
  );
}
