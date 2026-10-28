import type { ComponentClass } from "../component-status";
import type { SessionStore } from "../session/store";
import type { Detection, Diagnosis } from "../types";

/**
 * Simulated diagnoses for the classes that need attention. HU-21 replaces
 * `requestMockDiagnosis` with the real call to /api/diagnose; the screen keeps
 * reading the same store entries.
 */
const DIAGNOSES: Partial<Record<ComponentClass, Diagnosis>> = {
  CAPACITOR_INFLATED: {
    severity: "high",
    summary:
      "La parte superior del capacitor está abultada, una señal típica de falla por sobrecalentamiento o fin de vida útil. Puede causar reinicios, apagones o que el equipo no encienda.",
    steps: [
      "Desconecta el equipo y espera unos minutos para que se descarguen los capacitores.",
      "Anota el valor (µF), el voltaje y la polaridad impresos en el capacitor.",
      "Revisa si hay otros capacitores abultados o con fugas en la misma zona.",
      "Reemplázalo por uno del mismo valor, con voltaje igual o mayor y la polaridad correcta.",
      "Enciende el equipo y verifica que arranque y se mantenga estable.",
    ],
  },
  CABLE_POWER_LOOSE: {
    severity: "high",
    summary:
      "El conector de alimentación no está bien asentado. Puede provocar apagones intermitentes o que el equipo no encienda.",
    steps: [
      "Apaga y desconecta el equipo.",
      "Retira el conector y vuelve a insertarlo hasta que encaje del todo.",
      "Revisa que los pines no estén doblados ni quemados.",
      "Enciende el equipo y confirma que la conexión queda firme.",
    ],
  },
  DUST_REGION: {
    severity: "medium",
    summary:
      "Hay acumulación de polvo en esta zona. Reduce la ventilación y puede provocar sobrecalentamiento con el tiempo.",
    steps: [
      "Apaga y desconecta el equipo.",
      "Sopla el polvo con aire comprimido en ráfagas cortas, sin tocar los componentes.",
      "Usa una brocha antiestática donde el polvo esté pegado.",
      "Revisa ventiladores y disipadores: deben girar libres y estar limpios.",
      "Vuelve a escanear la zona para confirmar que quedó limpia.",
    ],
  },
};

/** Development switch: the next diagnosis requests fail (Demo menu). */
export const diagnosisDemo = { fail: false };

const LATENCY_MS = 700;

/**
 * Starts a (simulated) diagnosis for a detection and writes its progress to
 * the store. It does nothing if one is already loading.
 */
export function requestMockDiagnosis(
  store: SessionStore,
  detection: Detection,
): void {
  const state = store.getState();
  if (state.diagnoses[detection.id]?.status === "loading") return;

  state.setDiagnosis(detection.id, { status: "loading" });
  setTimeout(() => {
    const data = DIAGNOSES[detection.cls];
    store
      .getState()
      .setDiagnosis(
        detection.id,
        diagnosisDemo.fail || !data
          ? { status: "error" }
          : { status: "ready", data },
      );
  }, LATENCY_MS);
}
