import { useEffect, useRef } from 'react';
import { db } from '@/lib/dexieDb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { markAttachmentUploaded, getAttachment } from '@/lib/offlineStore';

const MAX_RETRIES = 10;
const BASE_DELAY = 2000; // 2 seconds
const MAX_DELAY = 5 * 60 * 1000; // 5 minutes

function getBackoffDelay(retryCount: number): number {
  const delay = Math.min(BASE_DELAY * Math.pow(2, retryCount), MAX_DELAY);
  // Add jitter (±25%)
  return delay * (0.75 + Math.random() * 0.5);
}

export function useOfflineSync() {
  const syncingRef = useRef(false);

  useEffect(() => {
    const processSyncQueue = async () => {
      if (!navigator.onLine || syncingRef.current) return;
      syncingRef.current = true;

      try {
        // Get PENDING and retryable ERROR operations (ordered by timestamp)
        const operations = await db.syncQueue
          .where('status')
          .anyOf(['PENDING', 'ERROR'])
          .and(op => op.retryCount < MAX_RETRIES)
          .sortBy('timestamp');

        if (operations.length === 0) {
          syncingRef.current = false;
          return;
        }

        console.log(`📡 [SYNC] Processing ${operations.length} operations...`);
        const syncStart = performance.now();
        let successCount = 0;
        let errorCount = 0;

        for (const op of operations) {
          if (!navigator.onLine) break; // Stop if we go offline mid-sync

          // Check if ERROR op needs backoff delay
          if (op.status === 'ERROR' && op.retryCount > 0) {
            const lastAttemptTime = new Date(op.timestamp).getTime();
            const delay = getBackoffDelay(op.retryCount);
            if (Date.now() - lastAttemptTime < delay) continue; // Skip, not ready yet
          }

          // Mark as PROCESSING to prevent concurrent execution
          await db.syncQueue.update(op.id!, { status: 'PROCESSING' });

          try {
            let error = null;

            switch (op.action) {
              case 'INSERT': {
                // Idempotent: use the client-generated ID in payload
                const res = await supabase.from(op.table as any).upsert(op.payload, { onConflict: 'id' });
                error = res.error;
                break;
              }
              case 'UPDATE': {
                if (!op.matchKey) throw new Error('MatchKey missing in UPDATE');
                const res = await supabase.from(op.table as any).update(op.payload).match(op.matchKey);
                error = res.error;
                break;
              }
              case 'DELETE': {
                if (!op.matchKey) throw new Error('MatchKey missing in DELETE');
                const res = await supabase.from(op.table as any).delete().match(op.matchKey);
                error = res.error;
                break;
              }
              case 'RPC': {
                const res = await supabase.rpc(op.table as any, op.payload);
                error = res.error;
                break;
              }
              case 'UPLOAD': {
                if (!op.attachmentId) throw new Error('Missing attachmentId');
                const attachment = await getAttachment(op.attachmentId);
                if (!attachment) throw new Error('Attachment not found in IndexedDB');
                
                const path = op.payload.path as string;
                const { error: upErr } = await supabase.storage
                  .from(op.payload.bucket as string)
                  .upload(path, attachment.blob, { upsert: true });
                
                if (upErr) throw upErr;
                
                const { data: urlData } = supabase.storage
                  .from(op.payload.bucket as string)
                  .getPublicUrl(path);
                
                // Update the conta record with the remote URL
                if (op.payload.contaId && op.payload.field) {
                  await supabase
                    .from('contas_pagar')
                    .update({ [op.payload.field]: urlData.publicUrl })
                    .eq('id', op.payload.contaId);
                  
                  // Update local cache too
                  const localConta = await db.contas.get(op.payload.contaId);
                  if (localConta) {
                    await db.contas.update(op.payload.contaId, {
                      [op.payload.field]: urlData.publicUrl,
                    });
                  }
                }
                
                await markAttachmentUploaded(op.attachmentId, path, urlData.publicUrl);
                error = null;
                break;
              }
            }

            if (error) throw error;

            // Success: remove from queue
            await db.syncQueue.delete(op.id!);

            // If this was a conta INSERT, mark local conta as synced
            if (op.action === 'INSERT' && op.table === 'contas_pagar' && op.payload?.id) {
              await db.contas.update(op.payload.id, { _syncStatus: 'synced' });
            }

            successCount++;
          } catch (err: any) {
            console.error(`[SYNC] Op ${op.operationId} failed:`, err?.message || err);
            errorCount++;
            await db.syncQueue.update(op.id!, {
              status: 'ERROR',
              errorMessage: err?.message || String(err),
              retryCount: (op.retryCount || 0) + 1,
              timestamp: new Date().toISOString(), // Reset for backoff calc
            });
          }
        }

        const duration = Math.round(performance.now() - syncStart);
        console.log(`[SYNC] Done in ${duration}ms: ${successCount} ok, ${errorCount} errors`);

        if (successCount > 0) {
          toast.success(`${successCount} registro${successCount > 1 ? 's' : ''} sincronizado${successCount > 1 ? 's' : ''}!`, {
            id: 'sync-status',
            duration: 3000,
          });
        }
        if (errorCount > 0 && successCount === 0) {
          toast.error(`Falha ao sincronizar ${errorCount} registro${errorCount > 1 ? 's' : ''}`, {
            id: 'sync-status',
            duration: 5000,
          });
        }

        // Clean up old DONE entries (belt-and-suspenders)
        await db.syncQueue.where('status').equals('DONE').delete();

      } finally {
        syncingRef.current = false;
      }
    };

    // Run on online event
    window.addEventListener('online', processSyncQueue);

    // Run on mount if online
    if (navigator.onLine) {
      processSyncQueue();
    }

    // Log queue state on mount
    db.syncQueue.count().then(total => {
      if (total > 0) {
        db.syncQueue.where('status').anyOf(['PENDING', 'ERROR']).count().then(pending => {
          console.log(`[SYNC] Queue: ${total} total, ${pending} pending/error`);
        });
      }
    });

    // Periodic sync every 2 minutes (reduced from 5 for better UX)
    const interval = setInterval(() => {
      if (navigator.onLine) processSyncQueue();
    }, 2 * 60 * 1000);

    return () => {
      window.removeEventListener('online', processSyncQueue);
      clearInterval(interval);
    };
  }, []);
}
