/**
 * What the user is about to show to the camera. The case gives the AI its
 * context (HU-35 uses it to decide what to look for); this module only holds
 * the data and resolves a case from the address.
 *
 * Titles and examples are UI text (es-CO). `context` is a prompt for the model,
 * so it is written in English.
 */

export const LAB_CASE_IDS = [
  "computador",
  "celular",
  "teclado",
  "legos",
  "personalizado",
] as const;

export type LabCaseId = (typeof LAB_CASE_IDS)[number];

export type LabCase = {
  id: LabCaseId;
  title: string;
  description: string;
  /** Short chips on the card. */
  examples: readonly string[];
  /** Prompt context for the model. `personalizado` builds it from the user's text. */
  context: string;
  /**
   * Whether the AI should judge the condition (ok / warning / anomaly) of what
   * it sees. False for tasks that are about identifying and counting.
   */
  judgesCondition: boolean;
};

export const LAB_CASES: readonly LabCase[] = [
  {
    id: "computador",
    title: "Computador",
    description:
      "Placa, memoria, discos, ventiladores y cables de un PC o un portátil abierto.",
    examples: ["Capacitores", "RAM y SSD", "Polvo y cables"],
    context:
      "The user will show the inside of a desktop or laptop computer: motherboard, RAM, storage drives, fans, power supply and cables. " +
      "Identify the components and look for signs of failure: swollen or leaking capacitors, dust build-up, loose or damaged cables, burn marks, corrosion.",
    judgesCondition: true,
  },
  {
    id: "celular",
    title: "Celular",
    description: "Teléfono o tableta desmontados: batería, placa y conectores.",
    examples: ["Batería", "Placa", "Conectores flex"],
    context:
      "The user will show a disassembled smartphone or tablet: battery, logic board, cameras, flex cables and connectors, screws and shields. " +
      "Identify the parts and look for signs of failure: a swollen battery, liquid damage or corrosion, burnt components, torn or loose flex cables.",
    judgesCondition: true,
  },
  {
    id: "teclado",
    title: "Teclado",
    description: "Teclas, switches, placa y cable de un teclado.",
    examples: ["Teclas", "Switches", "Líquido derramado"],
    context:
      "The user will show a keyboard, whole or opened: keycaps, switches, stabilizers, circuit board, cable and connector. " +
      "Identify the parts and look for signs of failure: liquid residue or corrosion, missing or stuck keys, damaged switches, a frayed cable or bent connector pins.",
    judgesCondition: true,
  },
  {
    id: "legos",
    title: "Legos",
    description:
      "Piezas sueltas o armadas: identifícalas, cuéntalas y clasifícalas.",
    examples: ["Piezas", "Colores", "Conteo"],
    context:
      "The user will show LEGO bricks and pieces, loose or assembled. " +
      "Identify and count the different piece types and colors. This is an inventory task: do not judge condition, report every piece as ok.",
    judgesCondition: false,
  },
  {
    id: "personalizado",
    title: "Personalizado",
    description: "Describe qué vas a mostrar y qué quieres buscar.",
    examples: ["Cualquier equipo u objeto"],
    context: "",
    judgesCondition: true,
  },
];

/** Bounds of the free text of the custom case. */
export const CUSTOM_MIN = 10;
export const CUSTOM_MAX = 300;

/** What the session keeps: serializable, without the card text. */
export type LabCaseSnapshot = {
  id: LabCaseId;
  title: string;
  /** One line for the scanner header: the card's text, or the user's own. */
  description: string;
  context: string;
  judgesCondition: boolean;
};

/** Trims and collapses whitespace; returns null when the text is unusable. */
export function cleanCustomText(text: string | undefined): string | null {
  const clean = (text ?? "").replace(/\s+/g, " ").trim().slice(0, CUSTOM_MAX);
  return clean.length >= CUSTOM_MIN ? clean : null;
}

/**
 * The case named by the address (`?caso=` and, for the custom one, `?contexto=`),
 * or null when it is missing or invalid.
 */
export function resolveLabCase(
  id: string | undefined,
  customText?: string,
): LabCaseSnapshot | null {
  const found = LAB_CASES.find((labCase) => labCase.id === id);
  if (!found) return null;

  if (found.id === "personalizado") {
    const text = cleanCustomText(customText);
    if (!text) return null;
    return {
      id: found.id,
      title: found.title,
      description: text,
      context: `The user describes what they will show and what they are looking for: "${text}". Identify the visible objects that matter for that request and report their condition when it is relevant.`,
      judgesCondition: true,
    };
  }

  return {
    id: found.id,
    title: found.title,
    description: found.description,
    context: found.context,
    judgesCondition: found.judgesCondition,
  };
}

/** The address that opens the scanner with a case. */
export function scanHref(id: LabCaseId, customText?: string): string {
  const params = new URLSearchParams({ caso: id });
  const text = cleanCustomText(customText);
  if (id === "personalizado" && text) params.set("contexto", text);
  return `/scan?${params.toString()}`;
}
