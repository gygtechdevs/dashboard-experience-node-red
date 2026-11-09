import { describe, expect, it } from "vitest";
import { GatewayError } from "@/lib/gateway/client";
import { describeReviewError, isCaptureDisabled } from "./messages";

const err = (kind: ConstructorParameters<typeof GatewayError>[0], status: number) => new GatewayError(kind, status, "x");

describe("describeReviewError", () => {
  it("explains 403 as ADMIN required", () => {
    expect(describeReviewError(err("forbidden", 403), "approve")).toMatch(/Se requiere permiso ADMIN/);
  });

  it("explains a missing list endpoint as capture disabled with the env var", () => {
    const message = describeReviewError(err("not_found", 404), "list");
    expect(message).toMatch(/La captura de mensajes no reconocidos está deshabilitada/);
    expect(message).toMatch(/UNMATCHED_CAPTURE_ENABLED=true/);
  });

  it("explains 404 on an action as an unknown message", () => {
    expect(describeReviewError(err("not_found", 404), "reject")).toMatch(/ya no existe/);
  });

  it("explains 409 as already reviewed", () => {
    expect(describeReviewError(err("conflict", 409), "approve")).toMatch(/ya fue revisado/);
  });

  it("explains approve 503 as semantic matching disabled, but not reject 503", () => {
    expect(describeReviewError(err("unavailable", 503), "approve")).toMatch(/coincidencia semántica está deshabilitada/i);
    expect(describeReviewError(err("unavailable", 503), "reject")).toMatch(/no está disponible/i);
  });

  it("treats clusters like the list: a 404 means capture is disabled", () => {
    expect(describeReviewError(err("not_found", 404), "clusters")).toMatch(/UNMATCHED_CAPTURE_ENABLED=true/);
  });

  it("explains simulate 503 as needing semantic matching and a vectorization service", () => {
    const message = describeReviewError(err("unavailable", 503), "simulate");
    expect(message).toMatch(/coincidencia semántica/i);
    expect(message).toMatch(/vectorización/i);
  });

  it("explains simulate 404 as an intent or messages that no longer exist", () => {
    expect(describeReviewError(err("not_found", 404), "simulate")).toMatch(/ya no existen/);
  });

  it("explains bulk approve 503 as semantic matching disabled", () => {
    expect(describeReviewError(err("unavailable", 503), "bulk-approve")).toMatch(/coincidencia semántica está deshabilitada/i);
  });

  it("falls back for unknown errors", () => {
    expect(describeReviewError(new Error("boom"), "list")).toMatch(/Algo salió mal/);
  });
});

describe("isCaptureDisabled", () => {
  it("is true only for a 404 gateway error", () => {
    expect(isCaptureDisabled(err("not_found", 404))).toBe(true);
    expect(isCaptureDisabled(err("forbidden", 403))).toBe(false);
    expect(isCaptureDisabled(new Error("x"))).toBe(false);
  });
});
