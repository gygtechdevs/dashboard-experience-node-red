'use server';

import { canReviewUnmatched } from '@/lib/auth/jwt';
import { getSession } from '@/lib/auth/session';
import { GatewayError } from '@/lib/gateway/client';
import {
  UNMATCHED_STATUSES,
  type ApproveUnmatchedResult,
  type BulkReviewResult,
  type ImpactSimulation,
  type UnmatchedPage,
  type UnmatchedStatus,
} from '@/lib/gateway/schemas';
import { withGateway } from '@/lib/gateway/server';
import {
  ADMIN_REQUIRED_MESSAGE,
  describeReviewError,
  type ReviewOperation,
} from '@/lib/review/messages';

/** `stale`: the item is gone or already reviewed (404/409); the client drops it and refreshes. */
export type ReviewActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'forbidden' | 'stale' | 'error'; message: string };

// No revalidatePath on purpose: the client keeps the approval result (embedded or not) visible,
// and a stale 404/409 triggers an explicit router.refresh().
const PAGE_SIZE = 50;

/**
 * UI-level guard only: the JWT payload is decoded, not verified. The gateway
 * and intents-service re-check ADMIN on every call and their 403 is surfaced below.
 */
async function isAdmin(): Promise<boolean> {
  return canReviewUnmatched(await getSession());
}

function failure(
  error: unknown,
  operation: ReviewOperation
): ReviewActionResult<never> {
  const kind =
    error instanceof GatewayError
      ? error.kind === 'forbidden'
        ? 'forbidden'
        : error.kind === 'not_found' || error.kind === 'conflict'
          ? 'stale'
          : 'error'
      : 'error';
  return { ok: false, kind, message: describeReviewError(error, operation) };
}

const FORBIDDEN: ReviewActionResult<never> = {
  ok: false,
  kind: 'forbidden',
  message: ADMIN_REQUIRED_MESSAGE,
};

export async function approveUnmatchedAction(
  id: string,
  intent: string
): Promise<ReviewActionResult<ApproveUnmatchedResult>> {
  if (!(await isAdmin())) return FORBIDDEN;
  if (typeof id !== 'string' || id === '' || typeof intent !== 'string' || intent.trim() === '') {
    return { ok: false, kind: 'error', message: 'Elija la intención en la que se aprobará este mensaje.' };
  }
  try {
    const data = await withGateway((client) =>
      client.approveUnmatched(id, intent.trim())
    );
    return { ok: true, data };
  } catch (error) {
    return failure(error, 'approve');
  }
}

export async function rejectUnmatchedAction(
  id: string
): Promise<ReviewActionResult<undefined>> {
  if (!(await isAdmin())) return FORBIDDEN;
  if (typeof id !== 'string' || id === '') {
    return { ok: false, kind: 'error', message: 'Falta el identificador del mensaje.' };
  }
  try {
    await withGateway((client) => client.rejectUnmatched(id));
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, 'reject');
  }
}

const MAX_BULK = 200;

function validIds(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_BULK &&
    ids.every((id) => typeof id === 'string' && id !== '')
  );
}

const INVALID_SELECTION: ReviewActionResult<never> = {
  ok: false,
  kind: 'error',
  message: `Seleccione entre 1 y ${MAX_BULK} mensajes.`,
};

/** Dry run: nothing is written. The result is an estimate (see ImpactSimulation.scope). */
export async function simulateImpactAction(
  intent: string,
  ids: string[]
): Promise<ReviewActionResult<ImpactSimulation>> {
  if (!(await isAdmin())) return FORBIDDEN;
  if (typeof intent !== 'string' || intent.trim() === '') {
    return { ok: false, kind: 'error', message: 'Elija una intención para simular.' };
  }
  if (!validIds(ids)) return INVALID_SELECTION;
  try {
    const data = await withGateway((client) =>
      client.simulateClusterImpact({ intent: intent.trim(), ids })
    );
    return { ok: true, data };
  } catch (error) {
    return failure(error, 'simulate');
  }
}

/** Partial failures come back as per-item results, not as an error. */
export async function bulkApproveUnmatchedAction(
  intent: string,
  ids: string[]
): Promise<ReviewActionResult<BulkReviewResult>> {
  if (!(await isAdmin())) return FORBIDDEN;
  if (typeof intent !== 'string' || intent.trim() === '') {
    return { ok: false, kind: 'error', message: 'Elija la intención en la que se aprobarán estos mensajes.' };
  }
  if (!validIds(ids)) return INVALID_SELECTION;
  try {
    const data = await withGateway((client) =>
      client.bulkApproveUnmatched({ intent: intent.trim(), ids })
    );
    return { ok: true, data };
  } catch (error) {
    return failure(error, 'bulk-approve');
  }
}

export async function bulkRejectUnmatchedAction(
  ids: string[]
): Promise<ReviewActionResult<BulkReviewResult>> {
  if (!(await isAdmin())) return FORBIDDEN;
  if (!validIds(ids)) return INVALID_SELECTION;
  try {
    const data = await withGateway((client) => client.bulkRejectUnmatched({ ids }));
    return { ok: true, data };
  } catch (error) {
    return failure(error, 'bulk-reject');
  }
}

export async function loadMoreUnmatchedAction(
  status: UnmatchedStatus,
  cursor: string
): Promise<ReviewActionResult<UnmatchedPage>> {
  if (!(await isAdmin())) return FORBIDDEN;
  if (!UNMATCHED_STATUSES.includes(status) || typeof cursor !== 'string' || cursor === '') {
    return { ok: false, kind: 'error', message: 'Solicitud de página no válida.' };
  }
  try {
    const data = await withGateway((client) =>
      client.listUnmatched({ status, limit: PAGE_SIZE, cursor })
    );
    return { ok: true, data };
  } catch (error) {
    return failure(error, 'list');
  }
}
