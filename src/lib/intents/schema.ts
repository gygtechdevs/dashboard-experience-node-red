import { z } from "zod";

/**
 * Mirrors the rules enforced by intents-service (the gateway forwards them):
 * - name: 1-120 chars, letters, numbers, spaces, "_" and "-"
 * - initialStep: required
 * - keywords: at least one non-empty keyword on create
 * - tags: optional, up to 10, each 1-40 chars (letters, numbers, spaces, "_" and "-"),
 *   de-duplicated case-insensitively
 */
export const MAX_INTENT_NAME_LENGTH = 120;
const INTENT_NAME_PATTERN = /^[a-zA-Z0-9 _-]+$/;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 40;
const TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;

export function normalizeKeyword(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function cleanKeywords(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const keyword = normalizeKeyword(item);
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
  }
  return result;
}

/** Adds the comma-separated keywords in `input` to `current`, skipping blanks and duplicates. */
export function addKeywords(current: string[], input: string): string[] {
  const merged = cleanKeywords([...current, ...input.split(",")]);
  return merged.length === current.length ? current : merged;
}

const TAG_RULES = `Cada etiqueta: de 1 a ${MAX_TAG_LENGTH} caracteres; letras, números, espacios, "_" y "-"`;

const tagsSchema = z
  .array(z.string())
  .transform(cleanKeywords)
  .superRefine((tags, ctx) => {
    if (tags.some((tag) => tag.length > MAX_TAG_LENGTH || !TAG_PATTERN.test(tag))) {
      ctx.addIssue({ code: "custom", message: TAG_RULES });
    }
    if (tags.length > MAX_TAGS) {
      ctx.addIssue({ code: "custom", message: `Use como máximo ${MAX_TAGS} etiquetas` });
    }
  });

export const intentNameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio")
  .max(MAX_INTENT_NAME_LENGTH, `El nombre debe tener como máximo ${MAX_INTENT_NAME_LENGTH} caracteres`)
  .regex(INTENT_NAME_PATTERN, 'Use solo letras, números, espacios, "_" y "-"');

const initialStepSchema = z.string().trim().min(1, "Seleccione el paso que inicia esta intención");

const keywordsSchema = z
  .array(z.string())
  .transform(cleanKeywords)
  .pipe(z.array(z.string()).min(1, "Agregue al menos una palabra clave"));

export const intentFormSchema = z
  .object({
    intent: intentNameSchema,
    initialStep: initialStepSchema,
    keywords: keywordsSchema,
    tags: tagsSchema.default([]),
    description: z.string().trim().optional(),
  })
  .transform(
    ({
      description,
      ...rest
    }): { intent: string; initialStep: string; keywords: string[]; tags: string[]; description?: string } =>
      description ? { ...rest, description } : rest,
  );

export type IntentFormValues = z.output<typeof intentFormSchema>;

export type FieldErrors = Partial<Record<"intent" | "initialStep" | "keywords" | "tags" | "description", string>>;

/** First message per field, ready to render under each input. */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in result)) {
      result[field as keyof FieldErrors] = issue.message;
    }
  }
  return result;
}
