'use server';

import { canDeleteIntents, canWriteIntents } from '@/lib/auth/jwt';
import { getSession } from '@/lib/auth/session';
import { GatewayError } from '@/lib/gateway/client';
import { describeGatewayError, withGateway } from '@/lib/gateway/server';
import {
  ImportInputError,
  runImport,
  type ImportRowResult,
} from '@/lib/intents/import-run';
import {
  intentFormSchema,
  zodFieldErrors,
  type FieldErrors,
} from '@/lib/intents/schema';
import { revalidatePath } from 'next/cache';

type Failure = { ok: false; message: string; fieldErrors?: FieldErrors };
export type ActionResult = { ok: true } | Failure;
export type ImportActionResult =
  | { ok: true; results: ImportRowResult[] }
  | Failure;

const PAGE_PATH = '/knowledge/custom';
const FORBIDDEN: Failure = {
  ok: false,
  message: 'No tiene permiso para realizar esta acción.',
};

/**
 * UI-level guard only: the JWT payload is decoded, not verified. The gateway
 * re-checks permissions on every call and its 403 is surfaced below.
 */
async function allowed(check: typeof canWriteIntents): Promise<boolean> {
  return check(await getSession());
}

function failure(error: unknown): Failure {
  const fieldErrors = error instanceof GatewayError ? error.fieldErrors : {};
  return {
    ok: false,
    message: describeGatewayError(error),
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
  };
}

export async function createIntentAction(
  input: unknown
): Promise<ActionResult> {
  if (!(await allowed(canWriteIntents))) return FORBIDDEN;

  const parsed = intentFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Corrija los campos resaltados.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await withGateway((client) => client.createIntent(parsed.data));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PAGE_PATH);
  return { ok: true };
}

export async function updateIntentAction(
  name: string,
  input: unknown
): Promise<ActionResult> {
  if (!(await allowed(canWriteIntents))) return FORBIDDEN;

  const parsed = intentFormSchema.safeParse({
    ...(input as object),
    intent: name,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Corrija los campos resaltados.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const { initialStep, keywords, tags, description } = parsed.data;
  const changes = {
    initialStep,
    keywords,
    tags,
    ...(description ? { description } : {}),
  };
  try {
    await withGateway((client) => client.updateIntent(name, changes));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PAGE_PATH);
  return { ok: true };
}

/**
 * Creates the given rows sequentially through the existing create endpoint and
 * reports a result per row. The client sends them in small batches.
 */
export async function importIntentsAction(
  rows: unknown
): Promise<ImportActionResult> {
  if (!(await allowed(canWriteIntents))) return FORBIDDEN;

  let results: ImportRowResult[];
  try {
    results = await withGateway((client) =>
      runImport(client, rows, { describeError: describeGatewayError })
    );
    console.log('results', results);
  } catch (error) {
    if (error instanceof GatewayError) return failure(error);
    if (error instanceof ImportInputError)
      return { ok: false, message: error.message };
    throw error;
  }
  if (results.some((result) => result.status === 'created'))
    revalidatePath(PAGE_PATH);
  return { ok: true, results };
}

export async function deleteIntentAction(name: string): Promise<ActionResult> {
  if (!(await allowed(canDeleteIntents))) return FORBIDDEN;

  try {
    await withGateway((client) => client.deleteIntent(name));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PAGE_PATH);
  return { ok: true };
}
