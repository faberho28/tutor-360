"use client";

import { cn } from "cn";
import {
  TUTOR_LEVELS,
  TUTOR_LEVEL_INFO,
  type TutorLevel,
} from "@/lib/tutor/levels";

/** How much the user already knows: the tutor adapts how it explains and how big each step is. */
export function LevelPicker({
  value,
  onChange,
}: {
  value: TutorLevel;
  onChange: (level: TutorLevel) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">
        ¿Cuánta experiencia tienes?
      </legend>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {TUTOR_LEVELS.map((level) => {
          const info = TUTOR_LEVEL_INFO[level];
          const selected = level === value;
          return (
            <label
              key={level}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                selected
                  ? "border-primary bg-accent"
                  : "hover:border-primary/50 hover:bg-accent",
              )}
            >
              <input
                type="radio"
                name="tutor-level"
                value={level}
                checked={selected}
                onChange={() => onChange(level)}
                className="sr-only"
              />
              <span className="text-sm font-semibold">{info.title}</span>
              <span className="text-xs text-muted-foreground">
                {info.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
