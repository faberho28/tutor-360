"use client";

import {
  Aperture,
  Box,
  Ellipsis,
  FileDown,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { toast } from "sonner";
import { useAnalysis } from "@/components/scan/analysis-provider";
import { Button } from "@/components/ui/button";
import { ModelViewerDialog } from "@/components/scan/model-viewer-dialog";
import { ReportDialog } from "@/components/scan/report-dialog";
import { ResetContextDialog } from "@/components/scan/reset-context-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useScanShortcuts } from "@/hooks/use-scan-shortcuts";
import { useUnsavedCapturesWarning } from "@/hooks/use-unsaved-captures";
import { AnalyzeClientError } from "@/lib/analysis/analyze-client";
import { waitForReviews } from "@/lib/analysis/wait-reviews";
import { copy } from "@/lib/copy";
import { composeCapture, MAX_CAPTURES } from "@/lib/overlay/compose-capture";
import { useServices } from "@/lib/services/context";
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
 * analysis the page provides.
 */
export function ControlBar() {
  const store = useSessionStore();
  const services = useServices();
  const { analysis } = useAnalysis();
  const auto = useSession((s) => s.analysis.mode === "auto");
  const hasSelection = useSession((s) => s.selectedId !== null);
  const hasCaptures = useSession((s) => s.captures.length > 0);
  const [reportOpen, setReportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const autoAvailable = analysis.autoAvailable;
  useUnsavedCapturesWarning(hasCaptures);

  async function capture() {
    if (store.getState().captures.length >= MAX_CAPTURES) {
      toast.error(
        `Llegaste al máximo de ${MAX_CAPTURES} capturas. Genera el reporte o elimina alguna.`,
      );
      return;
    }
    try {
      const image = await analysis.snapshot();
      if (!image) {
        toast.error("La cámara aún no está lista");
        return;
      }
      // The names and statuses come from Spark's second look, a moment later.
      await waitForReviews(store);
      const state = store.getState();
      const saved = state.addCapture(
        state.detections,
        // The picture shows what the user sees: hidden masks are not drawn
        // (the findings of the capture still list every part).
        composeCapture(
          image,
          state.detections.filter((d) => !state.hiddenIds.includes(d.id)),
          state.view,
        ),
      );
      // Read again: `state` is the snapshot from before the capture was added.
      toast.success(`Captura ${store.getState().captures.length} guardada`, {
        id: saved.id,
      });
    } catch (error) {
      // An analysis failure carries its own message (offline, quota, ...).
      toast.error(
        error instanceof AnalyzeClientError
          ? error.message
          : "No pudimos guardar la captura",
      );
    }
  }

  function toggleAuto() {
    if (!autoAvailable) return;
    if (auto) analysis.stop();
    else analysis.start();
  }

  function view3d() {
    const { selectedId } = store.getState();
    if (selectedId) services.requestModel(store, selectedId);
  }

  function report() {
    if (store.getState().captures.length === 0) return;
    setReportOpen(true);
  }

  // Captures are the only thing that cannot be recovered: ask before losing them.
  function requestReset() {
    if (store.getState().captures.length > 0) setResetOpen(true);
    else resetContext();
  }

  function resetContext() {
    analysis.reset();
    toast.success("Contexto reiniciado");
  }

  const showGrid = useSession((s) => s.showChangeGrid);
  const toggleGrid = useSession((s) => s.toggleChangeGrid);

  useScanShortcuts({ capture, toggleAuto, report, toggleGrid });

  return (
    <>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />
      <ModelViewerDialog />
      <ResetContextDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={resetContext}
      />
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
              autoAvailable
                ? auto
                  ? copy.controls.autoOff
                  : copy.controls.autoOn
                : "Análisis automático (próximamente)"
            }
            shortcut={autoAvailable ? "A" : undefined}
          >
            <Button
              type="button"
              size="control"
              variant="secondary"
              aria-pressed={auto}
              aria-disabled={!autoAvailable || undefined}
              aria-label={auto ? copy.controls.autoOff : copy.controls.autoOn}
              aria-keyshortcuts="A"
              onClick={toggleAuto}
              className={cn(
                "border",
                auto && "border-primary text-primary",
                !autoAvailable && "opacity-50",
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

          <DropdownMenu>
            <Hint label={copy.controls.more}>
              <DropdownMenuTrigger asChild>
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
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="end" side="top" className="min-w-56">
              <DropdownMenuCheckboxItem
                checked={showGrid}
                onCheckedChange={() => toggleGrid()}
              >
                {copy.controls.changeGrid}
                <DropdownMenuShortcut>G</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem onSelect={requestReset}>
                <RotateCcw aria-hidden="true" />
                {copy.controls.reset}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}
