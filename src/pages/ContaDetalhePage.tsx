import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, X, CreditCard, Paperclip, History,
  Download, RefreshCw, User, Pencil, Save, Eye, Upload, FileText, Maximize2, Camera, ImageIcon, PenLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/AppLayout';
import UserSelect from '@/components/UserSelect';
import FileUpload from '@/components/FileUpload';
import { gerarPdfConta } from '@/lib/gerarPdfConta';
import { gerarReciboAssinatura } from '@/lib/gerarReciboAssinatura';



const STEPS = [
  { key: 'Lancada', label: 'Registrada', emoji: '📝' },
  { key: 'Paga', label: 'Paga', emoji: '💰' },
];

const formasPagamento = ['PIX', 'Dinheiro', 'Transferência', 'Cartão', 'Boleto', 'Cheque'];

// [FEATURE 5] Label dinâmico do campo extra por forma de pagamento
const extraPagLabel: Record<string, string | null> = {
  'PIX': 'Chave PIX usada',
  'Transferência': 'Banco + dados da conta',
  'Boleto': 'Código do boleto (opcional)',
  'Cheque': 'Número do cheque (opcional)',
  'Dinheiro': null,
  'Cartão': null,
};

interface LogEntry {
  id: string; acao: string; status_anterior: string | null; status_novo: string | null;
  observacao: string | null; criado_em: string; usuario_id: string;
}
interface UsuarioSimples { id: string; nome: string; }

const parseBRL = (s: string) =>
  parseFloat(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));

const isImageFile = (url: string) => /\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i.test(url);
const isPdfFile = (url: string) => /\.pdf(\?|$)/i.test(url);

