import type { Permission } from "@/lib/auth/jwt";

export type AccessLevel = "read" | "write" | "admin";

export const ACCESS_LEVELS: readonly AccessLevel[] = ["read", "write", "admin"];

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  read: "Lectura",
  write: "Lectura y escritura",
  admin: "Administrador",
};

const PERMISSIONS: Record<AccessLevel, Permission[]> = {
  read: ["READ"],
  write: ["READ", "WRITE"],
  admin: ["READ", "WRITE", "ADMIN"],
};

export function permissionsForLevel(level: AccessLevel): Permission[] {
  return [...PERMISSIONS[level]];
}

/** The highest permission wins (ADMIN > WRITE > READ); anything else is read-only. */
export function levelFromPermissions(permissions: readonly string[]): AccessLevel {
  if (permissions.includes("ADMIN")) return "admin";
  if (permissions.includes("WRITE")) return "write";
  return "read";
}
