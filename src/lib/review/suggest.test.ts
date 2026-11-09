import { describe, expect, it } from "vitest";
import { intentNameSchema } from "@/lib/intents/schema";
import type { UnmatchedCluster } from "@/lib/gateway/schemas";
import { suggestIntentFromCluster } from "./suggest";

const cluster = (members: Array<[string, number]>): UnmatchedCluster => ({
  id: "c1",
  representativeText: members[0]?.[0] ?? "",
  size: members.reduce((sum, [, n]) => sum + n, 0),
  memberIds: members.map((_, i) => `m${i}`),
  members: members.map(([maskedText, occurrences], i) => ({ id: `m${i}`, maskedText, occurrences })),
  nearestIntent: null,
  firstSeenAt: "2026-03-01T00:00:00.000Z",
  lastSeenAt: "2026-03-02T00:00:00.000Z",
});

describe("suggestIntentFromCluster", () => {
  it("builds a snake_case name from the most frequent meaningful words, weighted by occurrences", () => {
    const suggestion = suggestIntentFromCluster(
      cluster([
        ["i want to reset my password", 5],
        ["how do i reset the password", 2],
        ["forgot my login", 1],
      ]),
    );
    expect(suggestion.name).toBe("reset_password");
    expect(intentNameSchema.safeParse(suggestion.name).success).toBe(true);
  });

  it("suggests the representative texts as keywords, lowercased, de-duplicated and without PII placeholders", () => {
    const suggestion = suggestIntentFromCluster(
      cluster([
        ["Reset my password for [EMAIL]", 5],
        ["reset my password for", 2],
        ["forgot my login", 1],
      ]),
    );
    expect(suggestion.keywords).toEqual(["reset my password for", "forgot my login"]);
  });

  it("limits keywords to 3 of at most 60 characters", () => {
    const long = "word ".repeat(30).trim();
    const suggestion = suggestIntentFromCluster(
      cluster([
        ["alpha one", 4],
        ["beta two", 3],
        ["gamma three", 2],
        ["delta four", 1],
        [long, 1],
      ]),
    );
    expect(suggestion.keywords).toEqual(["alpha one", "beta two", "gamma three"]);
    expect(suggestIntentFromCluster(cluster([[long, 1]])).keywords[0]?.length).toBeLessThanOrEqual(60);
  });

  it("falls back to a generic name when there are no usable words", () => {
    const suggestion = suggestIntentFromCluster(cluster([["[EMAIL] ?? !!", 1]]));
    expect(suggestion.name).toBe("nueva_intencion");
    expect(suggestion.keywords).toEqual([]);
  });

  it("strips accents and keeps the name valid for the intent schema", () => {
    const suggestion = suggestIntentFromCluster(cluster([["cambiar contraseña urgente", 3]]));
    expect(intentNameSchema.safeParse(suggestion.name).success).toBe(true);
    expect(suggestion.name).toMatch(/^[a-z0-9_]+$/);
  });

  it("describes the origin of the intent in Spanish", () => {
    const suggestion = suggestIntentFromCluster(cluster([["reset my password", 5], ["forgot login", 1]]));
    expect(suggestion.description).toBe('Creada a partir de 2 mensajes similares no reconocidos, por ejemplo: "reset my password".');
  });
});
