"use client";

import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STAGE_NAMES } from "@/lib/fixtures/dev-scenario";
import {
  SCENARIO_NAMES,
  getScenario,
  type ScenarioName,
} from "@/lib/fixtures/scenarios";
import { useSession } from "@/lib/session/session-provider";
import type { StageState } from "@/lib/types";

const SCENARIO_LABELS: Record<ScenarioName, string> = {
  empty: "Vacío",
  healthy: "Sin hallazgos",
  findings: "Con hallazgos",
};

const STAGE_LABELS: Record<StageState, string> = {
  ready: "Cámara lista",
  "no-permission": "Sin permiso",
  "no-camera": "Sin cámaras",
  "loading-model": "Cargando modelo",
};

/**
 * Development-only switcher for the demo scenario and the camera state, so
 * every screen state can be reviewed without touching the URL.
 */
export function DemoControls() {
  const detections = useSession((s) => s.detections);
  const stage = useSession((s) => s.stage);
  const setStage = useSession((s) => s.setStage);
  const replaceDetections = useSession((s) => s.replaceDetections);

  const ids = detections.map((d) => d.id).join();
  const current =
    SCENARIO_NAMES.find(
      (name) =>
        getScenario(name)
          .map((d) => d.id)
          .join() === ids,
    ) ?? "findings";

  return (
    <div className="absolute bottom-3 left-3 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full bg-black/50 px-3 text-xs text-white backdrop-blur hover:bg-black/60 hover:text-white"
          >
            <FlaskConical aria-hidden="true" className="size-4" />
            Demo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuLabel>Escenario</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={current}
            onValueChange={(value) =>
              replaceDetections(getScenario(value as ScenarioName))
            }
          >
            {SCENARIO_NAMES.map((name) => (
              <DropdownMenuRadioItem key={name} value={name}>
                {SCENARIO_LABELS[name]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Estado de la cámara</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={stage}
            onValueChange={(value) => setStage(value as StageState)}
          >
            {STAGE_NAMES.map((name) => (
              <DropdownMenuRadioItem key={name} value={name}>
                {STAGE_LABELS[name]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