export default function ContaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario, isAdmin } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [conta, setConta] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [pagoPor, setPagoPor] = useState('');
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<'image' | 'pdf' | null>(null);
  const [viewerBlobUrl, setViewerBlobUrl] = useState<string | null>(null);
  const [pdfPageImages, setPdfPageImages] = useState<string[]>([]);
  
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioSimples[]>([]);
  const viewerBlobRef = useRef<string | null>(null);

  // [FEATURE 4] Aviso de comprovante antes de confirmar pagamento
  const [avisoSemComprovante, setAvisoSemComprovante] = useState(false);

  // Comprovante inline no registro de pagamento
  const [comprovantePagFile, setComprovantePagFile] = useState<File | null>(null);
  const [comprovantePagPreview, setComprovantePagPreview] = useState<string | null>(null);
  const inputCompGaleriaRef = useRef<HTMLInputElement>(null);
  const inputCompCameraRef = useRef<HTMLInputElement>(null);

  const handleComprovantePag = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande (máx. 10MB)'); return; }
    setComprovantePagFile(file);
    if (file.type.startsWith('image/')) {
      setComprovantePagPreview(URL.createObjectURL(file));
    } else {
      setComprovantePagPreview(null);
    }
  };

  const removerComprovantePag = () => {
    setComprovantePagFile(null);
    setComprovantePagPreview(null);
    if (inputCompGaleriaRef.current) inputCompGaleriaRef.current.value = '';
    if (inputCompCameraRef.current) inputCompCameraRef.current.value = '';
  };

  // [FEATURE 6] Modo de edição
  const [editMode, setEditMode] = useState(false);
  const [editDescricao, setEditDescricao] = useState('');
  const [editValorRaw, setEditValorRaw] = useState('');
  const [editDataVencimento, setEditDataVencimento] = useState('');
  const [editMotivo, setEditMotivo] = useState('');
  const [editCategoria, setEditCategoria] = useState('');

  useEffect(() => {
    if (id) fetchConta();
    fetchUsuarios();
  }, [id]);

  // Pré-preenche forma de pagamento e chave PIX quando a conta tem chave_pix salva
  useEffect(() => {
    if (conta?.chave_pix) {
      setChavePix(conta.chave_pix);
      setFormaPagamento(prev => prev || 'PIX');
    }
  }, [conta?.id]);

  useEffect(() => {
    return () => {
      if (viewerBlobRef.current) {
        URL.revokeObjectURL(viewerBlobRef.current);
      }
    };
  }, []);

  const fetchUsuarios = async () => {
    const { data } = await supabase.from('usuarios').select('id, nome').order('nome');
    if (data) setUsuarios(data);
  };

  const fetchConta = async () => {
    setLoading(true);
    const [contaRes, logsRes] = await Promise.all([
      supabase.from('contas_pagar').select('*').eq('id', id!).single(),
      supabase.from('contas_pagar_logs').select('*').eq('conta_id', id!).order('criado_em', { ascending: false }),
    ]);
    if (contaRes.data) setConta(contaRes.data);
    if (logsRes.data) setLogs(logsRes.data as LogEntry[]);
    setLoading(false);
  };

  const getNome = (userId: string | null) => {
    if (!userId) return null;
    return usuarios.find(u => u.id === userId)?.nome ?? null;
  };

  // [FEATURE 6] Abrir edição com valores atuais
  const abrirEdicao = () => {
    setEditDescricao(conta.descricao || '');
    setEditValorRaw(
      Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
    setEditDataVencimento(conta.data_vencimento || '');
    setEditMotivo(conta.motivo || '');
    setEditCategoria(conta.categoria || '');
    setEditMode(true);
  };

  const handleValorEdit = (raw: string) => {
    const nums = raw.replace(/\D/g, '');
    if (!nums) { setEditValorRaw(''); return; }
    const cents = parseInt(nums, 10);
    const brl = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setEditValorRaw(brl);
  };

  const handleSalvarEdicao = async () => {
    const valorNum = parseBRL(editValorRaw);
    if (!editDescricao.trim()) return toast.error('Informe a descrição');
    if (!editValorRaw || isNaN(valorNum) || valorNum <= 0) return toast.error('Valor inválido');
    if (!editDataVencimento) return toast.error('Informe o vencimento');

    setActionLoading(true);
    const { error } = await supabase
      .from('contas_pagar')
      .update({
        descricao: editDescricao.trim(),
        valor: valorNum,
        data_vencimento: editDataVencimento,
        motivo: editMotivo.trim(),
        categoria: editCategoria.trim() || null,
        empresa_id: empresaAtiva?.id ?? null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', conta.id);

    if (error) { toast.error('Erro ao salvar alterações'); setActionLoading(false); return; }

    await supabase.from('contas_pagar_logs').insert({
      conta_id: conta.id,
      usuario_id: usuario!.id,
      acao: 'EDITADA',
      status_anterior: conta.status,
      status_novo: conta.status,
    });

    toast.success('✓ Alterações salvas!');
    setEditMode(false);
    fetchConta();
    setActionLoading(false);
  };

  const changeStatus = async (newStatus: string) => {
    if (!conta || !usuario) return;
    setActionLoading(true);
    setAvisoSemComprovante(false);

    // Upload comprovante de pagamento se anexado
    let comprovanteUrl = conta.comprovante_url;
    if (newStatus === 'Paga' && comprovantePagFile) {
      const ext = comprovantePagFile.name.split('.').pop() || 'jpg';
      const path = `${conta.id}/comprovante_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('comprovantes')
        .upload(path, comprovantePagFile, { upsert: true });
      if (upErr) {
        toast.error('Erro ao enviar comprovante');
        setActionLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(path);
      comprovanteUrl = urlData.publicUrl;
    }

    const updates: any = { status: newStatus, atualizado_em: new Date().toISOString() };
    if (newStatus === 'Paga') {
      updates.aprovado_por = usuario.id;
      updates.pago_por = pagoPor || usuario.id;
      updates.data_pagamento = new Date().toISOString().split('T')[0];
      if (formaPagamento) updates.forma_pagamento = formaPagamento;
      if (chavePix.trim()) updates.chave_pix = chavePix.trim();
      if (comprovanteUrl) updates.comprovante_url = comprovanteUrl;
    }

    const { error } = await supabase.from('contas_pagar').update(updates).eq('id', conta.id);
    if (error) { toast.error('Erro ao atualizar'); setActionLoading(false); return; }

    await supabase.from('contas_pagar_logs').insert({
      conta_id: conta.id, usuario_id: usuario.id,
      acao: 'STATUS_ALTERADO', status_anterior: conta.status, status_novo: newStatus,
    });

    toast.success(newStatus === 'Paga' ? '💰 Pagamento registrado!' : '✅ Atualizado!');
    setComprovantePagFile(null);
    setComprovantePagPreview(null);
    fetchConta();
    setActionLoading(false);
  };

  // [FEATURE 4] Confirmar pagamento com aviso se sem comprovante
  const handleConfirmarPagamento = () => {
    if (!formaPagamento) return toast.error('Informe como foi pago');
    if (!conta.comprovante_url && !comprovantePagFile && !avisoSemComprovante) {
      setAvisoSemComprovante(true);
      return;
    }
    changeStatus('Paga');
  };

  const handleBoletoUploaded = (url: string) => {
    setConta({ ...conta, comprovante_url: url });
  };

  const handleGerarPdf = () => {
    if (!conta) return;
    gerarPdfConta({
      descricao: conta.descricao, valor: Number(conta.valor), categoria: conta.categoria,
      motivo: conta.motivo, status: conta.status, data_vencimento: conta.data_vencimento,
      data_pagamento: conta.data_pagamento, forma_pagamento: conta.forma_pagamento,
      chave_pix: conta.chave_pix, comprovante_url: conta.comprovante_url,
      criado_em: conta.criado_em, observacoes: conta.observacoes,
      criado_por_nome: getNome(conta.criado_por) ?? undefined,
      aprovado_por_nome: getNome(conta.aprovado_por) ?? undefined,
      pago_por_nome: getNome(conta.pago_por) ?? undefined,
    });
  };

  const handleGerarRecibo = () => {
    if (!conta) return;
    gerarReciboAssinatura({
      descricao: conta.descricao,
      valor: Number(conta.valor),
      categoria: conta.categoria,
      motivo: conta.motivo,
      data_pagamento: conta.data_pagamento,
      forma_pagamento: conta.forma_pagamento,
      chave_pix: conta.chave_pix,
      observacoes: conta.observacoes,
      empresa_nome: empresaAtiva?.nome,
      pago_por_nome: getNome(conta.pago_por) ?? undefined,
    });
  };

  const clearViewerBlob = () => {
    if (viewerBlobRef.current) {
      URL.revokeObjectURL(viewerBlobRef.current);
      viewerBlobRef.current = null;
    }
    setViewerBlobUrl(null);
    setPdfPageImages([]);
  };

  const renderPdfToImages = useCallback(async (blob: Blob) => {
    try {
      // Dynamic import to avoid loading pdfjs in the main bundle
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const scale = 1.5;

      // Render pages progressively — show each as soon as ready
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPdfPageImages(prev => [...prev, dataUrl]);
      }
    } catch (err) {
      console.error('PDF render error:', err);
      setViewerError('Não foi possível renderizar o PDF.');
    }
  }, []);

  const closeViewer = () => {
    setViewerUrl(null);
    setViewerType(null);
    setViewerLoading(false);
    setViewerError(null);
    clearViewerBlob();
  };

  const openViewer = async (url: string) => {
    const initialType = isPdfFile(url) ? 'pdf' : 'image';

    setViewerUrl(url);
    setViewerType(initialType);
    setViewerError(null);
    setViewerLoading(true);
    clearViewerBlob();

    try {
      // Try to extract bucket/path from Supabase Storage URL
      const storageMatch = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/(.+?)(?:\?|$)/);

      let blob: Blob;
      if (storageMatch) {
        const [, bucket, path] = storageMatch;
        const { data, error } = await supabase.storage.from(bucket).download(decodeURIComponent(path));
        if (error || !data) throw new Error(error?.message || 'Falha ao baixar');
        blob = data;
      } else {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Falha ao baixar arquivo');
        blob = await response.blob();
      }

      const detectedType = blob.type.includes('pdf') ? 'pdf' : 'image';
      setViewerType(detectedType);

      const finalBlob =
        detectedType === 'pdf' && blob.type !== 'application/pdf'
          ? new Blob([blob], { type: 'application/pdf' })
          : blob;

      const objectUrl = URL.createObjectURL(finalBlob);
      viewerBlobRef.current = objectUrl;
      setViewerBlobUrl(objectUrl);

      if (isPdfFile(url)) {
        await renderPdfToImages(finalBlob);
      }
    } catch (err) {
      console.error('Viewer error:', err);
      setViewerError(
        initialType === 'pdf'
          ? 'Não foi possível abrir este PDF dentro do aplicativo.'
          : 'Não foi possível carregar a imagem.'
      );
    } finally {
      setViewerLoading(false);
    }
  };

  // [FEATURE 10] Labels de log melhorados
  const getLogLabel = (log: LogEntry) => {
    if (log.acao === 'CRIADA') return '📝 Conta registrada';
    if (log.acao === 'EDITADA') return '✏️ Dados editados';
    if (log.status_novo === 'Aprovada') return '✅ Conta aprovada';
    if (log.status_novo === 'Paga') return '💰 Pagamento registrado';
    if (log.status_novo === 'Cancelada') return '❌ Conta cancelada';
    if (log.status_novo === 'Lancada') return '↩️ Devolvida para revisão';
    return '🔄 Status atualizado';
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const fmtData = (d: string | null) => {
    if (!d) return '—';
    try {
      const dt = d.includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
      return format(dt, 'dd/MM/yyyy', { locale: ptBR });
    } catch { return d; }
  };

  const fmtDateTime = (d: string) => {
    try { return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
    catch { return d; }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="section-card animate-pulse !space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      </AppLayout>
    );
  }

  if (!conta) {
    return (
      <AppLayout>
        <div className="text-center py-20 space-y-3">
          <p className="text-3xl">🔍</p>
          <p className="text-muted-foreground">Conta não encontrada</p>
          <button onClick={() => navigate('/')} className="text-sm text-primary font-semibold">
            Voltar ao início
          </button>
        </div>
      </AppLayout>
    );
  }

  const currentStepIdx = conta.status === 'Cancelada' ? -1 : STEPS.findIndex((s: any) => s.key === conta.status);
  const podeEditar = conta.status === 'Lancada' && (isAdmin || conta.criado_por === usuario?.id);

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">

        {/* Voltar */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground text-sm active:scale-90">
            <ArrowLeft size={18} /> Voltar
          </button>
          {/* [FEATURE 6] Botão editar para contas lançadas */}
          {podeEditar && !editMode && (
            <button
              onClick={abrirEdicao}
              className="flex items-center gap-1.5 text-sm text-primary font-semibold active:scale-90"
            >
              <Pencil size={14} /> Editar
            </button>
          )}
        </div>

        {/* [FEATURE 6] Formulário de edição inline */}
        {editMode ? (
          <div className="section-card space-y-4">
            <p className="section-title flex items-center gap-2">
              <Pencil size={14} /> Editar conta
            </p>

            <div className="space-y-1.5">
              <label className="label-micro">O que precisa ser pago? *</label>
              <Input
                value={editDescricao}
                onChange={e => setEditDescricao(e.target.value)}
                className="form-input"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="label-micro">Valor (R$) *</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editValorRaw}
                  onChange={e => handleValorEdit(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-micro">Vencimento *</label>
                <Input
                  type="date"
                  value={editDataVencimento}
                  onChange={e => setEditDataVencimento(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label-micro">Categoria</label>
              <Input
                value={editCategoria}
                onChange={e => setEditCategoria(e.target.value)}
                placeholder="Ex.: Aluguel, Material..."
                className="form-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="label-micro">Motivo</label>
              <Textarea
                value={editMotivo}
                onChange={e => setEditMotivo(e.target.value)}
                rows={2}
                className="bg-background rounded-xl border border-input"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSalvarEdicao}
                disabled={actionLoading}
                className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold rounded-xl"
              >
                <Save size={15} className="mr-2" />
                {actionLoading ? 'Salvando...' : 'Salvar alterações'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditMode(false)}
                disabled={actionLoading}
                className="h-12 px-4 rounded-xl"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Valor + descrição */}
            <div className="section-card !space-y-3">
              <p className="text-2xl font-bold text-primary tabular-nums">{fmt(Number(conta.valor))}</p>
              <h2 className="text-base font-bold leading-tight">{conta.descricao}</h2>
              {conta.categoria && (
                <span className="inline-block text-[11px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {conta.categoria}
                </span>
              )}
              {conta.recorrente && (
                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
                  <RefreshCw size={13} />
                  Conta mensal · vence todo dia {conta.dia_vencimento_recorrente}
                </div>
              )}
            </div>

            {/* Barra de progresso visual */}
            {conta.status !== 'Cancelada' ? (
              <div className="section-card !p-5 !space-y-0">
                <div className="flex items-center w-full">
                  {STEPS.map((step: any, idx: number) => {
                    const done = idx <= currentStepIdx;
                    const isCurrent = idx === currentStepIdx;
                    return (
                      <div key={step.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center min-w-[56px]">
                          <div className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-sm transition-all duration-300',
                            done
                              ? 'bg-primary/15 ring-2 ring-primary ring-offset-2 ring-offset-background'
                              : 'bg-muted/60 ring-1 ring-border'
                          )}>
                            {step.emoji}
                          </div>
                          <span className={cn(
                            'text-[11px] mt-2 font-semibold tracking-tight',
                            isCurrent ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
                          )}>
                            {step.label}
                          </span>
                        </div>
                        {idx < STEPS.length - 1 && (
                          <div className="flex-1 mx-2 -mt-5">
                            <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                              <div className={cn(
                                'h-full rounded-full transition-all duration-500',
                                idx < currentStepIdx ? 'w-full bg-primary' : 'w-0'
                              )} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="section-card !p-3 flex items-center gap-2 bg-red-50 border-red-200 !space-y-0">
                <X size={18} className="text-red-500" />
                <span className="text-sm font-semibold text-red-700">Esta conta foi cancelada</span>
              </div>
            )}

            {/* Informações */}
            <div className="section-card">
              <p className="section-title">Informações</p>
              <div className="space-y-2.5 text-sm">
                <InfoRow label="Vencimento" value={fmtData(conta.data_vencimento)} />
                {conta.data_pagamento && <InfoRow label="Pago em" value={fmtData(conta.data_pagamento)} />}
                {conta.forma_pagamento && <InfoRow label="Forma de pagamento" value={conta.forma_pagamento} />}
                {conta.chave_pix && <InfoRow label={extraPagLabel[conta.forma_pagamento] ?? 'Dados do pagamento'} value={conta.chave_pix} />}
                <InfoRow label="Registrado por" value={getNome(conta.criado_por) ?? '—'} />
                {conta.aprovado_por && <InfoRow label="Aprovado por" value={getNome(conta.aprovado_por) ?? '—'} />}
                {conta.pago_por && <InfoRow label="Pago por" value={getNome(conta.pago_por) ?? '—'} />}
              </div>
            </div>

            {/* Motivo */}
            <div className="section-card">
              <p className="section-title">Motivo do gasto</p>
              <p className="text-sm leading-relaxed">{conta.motivo}</p>
              {conta.observacoes && !conta.observacoes.startsWith('recorrente_ate:') && (
                <p className="text-[11px] text-muted-foreground mt-2">{conta.observacoes}</p>
              )}
            </div>
          </>
        )}

        {/* ═══════ SEÇÃO 1: BOLETO / CONTA (visualizar antes de pagar) ═══════ */}
        {conta.status !== 'Paga' && (
          <div className="section-card !space-y-3">
            <p className="section-title flex items-center gap-2">
              <FileText size={14} /> Boleto / Conta
            </p>

            {conta.comprovante_url ? (
              <>
                {/* Preview clicável (imagens) */}
                {isImageFile(conta.comprovante_url) && (
                  <button
                    onClick={() => void openViewer(conta.comprovante_url)}
                    className="w-full rounded-xl overflow-hidden border border-border active:scale-[0.98] transition-transform"
                  >
                    <img
                      src={conta.comprovante_url}
                      alt="Boleto/Conta"
                      className="w-full max-h-64 object-contain bg-muted/30"
                      loading="lazy"
                    />
                  </button>
                )}

                {/* Botão único para ver documento */}
                {isImageFile(conta.comprovante_url) ? (
                  <button
                    onClick={() => void openViewer(conta.comprovante_url)}
                    className="w-full h-11 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-center gap-2 text-sm font-semibold text-primary active:scale-[0.98] transition-transform"
                  >
                    <Maximize2 size={16} />
                    Ver em tela cheia
                  </button>
                ) : (
                  <button
                    onClick={() => void openViewer(conta.comprovante_url)}
                    className="w-full h-14 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-center gap-2 text-sm font-semibold text-primary active:scale-[0.98] transition-transform"
                  >
                    <Eye size={18} />
                    Abrir boleto / conta
                  </button>
                )}

                {/* Trocar documento */}
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*,.pdf';
                    input.onchange = async (e: any) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) { toast.error('Máx. 10MB'); return; }
                      const ext = file.name.split('.').pop() || 'jpg';
                      const path = `${conta.id}/${Date.now()}.${ext}`;
                      const { error } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: true });
                      if (error) { toast.error('Erro ao enviar'); return; }
                      const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(path);
                      await supabase.from('contas_pagar').update({ comprovante_url: urlData.publicUrl }).eq('id', conta.id);
                      handleBoletoUploaded(urlData.publicUrl);
                      toast.success('Documento substituído!');
                    };
                    input.click();
                  }}
                  className="w-full h-10 rounded-xl border border-dashed border-border text-xs text-muted-foreground flex items-center justify-center gap-1.5 hover:border-primary/40 transition-colors"
                >
                  <Upload size={12} /> Trocar documento
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Anexe o boleto ou conta aqui para visualizar.
                </p>
                <FileUpload
                  contaId={conta.id}
                  currentUrl={null}
                  onUploaded={handleBoletoUploaded}
                />
              </div>
            )}
          </div>
        )}

        {/* PDF + Recibo */}
        {(conta.status === 'Paga' || conta.status === 'Aprovada') && (
          <div className="flex gap-2">
            <button
              onClick={handleGerarPdf}
              className="flex-1 h-12 rounded-xl border border-border bg-card flex items-center justify-center gap-2 text-sm font-medium shadow-sm active:scale-[0.98] transition-transform"
            >
              <Download size={16} /> PDF
            </button>
            <button
              onClick={handleGerarRecibo}
              className="flex-1 h-12 rounded-xl border border-primary/30 bg-primary/5 text-primary flex items-center justify-center gap-2 text-sm font-medium shadow-sm active:scale-[0.98] transition-transform hover:bg-primary/10"
            >
              <PenLine size={16} /> Recibo c/ Assinatura
            </button>
          </div>
        )}

        {/* ═══════ SEÇÃO 2: REGISTRAR PAGAMENTO (admin) ═══════ */}
        {isAdmin && (conta.status === 'Lancada' || conta.status === 'Aprovada') && !editMode && (
          <div className="section-card !space-y-4 border-primary/20">
            <p className="section-title flex items-center gap-2">💳 Registrar pagamento</p>
            <p className="text-[12px] text-muted-foreground">
              Confira o boleto acima, pague, e registre aqui como foi pago.
            </p>

            <div className="space-y-1.5">
              <label className="label-micro">Como foi pago? *</label>
              <Select value={formaPagamento} onValueChange={v => { setFormaPagamento(v); setChavePix(v === 'PIX' && conta?.chave_pix ? conta.chave_pix : ''); setAvisoSemComprovante(false); }}>
                <SelectTrigger className="h-12 bg-background rounded-xl">
                  <SelectValue placeholder="Escolha a forma..." />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {formaPagamento && extraPagLabel[formaPagamento] && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="label-micro">{extraPagLabel[formaPagamento]}</label>
                  {formaPagamento === 'PIX' && conta?.chave_pix && chavePix === conta.chave_pix && (
                    <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                      ✓ do cadastro
                    </span>
                  )}
                </div>
                <Input
                  placeholder={
                    formaPagamento === 'PIX' ? 'CPF, e-mail, telefone ou chave aleatória' :
                    formaPagamento === 'Transferência' ? 'Ex.: Itaú · Ag. 1234 · CC 56789-0' :
                    'Opcional...'
                  }
                  value={chavePix}
                  onChange={e => setChavePix(e.target.value)}
                  className="form-input"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="label-micro">Quem pagou?</label>
              <UserSelect
                value={pagoPor || usuario?.id || ''}
                onChange={setPagoPor}
                placeholder="Selecionar quem pagou..."
              />
            </div>

            {/* Comprovante de pagamento inline */}
            <div className="space-y-1.5">
              <label className="label-micro">Comprovante de pagamento (opcional)</label>
              <input
                ref={inputCompGaleriaRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleComprovantePag}
                className="hidden"
              />
              <input
                ref={inputCompCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleComprovantePag}
                className="hidden"
              />

              {comprovantePagFile ? (
                <div className="space-y-2">
                  {comprovantePagPreview && (
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img src={comprovantePagPreview} alt="Preview" className="w-full max-h-40 object-cover" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200">
                    <span className="text-xs text-green-700 font-medium flex-1 truncate">
                      📎 {comprovantePagFile.name}
                    </span>
                    <button onClick={removerComprovantePag} className="text-red-400 hover:text-red-600 active:scale-90">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => inputCompGaleriaRef.current?.click()}
                    className="h-14 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all active:scale-95"
                  >
                    <ImageIcon size={18} />
                    <span className="text-[10px] font-medium">Galeria / PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => inputCompCameraRef.current?.click()}
                    className="h-14 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all active:scale-95"
                  >
                    <Camera size={18} />
                    <span className="text-[10px] font-medium">Tirar foto</span>
                  </button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                Anexe o comprovante junto com o pagamento para facilitar a conferência.
              </p>
            </div>

            {avisoSemComprovante && !conta.comprovante_url && !comprovantePagFile && (
              <div className="px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-yellow-800">⚠️ Nenhum comprovante de pagamento</p>
                <p className="text-xs text-yellow-700">
                  Recomendamos anexar o comprovante depois. Deseja registrar assim mesmo?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAvisoSemComprovante(false)}
                    className="flex-1 h-9 rounded-xl border border-yellow-400 text-yellow-800 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => changeStatus('Paga')}
                    className="flex-1 h-9 rounded-xl bg-yellow-500 text-white text-xs font-semibold"
                  >
                    Confirmar assim mesmo
                  </button>
                </div>
              </div>
            )}

            <Button
              onClick={handleConfirmarPagamento}
              disabled={actionLoading || !formaPagamento}
              className="w-full h-12 gradient-primary text-primary-foreground font-semibold rounded-xl"
            >
              <CreditCard size={16} className="mr-2" /> Confirmar pagamento
            </Button>

            <Button
              variant="outline"
              onClick={() => changeStatus('Cancelada')}
              disabled={actionLoading}
              className="w-full h-11 text-destructive border-destructive/30 rounded-xl text-sm"
            >
              <X size={14} className="mr-2" /> Cancelar conta
            </Button>
          </div>
        )}

        {/* ═══════ SEÇÃO 3: COMPROVANTE DE PAGAMENTO (após pagar) ═══════ */}
        {conta.status === 'Paga' && (
          <div className="section-card !space-y-3">
            <p className="section-title flex items-center gap-2">
              <Paperclip size={14} /> Comprovante de pagamento
            </p>
            {conta.comprovante_url ? (
              <>
                {isImageFile(conta.comprovante_url) ? (
                  <>
                    <button
                      onClick={() => void openViewer(conta.comprovante_url)}
                      className="w-full rounded-xl overflow-hidden border border-border active:scale-[0.98] transition-transform"
                    >
                      <img
                        src={conta.comprovante_url}
                        alt="Comprovante"
                        className="w-full max-h-48 object-cover"
                        loading="lazy"
                      />
                    </button>
                    <button
                      onClick={() => void openViewer(conta.comprovante_url)}
                      className="w-full h-11 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center gap-2 text-sm font-semibold text-green-700 active:scale-[0.98] transition-transform"
                    >
                      <Eye size={16} /> Ver comprovante
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => void openViewer(conta.comprovante_url)}
                    className="w-full h-11 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center gap-2 text-sm font-semibold text-green-700 active:scale-[0.98] transition-transform"
                  >
                    <Eye size={16} /> Ver comprovante
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <Upload size={14} className="text-yellow-600 shrink-0" />
                  <p className="text-xs text-yellow-700 font-medium">
                    Anexe o comprovante de pagamento aqui
                  </p>
                </div>
                <FileUpload
                  contaId={conta.id}
                  currentUrl={null}
                  onUploaded={(url) => setConta({ ...conta, comprovante_url: url })}
                />
              </div>
            )}
          </div>
        )}

        {/* [FEATURE 10] Histórico melhorado */}
        {logs.length > 0 && (
          <div className="section-card">
            <p className="section-title flex items-center gap-2"><History size={14} /> Histórico</p>
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="flex gap-3">
                  <div className="w-1 bg-primary/20 rounded-full shrink-0 mt-1" />
                  <div className="flex-1 pb-1">
                    <p className="text-xs font-semibold">{getLogLabel(log)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <User size={9} className="text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">
                        {getNome(log.usuario_id) ?? 'Usuário'} · {fmtDateTime(log.criado_em)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pb-4" />
      </div>

      {/* ═══════ LIGHTBOX / VISUALIZADOR INTERNO ═══════ */}
      {viewerUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
          onClick={closeViewer}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-2 shrink-0 bg-black/80 backdrop-blur-sm border-b border-white/10">
            <span className="text-white/70 text-xs font-medium truncate max-w-[50%]">
              {viewerType === 'pdf' ? 'Visualizando PDF' : 'Visualizando imagem'}
            </span>
            <div className="flex items-center gap-2">
              {viewerType === 'pdf' && viewerBlobUrl && (
                <a
                  href={viewerBlobUrl}
                  download="documento.pdf"
                  onClick={e => e.stopPropagation()}
                  className="h-9 px-3 rounded-full bg-white/15 flex items-center gap-1.5 text-white text-xs font-medium active:scale-90 transition-transform"
                >
                  <Download size={14} /> Baixar
                </a>
              )}
              <button
                onClick={closeViewer}
                className="h-9 px-4 rounded-full bg-red-500/80 flex items-center justify-center gap-1.5 text-white text-xs font-semibold active:scale-90 transition-transform"
              >
                <X size={16} /> Fechar
              </button>
            </div>
          </div>

          {/* Content */}
          <div
            className="flex-1 overflow-auto overscroll-contain px-2 pb-4"
            onClick={e => e.stopPropagation()}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {viewerLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2 text-white/80">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-medium">Carregando...</p>
                </div>
              </div>
            ) : viewerError ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2 text-white/80 max-w-sm">
                  <p className="text-sm font-medium">{viewerError}</p>
                  <p className="text-xs text-white/60">Tente reenviar o arquivo se o problema continuar.</p>
                </div>
              </div>
            ) : viewerBlobUrl ? (
              viewerType === 'pdf' ? (
                <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-2">
                  {pdfPageImages.length > 0 ? (
                    pdfPageImages.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Página ${i + 1}`}
                        className="w-full rounded shadow-sm"
                        style={{ touchAction: 'pinch-zoom' }}
                      />
                    ))
                  ) : (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-full">
                  <img
                    src={viewerBlobUrl}
                    alt="Documento"
                    className="max-w-full max-h-[85vh] object-contain rounded-lg"
                    style={{ touchAction: 'pinch-zoom' }}
                  />
                </div>
              )
            ) : null}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
