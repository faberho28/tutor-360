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
  invalid_input: "The image sent is not valid",
  not_configured: "The AI is not configured on the server",
  auth: "The server could not authenticate with the AI",
  quota: "AI quota exhausted",
  timeout: "The AI took too long to respond",
  network: "No connection to the AI",
  refused: "The AI could not process the image",
  invalid_response: "The AI returned a response we could not use",
  aborted: "Analysis cancelled",
  unknown: "Something went wrong while analyzing",
};

/** The JSON error response the analysis endpoints answer with. */
export function failure(kind: AnalyzeErrorKind) {
  const body: AnalyzeErrorResponse = {
    error: { kind, message: MESSAGE[kind] },
  };
  return Response.json(body, { status: STATUS[kind] });
}
