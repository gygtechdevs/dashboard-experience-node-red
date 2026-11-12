import { describe, expect, it } from "vitest";
import { ACCESS_LABELS, ACCESS_LEVELS, levelFromPermissions, permissionsForLevel } from "./access";

describe("permissionsForLevel", () => {
  it("expands each level to its cumulative permissions", () => {
    expect(permissionsForLevel("read")).toEqual(["READ"]);
    expect(permissionsForLevel("write")).toEqual(["READ", "WRITE"]);
    expect(permissionsForLevel("admin")).toEqual(["READ", "WRITE", "ADMIN"]);
  });
});

describe("levelFromPermissions", () => {
  it("picks the highest permission", () => {
    expect(levelFromPermissions(["READ"])).toBe("read");
    expect(levelFromPermissions(["WRITE", "READ"])).toBe("write");
    expect(levelFromPermissions(["READ", "ADMIN"])).toBe("admin");
  });

  it("falls back to read when empty or unknown", () => {
    expect(levelFromPermissions([])).toBe("read");
    expect(levelFromPermissions(["OTHER"])).toBe("read");
  });
});

describe("labels", () => {
  it("has a Spanish label per level", () => {
    expect(ACCESS_LEVELS).toEqual(["read", "write", "admin"]);
    expect(ACCESS_LABELS).toEqual({ read: "Lectura", write: "Lectura y escritura", admin: "Administrador" });
  });
});
