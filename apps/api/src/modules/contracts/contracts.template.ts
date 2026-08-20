interface ContractData {
  company: { name: string; cnpj: string | null; slug: string }
  plan: string
  value: number | null
  billingCycle: "MONTHLY" | "ANNUAL"
  startDate: Date
  endDate: Date | null
  notes: string | null
  signatureStatus: string
  signerName: string | null
  signedAt: Date | null
  signatureData: string | null
}

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function buildContractHtml(data: ContractData): string {
  const ciclo = data.billingCycle === "ANNUAL" ? "anual" : "mensal"
  const valor = data.value ? fmtMoney(Number(data.value)) : "A definir"
  const vigencia = data.endDate
    ? `de ${fmt(data.startDate)} a ${fmt(data.endDate)}`
    : `a partir de ${fmt(data.startDate)}, por prazo indeterminado`

  const signatureBlock =
    data.signatureStatus === "SIGNED_DIGITAL" && data.signatureData
      ? `
        <div class="sig-block">
          <p class="sig-label">Assinado digitalmente por:</p>
          <img src="${data.signatureData}" class="sig-img" alt="Assinatura digital" />
          <p class="sig-name">${data.signerName ?? ""}</p>
          <p class="sig-date">Data: ${data.signedAt ? fmt(data.signedAt) : ""}</p>
        </div>`
      : data.signatureStatus === "SIGNED_PHYSICAL"
      ? `
        <div class="sig-block">
          <p class="sig-label">Assinatura física confirmada por: ${data.signerName ?? ""}</p>
          <p class="sig-date">Data: ${data.signedAt ? fmt(data.signedAt) : ""}</p>
        </div>`
      : `
        <div class="sig-lines">
          <div class="sig-line">
            <div class="line"></div>
            <p>CONTRATANTE: ${data.company.name}</p>
          </div>
          <div class="sig-line">
            <div class="line"></div>
            <p>CONTRATADA: SavioAlves Tecnologia</p>
          </div>
        </div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Contrato de Prestação de Serviços — ${data.company.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", serif; font-size: 12pt; color: #000; background: #fff; line-height: 1.7; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px 60px; }
    h1 { font-size: 15pt; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 11pt; color: #555; margin-bottom: 28px; }
    .divider { border: none; border-top: 1.5px solid #000; margin: 18px 0; }
    .parties { background: #f7f7f7; border: 1px solid #ccc; border-radius: 4px; padding: 16px 20px; margin-bottom: 24px; }
    .parties h3 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .party { margin-bottom: 8px; }
    .party strong { display: inline-block; min-width: 120px; }
    .clause { margin-bottom: 20px; }
    .clause h3 { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .clause p { margin-bottom: 6px; text-align: justify; }
    .clause ul { padding-left: 24px; margin-top: 4px; }
    .clause ul li { margin-bottom: 4px; }
    .notes-box { background: #fffbe6; border: 1px solid #e6d100; border-radius: 4px; padding: 12px 16px; margin-bottom: 24px; font-size: 11pt; }
    .sig-lines { display: flex; gap: 48px; margin-top: 60px; padding-top: 24px; border-top: 1px solid #ccc; }
    .sig-line { flex: 1; text-align: center; font-size: 11pt; }
    .sig-line .line { border-top: 1px solid #000; margin-bottom: 6px; }
    .sig-block { margin-top: 48px; padding-top: 24px; border-top: 1px solid #ccc; text-align: center; }
    .sig-label { font-size: 11pt; color: #555; margin-bottom: 8px; }
    .sig-img { max-width: 240px; max-height: 80px; display: block; margin: 0 auto 8px; border-bottom: 1px solid #000; }
    .sig-name { font-size: 12pt; font-weight: bold; }
    .sig-date { font-size: 10pt; color: #555; margin-top: 4px; }
    .footer { margin-top: 40px; text-align: center; font-size: 9pt; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
    @media print {
      body { font-size: 11pt; }
      .page { padding: 20px 40px; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
<div class="page">
  <h1>Contrato de Prestação de Serviços de Tecnologia</h1>
  <p class="subtitle">Sistema de Ponto de Venda (PDV) — Plano ${data.plan}</p>
  <hr class="divider" />

  <div class="parties">
    <h3>Partes Contratantes</h3>
    <div class="party">
      <strong>CONTRATADA:</strong> SavioAlves Tecnologia · CNPJ: 00.000.000/0001-00
      <br />Endereço: [Endereço da empresa] · E-mail: suporte.savioalves@gmail.com
    </div>
    <div class="party">
      <strong>CONTRATANTE:</strong> ${data.company.name}
      ${data.company.cnpj ? `<br /><strong>CNPJ:</strong> ${data.company.cnpj}` : ""}
      <br /><strong>Identificador:</strong> ${data.company.slug}
    </div>
  </div>

  <div class="clause">
    <h3>Cláusula 1ª — Do Objeto</h3>
    <p>A CONTRATADA compromete-se a fornecer à CONTRATANTE o uso do sistema de Ponto de Venda (PDV)
    na modalidade SaaS (<em>Software as a Service</em>), denominado <strong>Restaurante PDV</strong>,
    incluindo acesso ao painel administrativo, suporte técnico de nível básico e atualizações de versão
    durante a vigência deste instrumento.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 2ª — Da Vigência</h3>
    <p>O presente contrato vigorará ${vigencia}, podendo ser renovado automaticamente por igual período,
    salvo manifestação contrária de qualquer das partes com antecedência mínima de 30 (trinta) dias.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 3ª — Do Valor e Forma de Pagamento</h3>
    <p>Pela prestação dos serviços descritos, a CONTRATANTE pagará à CONTRATADA o valor de
    <strong>${valor}</strong> por ciclo <strong>${ciclo}</strong>, a ser pago até o dia 10 de cada
    período de referência, por meio de transferência bancária, PIX ou boleto.</p>
    <p>O não pagamento no prazo acarretará multa de 2% sobre o valor em aberto, acrescida de juros
    de 1% ao mês, sem prejuízo da suspensão do acesso ao sistema.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 4ª — Das Obrigações da CONTRATADA</h3>
    <ul>
      <li>Manter o sistema disponível com SLA mínimo de 99% ao mês (exceto janelas de manutenção programada).</li>
      <li>Realizar backups periódicos dos dados da CONTRATANTE.</li>
      <li>Prestar suporte técnico por meio dos canais oficiais em dias úteis, das 8h às 18h.</li>
      <li>Notificar a CONTRATANTE com antecedência mínima de 48 horas sobre manutenções planejadas.</li>
    </ul>
  </div>

  <div class="clause">
    <h3>Cláusula 5ª — Das Obrigações da CONTRATANTE</h3>
    <ul>
      <li>Manter os dados de acesso (usuário e senha) em sigilo, sendo vedado o compartilhamento não autorizado.</li>
      <li>Efetuar os pagamentos nas datas acordadas.</li>
      <li>Utilizar o sistema exclusivamente para fins lícitos e dentro dos limites estabelecidos neste contrato.</li>
      <li>Notificar imediatamente a CONTRATADA sobre qualquer suspeita de uso indevido ou violação de segurança.</li>
    </ul>
  </div>

  <div class="clause">
    <h3>Cláusula 6ª — Da Propriedade Intelectual</h3>
    <p>O sistema e todos os seus componentes são de propriedade exclusiva da CONTRATADA.
    Este contrato confere à CONTRATANTE apenas o direito de uso do software, não implicando
    cessão de qualquer direito de propriedade intelectual.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 7ª — Da Confidencialidade e Proteção de Dados (LGPD)</h3>
    <p>As partes comprometem-se a tratar os dados pessoais eventualmente compartilhados em conformidade
    com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD), adotando as medidas técnicas e
    organizacionais necessárias para proteger as informações contra acessos não autorizados.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 8ª — Da Rescisão</h3>
    <p>Qualquer das partes poderá rescindir o presente contrato mediante notificação por escrito com
    antecedência mínima de 30 (trinta) dias. A rescisão por inadimplência da CONTRATANTE dispensa
    aviso prévio e não gera direito a restituição de valores pagos.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 9ª — Do Foro</h3>
    <p>Fica eleito o foro da comarca de [Cidade/UF] para dirimir quaisquer controvérsias oriundas
    deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
  </div>

  ${data.notes ? `<div class="notes-box"><strong>Observações adicionais:</strong> ${data.notes}</div>` : ""}

  ${signatureBlock}

  <p class="footer">
    Documento gerado em ${fmt(new Date())} · ${data.company.name} · Plano ${data.plan}
  </p>
</div>
</body>
</html>`
}
