// The feedback shape the model returns and the client shows, for the server and the client.
// Dimensions and rating labels mirror prompts/rubric.md; a test checks they match.

export const RUBRIC_DIMENSIONS = [
  { id: "requirements", label: "Requirements and scoping" },
  { id: "highLevelDesign", label: "High-level design" },
  { id: "dataAndApis", label: "Data and APIs" },
  { id: "scaling", label: "Scaling, reliability, bottlenecks" },
  { id: "tradeoffs", label: "Tradeoffs and decisions" },
  { id: "communication", label: "Communication and structure" },
] as const;

export type DimensionId = (typeof RUBRIC_DIMENSIONS)[number]["id"];

export const RATING_LABELS = { 1: "Needs work", 2: "Developing", 3: "Solid", 4: "Strong" } as const;

export type Rating = keyof typeof RATING_LABELS;

const RATINGS = Object.keys(RATING_LABELS).map(Number) as Rating[];

// `rating` is null when the dimension was not observed.
export interface DimensionFeedback {
  rating: Rating | null;
  evidence: string;
}

// The list sections and how many items each needs (docs/spec.md, Feedback Output Format):
// top 2-3 strengths and areas to improve, and 3 practice steps. The Feedback type, schema,
// and parser all come from this, so adding or changing a section is one edit here.
export const FEEDBACK_LISTS = {
  strengths: { min: 2, max: 3 },
  improvements: { min: 2, max: 3 },
  practiceSteps: { min: 3, max: 3 },
} as const;

export type FeedbackListId = keyof typeof FEEDBACK_LISTS;

const LIST_IDS = Object.keys(FEEDBACK_LISTS) as FeedbackListId[];

export type Feedback = {
  summary: string;
  dimensions: Record<DimensionId, DimensionFeedback>;
} & Record<FeedbackListId, string[]>;

// Sent as the structured output schema. The API ignores array-length rules,
// so parseFeedback checks list lengths instead.
export const FEEDBACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "dimensions", ...LIST_IDS],
  properties: {
    summary: { type: "string" },
    dimensions: {
      type: "object",
      additionalProperties: false,
      required: RUBRIC_DIMENSIONS.map((d) => d.id),
      properties: Object.fromEntries(
        RUBRIC_DIMENSIONS.map((d) => [
          d.id,
          {
            type: "object",
            additionalProperties: false,
            required: ["rating", "evidence"],
            properties: {
              rating: { anyOf: [{ type: "integer", enum: RATINGS }, { type: "null" }] },
              evidence: { type: "string" },
            },
          },
        ]),
      ),
    },
    ...Object.fromEntries(LIST_IDS.map((id) => [id, { type: "array", items: { type: "string" } }])),
  },
};

// Returns the feedback if it has everything the spec requires, or null.
// Trims whitespace, and cuts lists that run long rather than failing them.
export function parseFeedback(value: unknown): Feedback | null {
  if (!isObject(value) || !isObject(value.dimensions)) return null;
  const summary = text(value.summary);
  if (!summary) return null;

  const lists = {} as Record<FeedbackListId, string[]>;
  for (const id of LIST_IDS) {
    const items = list(value[id], FEEDBACK_LISTS[id]);
    if (!items) return null;
    lists[id] = items;
  }

  const dimensions = {} as Record<DimensionId, DimensionFeedback>;
  for (const { id } of RUBRIC_DIMENSIONS) {
    const entry = value.dimensions[id];
    if (!isObject(entry)) return null;
    const evidence = text(entry.evidence);
    if (!evidence || !(entry.rating === null || isRating(entry.rating))) return null;
    dimensions[id] = { rating: entry.rating, evidence };
  }
  return { summary, dimensions, ...lists };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRating(value: unknown): value is Rating {
  return RATINGS.includes(value as Rating);
}

// Trimmed text, or null if it's missing or blank. Never returns an empty string, so a blank
// field fails the whole parse instead of reaching the screen.
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Null unless there are at least `min` items, all non-blank; keeps the first `max`.
function list(value: unknown, { min, max }: { min: number; max: number }): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(text);
  if (items.length < min || items.some((item) => item === null)) return null;
  return (items as string[]).slice(0, max);
}
