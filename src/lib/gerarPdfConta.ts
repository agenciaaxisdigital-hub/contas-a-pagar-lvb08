import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContaData {
  descricao: string;
  valor: number;
  categoria?: string | null;
  motivo: string;
  status: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  forma_pagamento?: string | null;
  chave_pix?: string | null;
  comprovante_url?: string | null;
  criado_em: string;
  observacoes?: string | null;
  criado_por_nome?: string;
  pago_por_nome?: string;
  aprovado_por_nome?: string;
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

const fmtDateTime = (d: string) => {
  try { return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return d; }
};

export function gerarPdfConta(conta: ContaData) {
  const statusLabels: Record<string, string> = {
    Lancada: 'Aguardando revisão',
    Aprovada: 'A pagar',
    Paga: 'Pago',
    Cancelada: 'Cancelado',
  };

  const linhas: [string, string][] = [
    ['Descrição', conta.descricao],
    ['Valor', fmt(conta.valor)],
    ['Status', statusLabels[conta.status] ?? conta.status],
  ];

  if (conta.categoria) linhas.push(['Categoria', conta.categoria]);
  linhas.push(['Vencimento', fmtData(conta.data_vencimento)]);
  if (conta.data_pagamento) linhas.push(['Data do pagamento', fmtData(conta.data_pagamento)]);
  if (conta.forma_pagamento) linhas.push(['Forma de pagamento', conta.forma_pagamento]);
  if (conta.chave_pix) linhas.push(['Chave PIX', conta.chave_pix]);
  linhas.push(['Motivo', conta.motivo]);
  if (conta.observacoes) linhas.push(['Observações', conta.observacoes]);
  linhas.push(['Registrado em', fmtDateTime(conta.criado_em)]);
  if (conta.criado_por_nome) linhas.push(['Registrado por', conta.criado_por_nome]);
  if (conta.aprovado_por_nome) linhas.push(['Aprovado por', conta.aprovado_por_nome]);
  if (conta.pago_por_nome) linhas.push(['Pago por', conta.pago_por_nome]);

  // Build HTML for print
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Conta - ${conta.descricao}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Outfit', sans-serif; color: #1a1a2e; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 3px solid #ec4899; }
    .logo { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #ec4899, #fb7185); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; }
    .header-text h1 { font-size: 18px; font-weight: 700; }
    .header-text p { font-size: 12px; color: #666; }
    .title { font-size: 22px; font-weight: 700; margin-bottom: 24px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #ec4899; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .row-label { color: #666; font-size: 14px; }
    .row-value { font-weight: 600; font-size: 14px; text-align: right; max-width: 60%; }
    .valor-destaque { font-size: 28px; font-weight: 700; color: #ec4899; margin-bottom: 24px; }
    ${conta.comprovante_url ? `.comprovante { margin-top: 20px; } .comprovante img { max-width: 100%; max-height: 400px; border-radius: 12px; border: 1px solid #eee; }` : ''}
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #999; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">FS</div>
    <div class="header-text">
      <h1>Contas a Pagar</h1>
      <p>Dra. Fernanda Sarelli</p>
    </div>
  </div>

  <div class="title">${conta.descricao}</div>
  <div class="valor-destaque">${fmt(conta.valor)}</div>

  <div class="section">
    <div class="section-title">Detalhes da conta</div>
    ${linhas.map(([label, value]) => `
      <div class="row">
        <span class="row-label">${label}</span>
        <span class="row-value">${value}</span>
      </div>
    `).join('')}
  </div>

  ${conta.comprovante_url ? `
  <div class="section">
    <div class="section-title">Comprovante</div>
    <div class="comprovante">
      ${conta.comprovante_url.match(/\.(jpg|jpeg|png|webp|gif)$/i) 
        ? `<img src="${conta.comprovante_url}" alt="Comprovante" />`
        : `<a href="${conta.comprovante_url}" target="_blank" style="color: #ec4899;">Abrir comprovante →</a>`
      }
    </div>
  </div>
  ` : ''}

  <div class="footer">
    Documento gerado em ${fmtDateTime(new Date().toISOString())} · Contas a Pagar · Dra. Fernanda Sarelli
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
