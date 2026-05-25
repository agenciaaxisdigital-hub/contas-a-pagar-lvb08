import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, HelpCircle, ImageIcon, Camera, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import AppLayout from '@/components/AppLayout';
import UserSelect from '@/components/UserSelect';
import { saveLocalConta, saveAttachment, getMonthKey } from '@/lib/offlineStore';
import { enqueueOperation } from '@/lib/offlineFallback';
import type { LocalConta, PendingAttachment } from '@/lib/dexieDb';

const MESES_RECORRENCIA = [
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: '24', label: '2 anos' },
  { value: '0', label: 'Sem data de fim (indeterminado)' },
];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const parseBRL = (s: string) =>
  parseFloat(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));

export default function NovaContaPage() {
  const { usuario } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Passo 1
  const [descricao, setDescricao] = useState('');
  const [valorRaw, setValorRaw] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [recorrente, setRecorrente] = useState(false);
  const [diaRecorrente, setDiaRecorrente] = useState('');
  const [mesesRecorrencia, setMesesRecorrencia] = useState('12');

  // Anexo do boleto/conta
  const [anexo, setAnexo] = useState<File | null>(null);
  const [anexoPreview, setAnexoPreview] = useState<string | null>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const inputCameraRef = useRef<HTMLInputElement>(null);

  // Passo 2
  const [motivo, setMotivo] = useState('');
  const [criadoPor, setCriadoPor] = useState('');

  const responsavel = criadoPor || usuario?.id || '';

  const handleAnexo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 10MB)');
      return;
    }
    setAnexo(file);
    if (file.type.startsWith('image/')) {
      setAnexoPreview(URL.createObjectURL(file));
    } else {
      setAnexoPreview(null);
    }
  };

  const removerAnexo = () => {
    setAnexo(null);
    setAnexoPreview(null);
    if (inputGaleriaRef.current) inputGaleriaRef.current.value = '';
    if (inputCameraRef.current) inputCameraRef.current.value = '';
  };

  const handleValor = (raw: string) => {
    const nums = raw.replace(/\D/g, '');
    if (!nums) { setValorRaw(''); return; }
    const cents = parseInt(nums, 10);
    const brl = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setValorRaw(brl);
  };

  const valorNum = parseBRL(valorRaw);

  const recorrenteAte = (() => {
    if (!recorrente || mesesRecorrencia === '0') return null;
    const base = dataVencimento ? new Date(dataVencimento + 'T00:00:00') : new Date();
    base.setMonth(base.getMonth() + parseInt(mesesRecorrencia));
    return format(base, 'yyyy-MM-dd');
  })();

  const goStep2 = () => {
    if (!descricao.trim()) return toast.error('Diga o que precisa ser pago');
    if (!valorRaw || isNaN(valorNum) || valorNum <= 0) return toast.error('Informe o valor corretamente');
    if (!dataVencimento) return toast.error('Informe quando vence');
    if (recorrente && !diaRecorrente) return toast.error('Informe o dia mensal do vencimento');
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!motivo.trim()) return toast.error('Explique o motivo do gasto');
    if (!usuario) return toast.error('Faça login primeiro');

    setLoading(true);

    // Generate client-side ID for idempotency
    const contaId = crypto.randomUUID();
    const now = new Date().toISOString();
    const contaOperationId = crypto.randomUUID();
    const logOperationId = crypto.randomUUID();

    const payload: Record<string, any> = {
      id: contaId,
      descricao: descricao.trim(),
      valor: valorNum,
      motivo: motivo.trim(),
      status: 'Lancada',
      criado_por: responsavel,
      data_vencimento: dataVencimento,
      recorrente,
      dia_vencimento_recorrente: recorrente && diaRecorrente ? parseInt(diaRecorrente) : null,
      chave_pix: chavePix.trim() || null,
      empresa_id: empresaAtiva?.id ?? null,
      criado_em: now,
      atualizado_em: now,
    };

    if (recorrente && recorrenteAte) {
      payload.observacoes = `recorrente_ate:${recorrenteAte}`;
    }

    // 1) Save locally first (always)
    const monthKey = getMonthKey(new Date(dataVencimento + 'T00:00:00'));
    const localConta: LocalConta = {
      id: contaId,
      descricao: payload.descricao,
      categoria: null,
      valor: valorNum,
      data_vencimento: dataVencimento,
      status: 'Lancada',
      recorrente: recorrente || null,
      criado_por: responsavel,
      fornecedor_nome_livre: null,
      motivo: payload.motivo,
      chave_pix: payload.chave_pix,
      comprovante_url: null,
      observacoes: payload.observacoes || null,
      dia_vencimento_recorrente: payload.dia_vencimento_recorrente,
      data_pagamento: null,
      forma_pagamento: null,
      aprovado_por: null,
      pago_por: null,
      criado_em: now,
      atualizado_em: now,
      _syncStatus: 'pending',
      _monthKey: monthKey,
    };

    await saveLocalConta(localConta);

    // 2) Handle attachment
    let attachmentId: string | undefined;
    if (anexo) {
      attachmentId = crypto.randomUUID();
      const att: PendingAttachment = {
        id: attachmentId,
        contaId,
        blob: anexo,
        fileName: anexo.name,
        mimeType: anexo.type,
        purpose: 'boleto',
        createdAt: now,
        uploaded: false,
      };
      await saveAttachment(att);
    }

    // 3) Try online, or enqueue
    if (navigator.onLine) {
      try {
        const { error } = await supabase
          .from('contas_pagar')
          .insert(payload as any);

        if (error) throw error;

        // Upload attachment online
        if (anexo) {
          const ext = anexo.name.split('.').pop() || 'jpg';
          const path = `${contaId}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('comprovantes')
            .upload(path, anexo, { upsert: true });
          if (!upErr) {
            const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(path);
            await supabase.from('contas_pagar').update({ comprovante_url: urlData.publicUrl }).eq('id', contaId);
            localConta.comprovante_url = urlData.publicUrl;
          }
        }

        // Insert log
        await supabase.from('contas_pagar_logs').insert({
          conta_id: contaId,
          usuario_id: responsavel,
          acao: 'CRIADA',
          status_anterior: null,
          status_novo: 'Lancada',
        });

        // Mark as synced
        localConta._syncStatus = 'synced';
        await saveLocalConta(localConta);

        toast.success('✓ Conta registrada com sucesso!');
      } catch (err) {
        console.warn('[NOVA] Online save failed, queuing:', err);
        // Enqueue for later
        await enqueueForSync(contaId, payload, responsavel, contaOperationId, logOperationId, attachmentId);
        toast.success('Conta salva localmente! Será sincronizada ao reconectar.');
      }
    } else {
      // Offline: enqueue everything
      await enqueueForSync(contaId, payload, responsavel, contaOperationId, logOperationId, attachmentId);
      toast.success('Conta salva localmente! Será sincronizada ao reconectar.');
    }

    navigate('/');
    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => step === 2 ? setStep(1) : navigate(-1)}
            className="text-muted-foreground active:scale-90 p-1"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="page-title">Nova conta</h2>
            <p className="page-subtitle">
              {step === 1 ? 'Passo 1 de 2 — Dados da conta' : 'Passo 2 de 2 — Justificativa'}
            </p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="flex gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-primary" />
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step === 2 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        {step === 1 ? (
          <>
            <div className="section-card space-y-4">

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="label-micro">O que precisa ser pago? *</label>
                <Input
                  placeholder="Ex.: Aluguel, material de escritório..."
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="form-input"
                  autoFocus
                />
              </div>

              {/* Valor + Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="label-micro">Valor (R$) *</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={valorRaw}
                    onChange={e => handleValor(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="label-micro">Vencimento *</label>
                  <Input
                    type="date"
                    value={dataVencimento}
                    onChange={e => setDataVencimento(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Chave PIX */}
              <div className="space-y-1.5">
                <label className="label-micro">Chave PIX (opcional)</label>
                <Input
                  placeholder="CPF, e-mail, telefone ou chave aleatória..."
                  value={chavePix}
                  onChange={e => setChavePix(e.target.value)}
                  className="form-input"
                  autoComplete="off"
                />
                <p className="text-[10px] text-muted-foreground">
                  Se souber agora, já deixa aqui para facilitar na hora do pagamento.
                </p>
              </div>

              {/* Anexo da conta/boleto */}
              <div className="space-y-1.5">
                <label className="label-micro">Foto ou PDF da conta (opcional)</label>
                <input
                  ref={inputGaleriaRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleAnexo}
                  className="hidden"
                />
                <input
                  ref={inputCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleAnexo}
                  className="hidden"
                />

                {anexo ? (
                  <div className="space-y-2">
                    {anexoPreview && (
                      <div className="relative rounded-xl overflow-hidden border border-border">
                        <img src={anexoPreview} alt="Preview" className="w-full max-h-40 object-cover" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200">
                      <span className="text-xs text-green-700 font-medium flex-1 truncate">
                        📎 {anexo.name}
                      </span>
                      <button onClick={removerAnexo} className="text-red-400 hover:text-red-600 active:scale-90">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => inputGaleriaRef.current?.click()}
                      className="h-14 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all active:scale-95"
                    >
                      <ImageIcon size={18} />
                      <span className="text-[10px] font-medium">Galeria / PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => inputCameraRef.current?.click()}
                      className="h-14 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all active:scale-95"
                    >
                      <Camera size={18} />
                      <span className="text-[10px] font-medium">Tirar foto</span>
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Anexe o boleto ou conta para facilitar o pagamento.
                </p>
              </div>
            </div>

            {/* Recorrência */}
            <div className="section-card space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={e => setRecorrente(e.target.checked)}
                  className="w-5 h-5 rounded border-border accent-primary cursor-pointer"
                />
                <div>
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <RefreshCw size={14} className="text-primary" />
                    Conta mensal fixa (recorrente)
                  </span>
                  <p className="text-[11px] text-muted-foreground">Ex.: aluguel, internet, salários</p>
                </div>
              </label>

              {recorrente && (
                <div className="pl-8 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="label-micro">Dia todo mês *</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Ex.: 10"
                        value={diaRecorrente}
                        onChange={e => setDiaRecorrente(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="label-micro">Duração</label>
                      <select
                        value={mesesRecorrencia}
                        onChange={e => setMesesRecorrencia(e.target.value)}
                        className="form-select"
                      >
                        {MESES_RECORRENCIA.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {recorrenteAte && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
                      <RefreshCw size={12} />
                      <span>Recorrente até <strong>{recorrenteAte.split('-').reverse().join('/')}</strong></span>
                    </div>
                  )}
                  {mesesRecorrencia === '0' && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-50 border border-yellow-200 text-xs text-yellow-700">
                      <RefreshCw size={12} />
                      <span>Sem data de fim — recorrência indeterminada</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={goStep2} className="btn-primary">
              Continuar →
            </button>
          </>
        ) : (
          <>
            {/* PASSO 2 */}
            <div className="section-card space-y-4">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <HelpCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[12px] text-blue-700">
                  Explique o motivo para que o administrador possa aprovar mais rápido.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="label-micro">Por que esse gasto é necessário? *</label>
                <Textarea
                  placeholder="Ex.: Aluguel do mês de março do consultório..."
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={3}
                  className="bg-background rounded-xl border border-input"
                  autoFocus
                />
              </div>
            </div>

            <div className="section-card space-y-3">
              <p className="text-sm font-medium">Quem está registrando?</p>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Já está com seu nome. Mude somente se está registrando por outra pessoa.
              </p>
              <UserSelect
                value={responsavel}
                onChange={setCriadoPor}
                placeholder="Selecionar pessoa..."
              />
            </div>

            {/* Resumo */}
            <div className="section-card !space-y-2 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</p>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">O quê</span>
                  <span className="font-medium truncate ml-4 text-right max-w-[55%]">{descricao}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-bold text-primary">{fmt(valorNum)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimento</span>
                  <span className="font-medium">{dataVencimento.split('-').reverse().join('/')}</span>
                </div>
                {chavePix && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chave PIX</span>
                    <span className="font-medium truncate ml-4 text-right max-w-[55%]">{chavePix}</span>
                  </div>
                )}
                {recorrente && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recorrente</span>
                    <span className="font-medium text-right">
                      Todo dia {diaRecorrente}
                      {recorrenteAte ? ` até ${recorrenteAte.split('-').reverse().join('/')}` : ' (indeterminado)'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 pb-6">
              <button onClick={handleSubmit} disabled={loading} className="btn-primary">
                {loading ? 'Salvando...' : '✓ Registrar conta'}
              </button>
              <button onClick={() => setStep(1)} className="btn-outline">
                ← Voltar
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// Helper: enqueue conta + log + attachment for offline sync
async function enqueueForSync(
  contaId: string,
  payload: Record<string, any>,
  responsavel: string,
  contaOpId: string,
  logOpId: string,
  attachmentId?: string,
) {
  // Enqueue conta INSERT
  await enqueueOperation({
    action: 'INSERT',
    table: 'contas_pagar',
    payload,
    operationId: contaOpId,
  });

  // Enqueue log INSERT
  await enqueueOperation({
    action: 'INSERT',
    table: 'contas_pagar_logs',
    payload: {
      id: crypto.randomUUID(),
      conta_id: contaId,
      usuario_id: responsavel,
      acao: 'CRIADA',
      status_anterior: null,
      status_novo: 'Lancada',
    },
    operationId: logOpId,
  });

  // Enqueue attachment upload if exists
  if (attachmentId) {
    const ext = payload.descricao?.substring(0, 5) || 'file';
    await enqueueOperation({
      action: 'UPLOAD',
      table: 'storage',
      payload: {
        bucket: 'comprovantes',
        path: `${contaId}/${Date.now()}.jpg`,
        contaId,
        field: 'comprovante_url',
      },
      operationId: crypto.randomUUID(),
      attachmentId,
    });
  }
}
