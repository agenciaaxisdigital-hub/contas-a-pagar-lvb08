import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReciboData {
  descricao: string;
  valor: number;
  categoria?: string | null;
  data_pagamento?: string | null;
  forma_pagamento?: string | null;
  chave_pix?: string | null;
  motivo: string;
  observacoes?: string | null;
  empresa_nome?: string;
  pago_por_nome?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtData = (d: string | null | undefined) => {
  // Se não tem data de pagamento, usa hoje (recibo gerado antes do pagamento)
  const dt = d
    ? (d.includes('T') ? new Date(d) : new Date(d + 'T00:00:00'))
    : new Date();
  try { return format(dt, 'dd/MM/yyyy', { locale: ptBR }); }
  catch { return d ?? format(new Date(), 'dd/MM/yyyy', { locale: ptBR }); }
};

// Valor por extenso — suporte até 999.999
function valorExtenso(valor: number): string {
  const inteiros = Math.floor(valor);
  const centavos = Math.round((valor - inteiros) * 100);

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cem', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
    'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const numToWords = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    if (n < 20) return unidades[n];
    if (n < 100) {
      const d = dezenas[Math.floor(n / 10)];
      const u = n % 10;
      return u === 0 ? d : `${d} e ${unidades[u]}`;
    }
    const c = centenas[Math.floor(n / 100)];
    const resto = n % 100;
    return resto === 0 ? c : `${c} e ${numToWords(resto)}`;
  };

  let resultado = '';
  if (inteiros >= 1000) {
    const mil = Math.floor(inteiros / 1000);
    const resto = inteiros % 1000;
    resultado = mil === 1 ? 'mil' : `${numToWords(mil)} mil`;
    if (resto > 0) resultado += ` e ${numToWords(resto)}`;
  } else {
    resultado = numToWords(inteiros);
  }

  const parteReais = inteiros === 1 ? `${resultado} real` : `${resultado} reais`;

  if (centavos === 0) return parteReais;
  const parteCentavos = centavos === 1
    ? `${numToWords(centavos)} centavo`
    : `${numToWords(centavos)} centavos`;
  return `${parteReais} e ${parteCentavos}`;
}

