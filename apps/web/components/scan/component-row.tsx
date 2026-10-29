import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { formatAgo, statusLabel } from "@/lib/copy";
import { useServices } from "@/lib/services/context";
import type { Detection } from "@/lib/types";

export const rowId = (id: string) => `component-${id}`;

const STATUS_STYLE = {
  anomaly: "border-anomaly bg-anomaly-soft",
  warning: "border-warning bg-warning-soft",
  ok: "",
} as const;

export function ComponentRow({
  detection,
  selected,
  now,
  animateIn,
  onSelect,
}: {
  detection: Detection;
  selected: boolean;
  now: number;
  animateIn: boolean;
  onSelect: (id: string) => void;
}) {
  const { Thumbnail } = useServices();
  const meta = [
    detection.score === null ? null : `conf. ${detection.score.toFixed(2)}`,
    formatAgo(now, detection.seenAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="option"
      id={rowId(detection.id)}
      aria-selected={selected}
      onClick={() => onSelect(detection.id)}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border-l-[3px] border-transparent p-3 transition-colors hover:bg-accent",
        STATUS_STYLE[detection.status],
        selected && "bg-accent ring-2 ring-primary",
        animateIn &&
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2",
      )}
    >
      <Thumbnail detection={detection} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{detection.label}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      <Badge variant={detection.status}>{statusLabel[detection.status]}</Badge>
    </div>
  );
}
