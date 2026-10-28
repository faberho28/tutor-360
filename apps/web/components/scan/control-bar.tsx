"use client";

import { Aperture, Box, Ellipsis, FileDown, Pause, Play } from "lucide-react";
import { cn } from "cn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useScanShortcuts } from "@/hooks/use-scan-shortcuts";
import { copy } from "@/lib/copy";
import { MockAnalysisSource } from "@/lib/fixtures/mock-source";
import { useSession, useSessionStore } from "@/lib/session/session-provider";

function Hint({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">
        {label}
        {shortcut ? (
          <kbd className="rounded bg-background/20 px-1.5 py-0.5 font-sans text-[10px]">
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Floating bar: capture, automatic analysis, 3D view and report. It drives the
 * analysis source, which is simulated until the camera and the API (HU-18).
 */
export function ControlBar() {
  const store = useSessionStore();
  const auto = useSession((s) => s.analysis.mode === "auto");
  const hasSelection = useSession((s) => s.selectedId !== null);
  const hasCaptures = useSession((s) => s.captures.length > 0);
  const [source] = useState(() => new MockAnalysisSource(store));

  useEffect(() => () => source.dispose(), [source]);

  async function capture() {
    await source.captureOnce();
    const state = store.getState();
    const saved = state.addCapture(state.detections);
    // Read again: `state` is the snapshot from before the capture was added.
    toast.success(`Captura ${store.getState().captures.length} guardada`, {
      id: saved.id,
    });
  }

  function toggleAuto() {
    if (auto) source.stop();
    else source.start();
  }

  function view3d() {
    if (!store.getState().selectedId) return;
    toast.info("El visor 3D todavía no está disponible");
  }

  function report() {
    if (store.getState().captures.length === 0) return;
    toast.info("La generación de reportes todavía no está disponible");
  }

  useScanShortcuts({ capture, toggleAuto, report });

  return (
    <div
      role="toolbar"
      aria-label="Controles de captura"
      className={cn(
        "group pointer-events-auto grid w-fit grid-cols-[96px_44px_96px] items-center gap-2 overflow-hidden rounded-full border bg-card/90 p-2 shadow-lg shadow-black/5 backdrop-blur transition-[grid-template-columns,gap] duration-300 ease-out motion-reduce:transition-none",
        "[@media(hover:hover)]:grid-cols-[0px_44px_0px] [@media(hover:hover)]:gap-0 [@media(hover:hover)]:hover:grid-cols-[96px_44px_96px] [@media(hover:hover)]:hover:gap-2 [@media(hover:hover)]:focus-within:grid-cols-[96px_44px_96px] [@media(hover:hover)]:focus-within:gap-2",
      )}
    >
      <div className="flex items-center justify-between opacity-100 transition-opacity duration-200 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100">
        <Hint
          label={auto ? copy.controls.autoOff : copy.controls.autoOn}
          shortcut="A"
        >
          <Button
            type="button"
            size="control"
            variant="secondary"
            aria-pressed={auto}
            aria-label={auto ? copy.controls.autoOff : copy.controls.autoOn}
            aria-keyshortcuts="A"
            onClick={toggleAuto}
            className={cn("border", auto && "border-primary text-primary")}
          >
            {auto ? (
              <Pause aria-hidden="true" className="size-5" strokeWidth={1.75} />
            ) : (
              <Play aria-hidden="true" className="size-5" strokeWidth={1.75} />
            )}
          </Button>
        </Hint>

        <Hint
          label={
            hasSelection
              ? copy.controls.view3d
              : copy.controls.view3dNeedsSelection
          }
        >
          <Button
            type="button"
            size="control"
            variant="secondary"
            // aria-disabled keeps it focusable so the hint also shows with the keyboard.
            aria-disabled={!hasSelection || undefined}
            aria-label={copy.controls.view3d}
            onClick={view3d}
            className={cn("border", !hasSelection && "opacity-50")}
          >
            <Box aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </Button>
        </Hint>
      </div>

      <Hint label={copy.controls.capture} shortcut="Espacio">
        <Button
          type="button"
          size="control"
          variant="inverse"
          aria-label={copy.controls.capture}
          aria-keyshortcuts="Space"
          onClick={capture}
        >
          <Aperture aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </Button>
      </Hint>

      <div className="flex items-center justify-between opacity-100 transition-opacity duration-200 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100">
        <Hint
          label={
            hasCaptures
              ? copy.controls.report
              : copy.controls.reportNeedsCapture
          }
          shortcut={hasCaptures ? "R" : undefined}
        >
          <Button
            type="button"
            size="control"
            variant="secondary"
            aria-label={copy.controls.report}
            aria-disabled={!hasCaptures || undefined}
            aria-keyshortcuts="R"
            onClick={report}
            className={cn("border", !hasCaptures && "opacity-50")}
          >
            <FileDown
              aria-hidden="true"
              className="size-5"
              strokeWidth={1.75}
            />
          </Button>
        </Hint>

        <Hint label={copy.controls.more}>
          <Button
            type="button"
            size="control"
            variant="secondary"
            aria-label={copy.controls.more}
            className="border"
          >
            <Ellipsis
              aria-hidden="true"
              className="size-5"
              strokeWidth={1.75}
            />
          </Button>
        </Hint>
      </div>
    </div>
  );
}
