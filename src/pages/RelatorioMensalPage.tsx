import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

interface Conta {
  id: string;
  descricao: string;
  valor: number;
  categoria: string | null;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  motivo: string;
  criado_em: string;
  criado_por_nome?: string;
  aprovado_por_nome?: string;
  pago_por_nome?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtData = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    const dt = d.includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
    return format(dt, 'dd/MM/yyyy', { locale: ptBR });
  } catch { return d; }
};

const STATUS_LABEL: Record<string, string> = {
  Lancada: 'Aguardando',
  Aprovada: 'A pagar',
  Paga: 'Pago',
  Cancelada: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  Lancada: 'text-yellow-700 bg-yellow-50',
  Aprovada: 'text-blue-700 bg-blue-50',
  Paga: 'text-green-700 bg-green-50',
  Cancelada: 'text-gray-500 bg-gray-100',
};

export default function RelatorioMensalPage() {
  const navigate = useNavigate();
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(false);
  const [mesRef, setMesRef] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const mesDate = new Date(mesRef + '-01T00:00:00');
  const inicio = format(startOfMonth(mesDate), 'yyyy-MM-dd');
  const fim = format(endOfMonth(mesDate), 'yyyy-MM-dd');
  const mesLabel = format(mesDate, 'MMMM yyyy', { locale: ptBR });

  const navMes = (delta: number) => {
    const d = new Date(mesRef + '-01T00:00:00');
    d.setMonth(d.getMonth() + delta);
    setMesRef(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Busca contas com vencimento no mês selecionado
      const { data: contasData } = await supabase
        .from('contas_pagar')
        .select('*')
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim)
        .order('data_vencimento');

      if (!contasData) { setLoading(false); return; }

      // Busca nomes dos usuários
      const { data: usuarios } = await supabase.from('usuarios').select('id, nome');
      const nomeMap: Record<string, string> = {};
      usuarios?.forEach(u => { nomeMap[u.id] = u.nome; });

      // Para cada conta, busca logs para pegar aprovador/pagador
      const contasEnriquecidas = await Promise.all(contasData.map(async (c: any) => {
        const { data: logs } = await supabase
          .from('contas_pagar_logs')
          .select('usuario_id, acao')
          .eq('conta_id', c.id);

        const aprovadoPor = logs?.find(l => l.acao === 'APROVADA')?.usuario_id;
        const pagoPor = logs?.find(l => l.acao === 'PAGA')?.usuario_id;

        return {
          ...c,
          criado_por_nome: c.criado_por ? nomeMap[c.criado_por] : undefined,
          aprovado_por_nome: aprovadoPor ? nomeMap[aprovadoPor] : undefined,
          pago_por_nome: pagoPor ? nomeMap[pagoPor] : undefined,
        } as Conta;
      }));

      setContas(contasEnriquecidas);
      setLoading(false);
    };
    load();
  }, [mesRef, inicio, fim]);

  // Totais
  const contasAtivas = contas.filter(c => c.status !== 'Cancelada');
  const totalGeral = contasAtivas.reduce((s, c) => s + Number(c.valor), 0);
  const totalPago = contasAtivas.filter(c => c.status === 'Paga').reduce((s, c) => s + Number(c.valor), 0);
  const totalPendente = contasAtivas.filter(c => c.status !== 'Paga').reduce((s, c) => s + Number(c.valor), 0);

  // Agrupa por categoria
  const porCategoria: Record<string, number> = {};
  contasAtivas.forEach(c => {
    const cat = c.categoria || 'Sem categoria';
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(c.valor);
  });
  const categorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);

  // [FEATURE 9] Exportar CSV
  const exportarCSV = () => {
    const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const STATUS_LABEL_CSV: Record<string, string> = {
      Lancada: 'Aguardando', Aprovada: 'A pagar', Paga: 'Pago', Cancelada: 'Cancelado',
    };
    const header = 'Descrição,Categoria,Valor (R$),Vencimento,Pagamento,Status,Criado por,Pago por\n';
    const rows = contas.map(c => [
      escape(c.descricao),
      escape(c.categoria || ''),
      escape(Number(c.valor).toFixed(2).replace('.', ',')),
      escape(fmtData(c.data_vencimento)),
      escape(c.data_pagamento ? fmtData(c.data_pagamento) : ''),
      escape(STATUS_LABEL_CSV[c.status] ?? c.status),
      escape(c.criado_por_nome || ''),
      escape(c.pago_por_nome || ''),
    ].join(',')).join('\n');

    const bom = '\uFEFF'; // BOM para Excel reconhecer UTF-8
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${mesRef}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gerarPDF = () => {
    const linhasTabela = contas.map(c => `
      <tr>
        <td>${c.descricao}</td>
        <td>${c.categoria || '—'}</td>
        <td style="text-align:right; font-weight:600">${fmt(Number(c.valor))}</td>
        <td>${fmtData(c.data_vencimento)}</td>
        <td>${c.data_pagamento ? fmtData(c.data_pagamento) : '—'}</td>
        <td>
          <span style="padding:2px 8px; border-radius:20px; font-size:11px; font-weight:700;
            background:${c.status === 'Paga' ? '#dcfce7' : c.status === 'Aprovada' ? '#dbeafe' : c.status === 'Cancelada' ? '#f3f4f6' : '#fef9c3'};
            color:${c.status === 'Paga' ? '#166534' : c.status === 'Aprovada' ? '#1e40af' : c.status === 'Cancelada' ? '#6b7280' : '#854d0e'}">
            ${STATUS_LABEL[c.status] ?? c.status}
          </span>
        </td>
      </tr>
    `).join('');

    const linhasCategorias = categorias.map(([cat, val]) => `
      <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f0f0; font-size:13px;">
        <span style="color:#555">${cat}</span>
        <span style="font-weight:600">${fmt(val)}</span>
      </div>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Relatório — ${mesLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Outfit',sans-serif; color:#1a1a2e; padding:32px; max-width:900px; margin:0 auto; }
    .header { display:flex; align-items:center; gap:12px; margin-bottom:28px; padding-bottom:16px; border-bottom:3px solid #ec4899; }
    .logo { width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#ec4899,#fb7185); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:15px; }
    .title { font-size:20px; font-weight:700; margin-bottom:4px; }
    .subtitle { font-size:12px; color:#888; }
    .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
    .kpi { background:#f9fafb; border-radius:12px; padding:14px; }
    .kpi-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#999; margin-bottom:4px; }
    .kpi-value { font-size:22px; font-weight:700; }
    .kpi-value.pago { color:#16a34a; }
    .kpi-value.pendente { color:#d97706; }
    .section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#ec4899; margin-bottom:10px; margin-top:24px; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#999; padding:6px 8px; border-bottom:2px solid #f0f0f0; }
    td { padding:7px 8px; border-bottom:1px solid #f8f8f8; vertical-align:middle; }
    tr:nth-child(even) td { background:#fafafa; }
    .footer { margin-top:32px; padding-top:12px; border-top:1px solid #eee; text-align:center; font-size:10px; color:#aaa; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">FS</div>
    <div>
      <div class="title">Relatório Mensal — ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}</div>
      <div class="subtitle">Dra. Fernanda Sarelli · Contas a Pagar · Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Total do mês</div>
      <div class="kpi-value">${fmt(totalGeral)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Pago</div>
      <div class="kpi-value pago">${fmt(totalPago)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Pendente</div>
      <div class="kpi-value pendente">${fmt(totalPendente)}</div>
    </div>
  </div>

  ${categorias.length > 0 ? `
  <div class="section-title">Por categoria</div>
  <div style="margin-bottom:24px">${linhasCategorias}</div>
  ` : ''}

  <div class="section-title">Todas as contas (${contas.length})</div>
  <table>
    <thead>
      <tr>
        <th>Descrição</th>
        <th>Categoria</th>
        <th style="text-align:right">Valor</th>
        <th>Vencimento</th>
        <th>Pagamento</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${linhasTabela}</tbody>
  </table>

  <div class="footer">
    Contas a Pagar · Dra. Fernanda Sarelli · ${contas.length} conta${contas.length !== 1 ? 's' : ''} · Total ${fmt(totalGeral)}
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in pb-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="text-muted-foreground active:scale-90 p-1">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="page-title">Relatório mensal</h2>
            <p className="page-subtitle">Exporta PDF com todas as contas do mês</p>
          </div>
        </div>

        {/* Seletor de mês */}
        <div className="section-card !py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navMes(-1)}
              className="p-2 rounded-xl text-muted-foreground active:scale-90 hover:bg-muted transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-base capitalize">{mesLabel}</span>
            <button
              onClick={() => navMes(1)}
              className="p-2 rounded-xl text-muted-foreground active:scale-90 hover:bg-muted transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="section-card animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="section-card !space-y-0.5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total</p>
                <p className="text-lg font-bold text-foreground">{fmt(totalGeral)}</p>
              </div>
              <div className="section-card !space-y-0.5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Pago</p>
                <p className="text-lg font-bold text-green-600">{fmt(totalPago)}</p>
              </div>
              <div className="section-card !space-y-0.5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Pendente</p>
                <p className="text-lg font-bold text-amber-600">{fmt(totalPendente)}</p>
              </div>
            </div>

            {/* Por categoria */}
            {categorias.length > 0 && (
              <div className="section-card space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Por categoria</p>
                {categorias.map(([cat, val]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{cat}</span>
                        <span className="font-semibold">{fmt(val)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(val / totalGeral) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista de contas */}
            {contas.length === 0 ? (
              <div className="section-card text-center py-10">
                <FileText size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">Nenhuma conta neste mês</p>
              </div>
            ) : (
              <div className="section-card !space-y-0 !p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Contas ({contas.length})
                  </p>
                </div>
                {contas.map((c, idx) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 px-4 py-3 ${idx < contas.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.descricao}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Venc. {fmtData(c.data_vencimento)}
                        {c.categoria ? ` · ${c.categoria}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{fmt(Number(c.valor))}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[c.status] ?? ''}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* [FEATURE 9] Botões de exportar */}
            {contas.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={gerarPDF}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Exportar PDF — {mesLabel}
                </button>
                <button
                  onClick={exportarCSV}
                  className="btn-outline flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Exportar planilha (CSV / Excel)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
