"use client";

import { FlaskConical } from "lucide-react";
import { useState } from "react";
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
  playLiveScenario,
  stopLiveScenario,
} from "@/lib/fixtures/live-scenario";
import {
  SCENARIO_NAMES,
  getScenario,
  type ScenarioName,
} from "@/lib/fixtures/scenarios";
import { useSession, useSessionStore } from "@/lib/session/session-provider";
import type { StageState } from "@/lib/types";

const SCENARIO_LABELS: Record<ScenarioName, string> = {
  empty: "Vacío",
  healthy: "Sin hallazgos",
  findings: "Con hallazgos",
  live: "En vivo (guion de 11 s)",
};

const STAGE_LABELS: Record<StageState, string> = {
  ready: "Cámara lista",
  "no-permission": "Sin permiso",
  "no-camera": "Sin cámaras",
  "loading-model": "Cargando modelo",
};

/** The scenario the page started with: the URL parameter, else findings. */
function initialScenario(): ScenarioName {
  if (typeof window === "undefined") return "findings";
  const value = new URLSearchParams(window.location.search).get("scenario");
  return (SCENARIO_NAMES as readonly string[]).includes(value ?? "")
    ? (value as ScenarioName)
    : "findings";
}

/**
 * Development-only switcher for the demo scenario and the camera state, so
 * every screen state can be reviewed without touching the URL.
 */
export function DemoControls() {
  const store = useSessionStore();
  const stage = useSession((s) => s.stage);
  const setStage = useSession((s) => s.setStage);
  const [scenario, setScenario] = useState<ScenarioName>(initialScenario);

  function changeScenario(value: string) {
    const next = value as ScenarioName;
    setScenario(next);
    stopLiveScenario();
    if (next === "live") {
      playLiveScenario(store);
    } else {
      const state = store.getState();
      state.replaceDetections(getScenario(next));
      state.setAnalysis({ phase: "idle" });
    }
  }

  return (
    <div className="absolute top-14 left-3 z-10">
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
            value={scenario}
            onValueChange={changeScenario}
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
