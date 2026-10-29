import type { AnalyzeErrorKind, AnalyzeErrorResponse } from "./types";

const STATUS: Record<AnalyzeErrorKind, number> = {
  invalid_input: 400,
  not_configured: 503,
  quota: 429,
  timeout: 504,
  aborted: 499,
  auth: 502,
  network: 502,
  invalid_response: 502,
  refused: 502,
  unknown: 502,
};

// Fixed texts on purpose: SDK messages can echo parts of the API key.
const MESSAGE: Record<AnalyzeErrorKind, string> = {
  invalid_input: "La imagen enviada no es válida",
  not_configured: "La IA no está configurada en el servidor",
  auth: "El servidor no pudo autenticarse con la IA",
  quota: "Cuota de la IA agotada",
  timeout: "La IA tardó demasiado en responder",
  network: "Sin conexión con la IA",
  refused: "La IA no pudo procesar la imagen",
  invalid_response: "La IA devolvió una respuesta que no pudimos usar",
  aborted: "Análisis cancelado",
  unknown: "Algo salió mal al analizar",
};

/** The JSON error response the analysis endpoints answer with. */
export function failure(kind: AnalyzeErrorKind) {
  const body: AnalyzeErrorResponse = {
    error: { kind, message: MESSAGE[kind] },
  };
  return Response.json(body, { status: STATUS[kind] });
}
