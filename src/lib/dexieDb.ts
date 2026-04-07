import Dexie, { type Table } from 'dexie';

// ============================
// Sync Queue (existing concept, enhanced)
// ============================
export interface SyncOperation {
  id?: number;
  operationId: string; // Client-generated UUID for idempotency/dedup
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC' | 'UPLOAD';
  payload: any;
  timestamp: string;
  status: 'PENDING' | 'PROCESSING' | 'ERROR' | 'DONE';
  retryCount: number;
  errorMessage?: string;
  matchKey?: Record<string, any>;
  // For UPLOAD actions
  attachmentId?: string; // FK to pendingAttachments
}

// ============================
// Local cache: contas_pagar
// ============================
export interface LocalConta {
  id: string; // Same UUID used for Supabase (client-generated)
  descricao: string;
  categoria: string | null;
  valor: number;
  data_vencimento: string;
  status: string;
  recorrente: boolean | null;
  criado_por: string | null;
  fornecedor_nome_livre: string | null;
  motivo: string;
  chave_pix: string | null;
  comprovante_url: string | null;
  observacoes: string | null;
  dia_vencimento_recorrente: number | null;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  aprovado_por: string | null;
  pago_por: string | null;
  criado_em: string;
  atualizado_em: string;
  // Offline metadata
  _syncStatus: 'synced' | 'pending' | 'error';
  _monthKey: string; // 'YYYY-MM' for indexing
  _lastFetched?: string; // ISO timestamp of last server fetch for this record
}

// ============================
// Local cache: usuarios (minimal)
// ============================
export interface LocalUsuario {
  id: string;
  nome: string;
  tipo: string;
  auth_user_id: string;
}

// ============================
// Pending attachments (Blob storage)
// ============================
export interface PendingAttachment {
  id: string; // UUID
  contaId: string; // FK to local conta
  blob: Blob;
  fileName: string;
  mimeType: string;
  purpose: 'boleto' | 'comprovante';
  createdAt: string;
  uploaded: boolean;
  remotePath?: string; // After upload
  remoteUrl?: string;
}

// ============================
// Metadata for sync tracking
// ============================
export interface SyncMeta {
  key: string; // e.g., 'contas_2025-04' or 'last_full_sync'
  value: string;
  updatedAt: string;
}

export class OfflineSyncDB extends Dexie {
  syncQueue!: Table<SyncOperation, number>;
  contas!: Table<LocalConta, string>;
  usuarios!: Table<LocalUsuario, string>;
  attachments!: Table<PendingAttachment, string>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super('sarelliOfflineDatabase');
    
    // Version 1: original syncQueue
    this.version(1).stores({
      syncQueue: '++id, table, action, status, timestamp'
    });

    // Version 2: full offline-first schema
    this.version(2).stores({
      syncQueue: '++id, operationId, table, action, status, timestamp',
      contas: 'id, _monthKey, _syncStatus, criado_por, status, data_vencimento',
      usuarios: 'id, auth_user_id',
      attachments: 'id, contaId, uploaded',
      syncMeta: 'key'
    }).upgrade(tx => {
      // Migrate existing syncQueue entries to have operationId
      return tx.table('syncQueue').toCollection().modify(op => {
        if (!op.operationId) {
          op.operationId = crypto.randomUUID();
        }
        if (op.status === 'PENDING' || op.status === 'ERROR') {
          // Keep as-is
        } else if (op.status === 'DONE') {
          // Will be cleaned up
        }
      });
    });
  }
}

export const db = new OfflineSyncDB();
