/**
 * Offline Store: manages local cache for contas_pagar and usuarios.
 * Provides read/write operations that work entirely from IndexedDB.
 */
import { db, type LocalConta, type LocalUsuario, type PendingAttachment } from './dexieDb';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';

// ============================
// Month key helper
// ============================
export function getMonthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

// ============================
// CONTAS: Fetch & Cache
// ============================

/** Fetch contas for a month from Supabase and cache locally */
export async function fetchAndCacheContas(month: Date, empresaId: string): Promise<LocalConta[]> {
  const inicio = format(startOfMonth(month), 'yyyy-MM-dd');
  const fim = format(endOfMonth(month), 'yyyy-MM-dd');
  const monthKey = getMonthKey(month);

  const { data, error } = await supabase
    .from('contas_pagar')
    .select('*')
    .gte('data_vencimento', inicio)
    .lte('data_vencimento', fim)
    .eq('empresa_id', empresaId)
    .order('data_vencimento', { ascending: true });

  if (error) throw error;
  if (!data) return [];

  const now = new Date().toISOString();
  const localContas: LocalConta[] = data.map((c: any) => ({
    id: c.id,
    descricao: c.descricao,
    categoria: c.categoria,
    valor: Number(c.valor),
    data_vencimento: c.data_vencimento,
    status: c.status,
    recorrente: c.recorrente,
    criado_por: c.criado_por,
    fornecedor_nome_livre: c.fornecedor_nome_livre,
    motivo: c.motivo || '',
    chave_pix: c.chave_pix,
    comprovante_url: c.comprovante_url,
    observacoes: c.observacoes,
    dia_vencimento_recorrente: c.dia_vencimento_recorrente,
    data_pagamento: c.data_pagamento,
    forma_pagamento: c.forma_pagamento,
    aprovado_por: c.aprovado_por,
    pago_por: c.pago_por,
    criado_em: c.criado_em,
    atualizado_em: c.atualizado_em,
    empresa_id: c.empresa_id ?? null,
    _syncStatus: 'synced' as const,
    _monthKey: monthKey,
    _lastFetched: now,
  }));

  // Merge: keep pending local contas, update synced ones
  await db.transaction('rw', db.contas, async () => {
    // Get existing pending contas for this month
    const existingPending = await db.contas
      .where('_monthKey').equals(monthKey)
      .and(c => c._syncStatus !== 'synced')
      .toArray();

    const pendingIds = new Set(existingPending.map(c => c.id));

    // Remove only synced contas for this month (pending ones stay)
    await db.contas
      .where('_monthKey').equals(monthKey)
      .and(c => c._syncStatus === 'synced')
      .delete();

    // Insert server contas that don't conflict with pending ones
    const toInsert = localContas.filter(c => !pendingIds.has(c.id));
    await db.contas.bulkPut(toInsert);
  });

  // Update sync meta
  await db.syncMeta.put({
    key: `contas_${monthKey}`,
    value: 'fetched',
    updatedAt: now,
  });

  // Return merged list
  return db.contas.where('_monthKey').equals(monthKey).toArray();
}

/** Get contas from local cache only */
export async function getLocalContas(month: Date, empresaId?: string): Promise<LocalConta[]> {
  const monthKey = getMonthKey(month);
  const all = await db.contas.where('_monthKey').equals(monthKey).toArray();
  if (!empresaId) return all;
  return all.filter(c => c.empresa_id === empresaId);
}

/** Get a single conta from local cache */
export async function getLocalConta(id: string): Promise<LocalConta | undefined> {
  return db.contas.get(id);
}

/** Save a conta locally (for offline creation or update) */
export async function saveLocalConta(conta: LocalConta): Promise<void> {
  await db.contas.put(conta);
}

/** Check if we have cached data for a month */
export async function hasLocalData(month: Date): Promise<boolean> {
  const monthKey = getMonthKey(month);
  const count = await db.contas.where('_monthKey').equals(monthKey).count();
  return count > 0;
}

// ============================
// USUARIOS: Fetch & Cache
// ============================

export async function fetchAndCacheUsuarios(): Promise<LocalUsuario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, tipo, auth_user_id')
    .order('nome');

  if (error) throw error;
  if (!data) return [];

  const usuarios: LocalUsuario[] = data.map((u: any) => ({
    id: u.id,
    nome: u.nome,
    tipo: u.tipo,
    auth_user_id: u.auth_user_id,
  }));

  await db.usuarios.bulkPut(usuarios);
  return usuarios;
}

export async function getLocalUsuarios(): Promise<LocalUsuario[]> {
  return db.usuarios.toArray();
}

// ============================
// ATTACHMENTS
// ============================

export async function saveAttachment(attachment: PendingAttachment): Promise<void> {
  await db.attachments.put(attachment);
}

export async function getAttachment(id: string): Promise<PendingAttachment | undefined> {
  return db.attachments.get(id);
}

export async function getPendingAttachments(): Promise<PendingAttachment[]> {
  return db.attachments.where('uploaded').equals(0).toArray(); // Dexie stores false as 0
}

export async function markAttachmentUploaded(id: string, remotePath: string, remoteUrl: string): Promise<void> {
  await db.attachments.update(id, { uploaded: true, remotePath, remoteUrl });
}
