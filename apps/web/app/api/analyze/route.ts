import { analyzeFrame } from "@/lib/analysis/analyze";
import { MAX_BODY_BYTES, analyzeRequestSchema } from "@/lib/analysis/request";
import type {
  AnalyzeErrorKind,
  AnalyzeErrorResponse,
} from "@/lib/analysis/types";
import { getEnv } from "@/lib/env";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";
import { ModelError, toModelError } from "@/lib/models/errors";
import { MetaScenePlanner } from "@/lib/models/planner";
import { MetaSegmenter } from "@/lib/models/segmenter";

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

function fail(kind: AnalyzeErrorKind) {
  const body: AnalyzeErrorResponse = {
    error: { kind, message: MESSAGE[kind] },
  };
  return Response.json(body, { status: STATUS[kind] });
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail("invalid_input");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("invalid_input");
  }
  const parsed = analyzeRequestSchema.safeParse(payload);
  if (!parsed.success) return fail("invalid_input");

  // The user's own key (from Ajustes) wins over the server's. It is only
  // passed on to the model client: never stored, never logged.
  const sentKey = request.headers.get(API_KEY_HEADER);
  if (sentKey !== null && !API_KEY_PATTERN.test(sentKey)) return fail("auth");

  try {
    let env;
    try {
      env = getEnv();
    } catch (error) {
      throw new ModelError("not_configured", "Invalid environment", {
        cause: error,
      });
    }
    const result = await analyzeFrame(
      {
        imageDataUrl: parsed.data.image,
        width: parsed.data.width,
        height: parsed.data.height,
      },
      {
        planner: new MetaScenePlanner(),
        segmenter: new MetaSegmenter(),
        context: parsed.data.context,
        judgesCondition: parsed.data.judgesCondition,
        apiKey: sentKey ?? undefined,
        threshold: env.SEGMENT_SCORE_THRESHOLD,
        signal: request.signal,
      },
    );
    return Response.json(result);
  } catch (error) {
    const modelError = toModelError(error);
    // Kind and status only: neither the image nor SDK messages go to the log.
    console.error(
      `[analyze] ${modelError.kind} status=${modelError.status ?? "-"}`,
    );
    return fail(modelError.kind);
  }
}
