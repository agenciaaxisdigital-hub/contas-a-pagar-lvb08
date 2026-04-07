/**
 * Offline queue manager: enqueues operations for later sync.
 * Uses client-generated operationId for idempotency.
 */
import { db, type SyncOperation } from './dexieDb';
import { toast } from 'sonner';

interface EnqueueOptions {
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC' | 'UPLOAD';
  table: string;
  payload: any;
  matchKey?: Record<string, any>;
  operationId?: string; // If not provided, one is generated
  attachmentId?: string;
}

/**
 * Enqueue an operation in the offline sync queue.
 * Deduplicates by operationId: if the same operationId is already PENDING, skip.
 */
export async function enqueueOperation(options: EnqueueOptions): Promise<void> {
  const opId = options.operationId || crypto.randomUUID();

  // Dedup check: don't enqueue if same operationId already pending
  const existing = await db.syncQueue
    .where('operationId')
    .equals(opId)
    .and(op => op.status === 'PENDING' || op.status === 'PROCESSING')
    .first();

  if (existing) {
    console.log(`[SYNC] Dedup: operationId ${opId} already in queue, skipping`);
    return;
  }

  await db.syncQueue.add({
    operationId: opId,
    table: options.table,
    action: options.action,
    payload: options.payload,
    matchKey: options.matchKey,
    timestamp: new Date().toISOString(),
    status: 'PENDING',
    retryCount: 0,
    attachmentId: options.attachmentId,
  });
}

/**
 * Try to execute an operation online. If offline or fails, enqueue it.
 * Returns immediately with local-first response.
 */
export async function execOnlineOrEnqueue(
  operation: () => Promise<any>,
  fallback: EnqueueOptions & { onSuccess?: () => void; onError?: (err: any) => void }
): Promise<any> {
  if (navigator.onLine) {
    try {
      const response = await operation();
      if (response && response.error) throw response.error;
      fallback.onSuccess?.();
      return response;
    } catch (error) {
      console.warn('⚠️ Online operation failed, enqueuing...', error);
    }
  }

  // Enqueue for later sync
  await enqueueOperation(fallback);
  toast.success('Salvo localmente! Será sincronizado ao reconectar.', { duration: 3000 });
  fallback.onSuccess?.();
  return { data: fallback.payload, error: null, _offline: true };
}

/**
 * Get count of pending operations
 */
export async function getPendingCount(): Promise<number> {
  return db.syncQueue.where('status').anyOf(['PENDING', 'ERROR']).count();
}
