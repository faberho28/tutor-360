"use client";

import { Aperture, Box, Ellipsis, FileDown, Pause, Play } from "lucide-react";
import { cn } from "cn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ModelViewerDialog } from "@/components/scan/model-viewer-dialog";
import { ReportDialog } from "@/components/scan/report-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useScanShortcuts } from "@/hooks/use-scan-shortcuts";
import { copy } from "@/lib/copy";
import { requestMockModel } from "@/lib/fixtures/mock-reconstruction";
import { DEMO_IMAGE } from "@/lib/fixtures/scenarios";
import { composeCapture, loadImage } from "@/lib/overlay/compose-capture";
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
export function ControlBar({
  getVideo,
}: {
  getVideo: () => HTMLVideoElement | null;
}) {
  const store = useSessionStore();
  const frameSource = useSession((s) => s.source);
  const demo = frameSource === "demo";
  const auto = useSession((s) => s.analysis.mode === "auto");
  const hasSelection = useSession((s) => s.selectedId !== null);
  const hasCaptures = useSession((s) => s.captures.length > 0);
  const [source] = useState(() => new MockAnalysisSource(store));
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => () => source.dispose(), [source]);

  async function capture() {
    try {
      let image: HTMLImageElement | HTMLVideoElement;
      if (demo) {
        await source.captureOnce();
        image = await loadImage(DEMO_IMAGE.src);
      } else {
        const video = getVideo();
        if (!video || video.readyState < 2 || video.videoWidth === 0) {
          toast.error("La cámara aún no está lista");
          return;
        }
        image = video;
      }
      const state = store.getState();
      const saved = state.addCapture(
        state.detections,
        composeCapture(image, state.detections),
      );
      // Read again: `state` is the snapshot from before the capture was added.
      toast.success(`Captura ${store.getState().captures.length} guardada`, {
        id: saved.id,
      });
    } catch {
      toast.error("No pudimos guardar la captura");
    }
  }

  function toggleAuto() {
    // Real analysis arrives with HU-17/18.
    if (!demo) return;
    if (auto) source.stop();
    else source.start();
  }

  function view3d() {
    const { selectedId } = store.getState();
    if (selectedId) requestMockModel(store, selectedId);
  }

  function report() {
    if (store.getState().captures.length === 0) return;
    setReportOpen(true);
  }

  useScanShortcuts({ capture, toggleAuto, report });

  return (
    <>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />
      <ModelViewerDialog />
      <div
        role="toolbar"
        aria-label="Controles de captura"
        className={cn(
          "group pointer-events-auto grid w-fit grid-cols-[68px_32px_68px] items-center gap-1 overflow-hidden rounded-full border bg-card/90 p-1 shadow-lg shadow-black/5 backdrop-blur transition-[grid-template-columns,gap] duration-300 ease-out motion-reduce:transition-none",
          "[@media(hover:hover)]:grid-cols-[0px_32px_0px] [@media(hover:hover)]:gap-0 [@media(hover:hover)]:hover:grid-cols-[68px_32px_68px] [@media(hover:hover)]:hover:gap-1 [@media(hover:hover)]:focus-within:grid-cols-[68px_32px_68px] [@media(hover:hover)]:focus-within:gap-1",
        )}
      >
        <div className="flex items-center justify-between opacity-100 transition-opacity duration-200 motion-reduce:transition-none [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100">
          <Hint
            label={
              demo
                ? auto
                  ? copy.controls.autoOff
                  : copy.controls.autoOn
                : "Análisis automático (próximamente)"
            }
            shortcut={demo ? "A" : undefined}
          >
            <Button
              type="button"
              size="control"
              variant="secondary"
              aria-pressed={auto}
              aria-disabled={!demo || undefined}
              aria-label={auto ? copy.controls.autoOff : copy.controls.autoOn}
              aria-keyshortcuts="A"
              onClick={toggleAuto}
              className={cn(
                "border",
                auto && "border-primary text-primary",
                !demo && "opacity-50",
              )}
            >
              {auto ? (
                <Pause
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              ) : (
                <Play
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
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
              <Box aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </Button>
          </Hint>
        </div>

        <Hint label={copy.controls.capture} shortcut="Espacio">
          <Button
            type="button"
            size="control"
            variant="ghost"
            aria-label={copy.controls.capture}
            aria-keyshortcuts="Space"
            onClick={capture}
          >
            <Aperture
              aria-hidden="true"
              className="size-6"
              strokeWidth={1.75}
            />
          </Button>
        </Hint>

        <div className="flex items-center justify-between opacity-100 transition-opacity duration-200 motion-reduce:transition-none [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100">
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
                className="size-4"
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
                className="size-4"
                strokeWidth={1.75}
              />
            </Button>
          </Hint>
        </div>
      </div>
    </>
  );
}