export function gerarReciboAssinatura(data: ReciboData) {
  const agora = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const dataRecibo = fmtData(data.data_pagamento); // hoje se ainda não pago
  const extenso = valorExtenso(data.valor);
  const empresaNome = data.empresa_nome ?? 'Agência Axis Digital';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Recibo — ${data.descricao}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Outfit', sans-serif; color: #1a1a2e; background: #fff; }

    .page { padding: 36px 48px; max-width: 760px; margin: 0 auto; }

    /* Header */
    .header { display: flex; align-items: center; gap: 14px; padding-bottom: 18px; border-bottom: 3px solid #3A3D42; margin-bottom: 22px; }
    .logo { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #3A3D42, #6B7280); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 14px; letter-spacing: 1px; flex-shrink: 0; }
    .header-text h1 { font-size: 17px; font-weight: 700; color: #1a1a2e; }
    .header-text p { font-size: 11px; color: #6B7280; margin-top: 1px; }
    .recibo-title { margin-left: auto; text-align: right; }
    .recibo-title h2 { font-size: 20px; font-weight: 800; color: #3A3D42; letter-spacing: 1px; text-transform: uppercase; }
    .recibo-title p { font-size: 10px; color: #9CA3AF; margin-top: 2px; }

    /* Valor destaque */
    .valor-box { background: #F9FAFB; border: 2px solid #3A3D42; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; }
    .valor-num { font-size: 30px; font-weight: 800; color: #3A3D42; }
    .valor-extenso { font-size: 12px; color: #6B7280; max-width: 55%; text-align: right; line-height: 1.4; font-style: italic; }

    /* Detalhes */
    .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #9CA3AF; margin-bottom: 10px; }
    .detail-row { display: flex; justify-content: space-between; align-items: baseline; padding: 7px 0; border-bottom: 1px solid #F3F4F6; font-size: 13px; }
    .detail-label { color: #6B7280; }
    .detail-value { font-weight: 600; color: #1a1a2e; text-align: right; max-width: 60%; }
    .mb-20 { margin-bottom: 20px; }

    /* Declaração */
    .declaracao { background: #F9FAFB; border-radius: 8px; padding: 14px 16px; font-size: 12.5px; line-height: 1.65; color: #374151; margin-bottom: 28px; border-left: 4px solid #3A3D42; }
    .declaracao strong { color: #1a1a2e; }

    /* Assinatura */
    .assinatura-box { border: 1.5px dashed #CBD5E1; border-radius: 12px; padding: 24px 28px; margin-bottom: 20px; }
    .assinatura-titulo { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #6B7280; margin-bottom: 20px; text-align: center; }
    .assinatura-linha { border-bottom: 1.5px solid #1a1a2e; margin-bottom: 6px; height: 40px; }
    .assinatura-campo-label { font-size: 10px; color: #9CA3AF; margin-bottom: 18px; }
    .campos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px; }
    .campo { flex: 1; }
    .campo-linha { border-bottom: 1.5px solid #6B7280; height: 28px; margin-bottom: 4px; }
    .campo-label { font-size: 10px; color: #9CA3AF; }

    /* Footer */
    .footer { text-align: center; font-size: 10px; color: #CBD5E1; padding-top: 16px; border-top: 1px solid #F3F4F6; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { padding: 20px 32px; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="logo">AX</div>
      <div class="header-text">
        <h1>${empresaNome}</h1>
        <p>Controle Financeiro</p>
      </div>
      <div class="recibo-title">
        <h2>Recibo de Pagamento</h2>
        <p>Emitido em ${agora}</p>
      </div>
    </div>

    <!-- Valor destaque -->
    <div class="valor-box">
      <div class="valor-num">${fmt(data.valor)}</div>
      <div class="valor-extenso">${extenso.charAt(0).toUpperCase() + extenso.slice(1)}</div>
    </div>

    <!-- Detalhes da conta -->
    <div class="mb-20">
      <div class="section-title">Detalhes do pagamento</div>
      <div class="detail-row">
        <span class="detail-label">Descrição</span>
        <span class="detail-value">${data.descricao}</span>
      </div>
      ${data.categoria ? `
      <div class="detail-row">
        <span class="detail-label">Categoria</span>
        <span class="detail-value">${data.categoria}</span>
      </div>` : ''}
      <div class="detail-row">
        <span class="detail-label">Data do pagamento</span>
        <span class="detail-value">${dataRecibo}</span>
      </div>
      ${data.forma_pagamento ? `
      <div class="detail-row">
        <span class="detail-label">Forma de pagamento</span>
        <span class="detail-value">${data.forma_pagamento}</span>
      </div>` : ''}
      ${data.chave_pix ? `
      <div class="detail-row">
        <span class="detail-label">Chave PIX</span>
        <span class="detail-value">${data.chave_pix}</span>
      </div>` : ''}
      <div class="detail-row">
        <span class="detail-label">Referente a</span>
        <span class="detail-value">${data.motivo}</span>
      </div>
      ${data.observacoes ? `
      <div class="detail-row">
        <span class="detail-label">Observações</span>
        <span class="detail-value">${data.observacoes}</span>
      </div>` : ''}
      ${data.pago_por_nome ? `
      <div class="detail-row">
        <span class="detail-label">Pago por</span>
        <span class="detail-value">${data.pago_por_nome}</span>
      </div>` : ''}
    </div>

    <!-- Declaração de recebimento -->
    <div class="declaracao">
      Recebi de <strong>${empresaNome}</strong>, na data de <strong>${dataRecibo}</strong>,
      a quantia de <strong>${fmt(data.valor)}</strong>
      (${extenso}), referente a <strong>${data.descricao}</strong>${data.motivo && data.motivo !== data.descricao ? ` — ${data.motivo}` : ''},
      ${data.forma_pagamento ? `pago via <strong>${data.forma_pagamento}</strong>${data.chave_pix ? ` (${data.chave_pix})` : ''},` : ''}
      dando plena e total quitação pelo valor acima recebido.
    </div>

    <!-- Campo de assinatura do recebedor -->
    <div class="assinatura-box">
      <div class="assinatura-titulo">✍ Assinatura do Recebedor</div>

      <div class="assinatura-linha"></div>
      <div class="assinatura-campo-label">Assinatura</div>

      <div class="campos-grid">
        <div class="campo">
          <div class="campo-linha"></div>
          <div class="campo-label">Nome completo</div>
        </div>
        <div class="campo">
          <div class="campo-linha"></div>
          <div class="campo-label">CPF / RG</div>
        </div>
        <div class="campo">
          <div class="campo-linha"></div>
          <div class="campo-label">Data de recebimento</div>
        </div>
        <div class="campo">
          <div class="campo-linha"></div>
          <div class="campo-label">Telefone / Contato</div>
        </div>
      </div>
    </div>

    <div class="footer">
      Documento gerado em ${agora} · ${empresaNome} · Contas a Pagar
    </div>

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
