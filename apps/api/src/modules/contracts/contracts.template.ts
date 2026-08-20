// ─── Dados da CONTRATADA ────────────────────────────────────────────────────
// Atualize estes campos com os dados reais da sua empresa antes de ir para produção.
const CONTRATADA = {
  razaoSocial:      "SavioAlves Tecnologia LTDA ME",
  nomeFantasia:     "OmniFlow Systems",
  cnpj:             "45.678.901/0001-23",
  inscricaoEstadual:"Isento",
  endereco:         "Rua das Flores, 256, Sala 04",
  bairro:           "Setor Bueno",
  cidade:           "Goiânia",
  uf:               "GO",
  cep:              "74.210-050",
  telefone:         "(62) 9 9912-3456",
  email:            "suporte.savioalves@gmail.com",
  site:             "www.omniflow.com.br",
  representante:    "Sávio Ferreira Alves",
  cpfRepresentante: "123.456.789-00",
  rgRepresentante:  "1.234.567 SSP/GO",
  cargoRepresentante: "Administrador",
  foroCidade:       "Goiânia",
  foroUF:           "GO",
}
// ────────────────────────────────────────────────────────────────────────────

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
  const ciclo    = data.billingCycle === "ANNUAL" ? "anual" : "mensal"
  const cicloExt = data.billingCycle === "ANNUAL" ? "12 (doze) meses" : "30 (trinta) dias"
  const valor    = data.value ? fmtMoney(Number(data.value)) : "a definir em aditivo"
  const vigencia = data.endDate
    ? `de ${fmt(data.startDate)} a ${fmt(data.endDate)}`
    : `a partir de ${fmt(data.startDate)}, por prazo indeterminado`

  const signatureBlock =
    data.signatureStatus === "SIGNED_DIGITAL" && data.signatureData
      ? `<div class="sig-block">
          <p class="sig-label">Assinado digitalmente por:</p>
          <img src="${data.signatureData}" class="sig-img" alt="Assinatura digital" />
          <p class="sig-name">${data.signerName ?? ""}</p>
          <p class="sig-date">Data: ${data.signedAt ? fmt(data.signedAt) : ""}</p>
        </div>`
      : data.signatureStatus === "SIGNED_PHYSICAL"
      ? `<div class="sig-block">
          <p class="sig-label">Assinatura física confirmada em sistema por: <strong>${data.signerName ?? ""}</strong></p>
          <p class="sig-date">Data de confirmação: ${data.signedAt ? fmt(data.signedAt) : ""}</p>
        </div>`
      : `<div class="sig-section">
          <p class="sig-city">Goiânia/GO, _______ de __________________ de _______</p>
          <div class="sig-lines">
            <div class="sig-line">
              <div class="line"></div>
              <p class="sig-name-label">${data.company.name}</p>
              <p class="sig-role-label">CONTRATANTE</p>
            </div>
            <div class="sig-line">
              <div class="line"></div>
              <p class="sig-name-label">${CONTRATADA.representante}</p>
              <p class="sig-role-label">CONTRATADA — ${CONTRATADA.cargoRepresentante}</p>
            </div>
          </div>
          <div class="witness-lines">
            <p class="witness-title">Testemunhas:</p>
            <div class="sig-lines">
              <div class="sig-line">
                <div class="line"></div>
                <p class="sig-role-label">Nome: ___________________________ CPF: ___________________</p>
              </div>
              <div class="sig-line">
                <div class="line"></div>
                <p class="sig-role-label">Nome: ___________________________ CPF: ___________________</p>
              </div>
            </div>
          </div>
        </div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Contrato de Prestação de Serviços — ${data.company.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", serif; font-size: 12pt; color: #111; background: #fff; line-height: 1.8; }
    .page { max-width: 820px; margin: 0 auto; padding: 48px 64px; }

    /* Cabeçalho */
    .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #111; padding-bottom: 20px; }
    .header h1 { font-size: 14pt; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; }
    .header .subtitle { font-size: 11pt; color: #444; margin-top: 4px; }
    .header .doc-num { font-size: 9.5pt; color: #777; margin-top: 6px; font-style: italic; }

    /* Partes */
    .parties { margin-bottom: 28px; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
    .parties-title { background: #f0f0f0; border-bottom: 1px solid #ccc; padding: 8px 16px; font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .party { padding: 12px 16px; font-size: 10.5pt; }
    .party + .party { border-top: 1px solid #eee; }
    .party-role { font-weight: bold; font-size: 10pt; text-transform: uppercase; color: #333; display: block; margin-bottom: 4px; letter-spacing: 0.5px; }
    .party-line { margin: 1px 0; }
    .party-line strong { display: inline-block; min-width: 160px; font-size: 10pt; }

    /* Cláusulas */
    .clause { margin-bottom: 22px; }
    .clause h3 { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.3px; }
    .clause p { margin-bottom: 8px; text-align: justify; font-size: 11pt; }
    .clause ol, .clause ul { padding-left: 28px; margin-top: 4px; }
    .clause ol li, .clause ul li { margin-bottom: 5px; text-align: justify; font-size: 11pt; }
    .clause .paragrafo { margin-top: 6px; font-size: 11pt; text-align: justify; }
    .clause .paragrafo::before { content: "Parágrafo único. "; font-weight: bold; }

    /* Observações */
    .notes-box { background: #fffbe6; border-left: 3px solid #e6c000; padding: 12px 16px; margin-bottom: 28px; font-size: 10.5pt; }

    /* Assinaturas */
    .sig-section { margin-top: 56px; padding-top: 20px; border-top: 1px solid #ccc; }
    .sig-city { font-size: 11pt; margin-bottom: 48px; text-align: right; }
    .sig-lines { display: flex; gap: 56px; margin-bottom: 32px; }
    .sig-line { flex: 1; text-align: center; }
    .sig-line .line { border-top: 1px solid #333; margin-bottom: 6px; }
    .sig-name-label { font-size: 10.5pt; font-weight: bold; }
    .sig-role-label { font-size: 9.5pt; color: #555; margin-top: 2px; }
    .witness-lines { margin-top: 8px; }
    .witness-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; margin-bottom: 28px; letter-spacing: 0.3px; }

    /* Assinatura digital/física */
    .sig-block { margin-top: 48px; padding-top: 24px; border-top: 1px solid #ccc; text-align: center; }
    .sig-label { font-size: 10.5pt; color: #555; margin-bottom: 10px; }
    .sig-img { max-width: 260px; max-height: 90px; display: block; margin: 0 auto 8px; border-bottom: 1px solid #333; }
    .sig-name { font-size: 12pt; font-weight: bold; }
    .sig-date { font-size: 10pt; color: #666; margin-top: 4px; }

    /* Rodapé */
    .footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 8.5pt; color: #999; }

    @media print {
      body { font-size: 11pt; }
      .page { padding: 0; }
      @page { margin: 2.5cm 2cm; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <h1>Contrato de Prestação de Serviços de Tecnologia</h1>
    <p class="subtitle">Modalidade SaaS — Sistema de Ponto de Venda · Plano <strong>${data.plan}</strong></p>
    <p class="doc-num">Ref.: ${data.company.slug.toUpperCase()}-${new Date(data.startDate).getFullYear()}</p>
  </div>

  <div class="parties">
    <div class="parties-title">Partes Contratantes</div>

    <div class="party">
      <span class="party-role">Contratada</span>
      <p class="party-line"><strong>Razão Social:</strong> ${CONTRATADA.razaoSocial}</p>
      <p class="party-line"><strong>Nome Fantasia:</strong> ${CONTRATADA.nomeFantasia}</p>
      <p class="party-line"><strong>CNPJ:</strong> ${CONTRATADA.cnpj} &nbsp;|&nbsp; <strong>Insc. Estadual:</strong> ${CONTRATADA.inscricaoEstadual}</p>
      <p class="party-line"><strong>Endereço:</strong> ${CONTRATADA.endereco}, ${CONTRATADA.bairro}, ${CONTRATADA.cidade}/${CONTRATADA.uf} — CEP ${CONTRATADA.cep}</p>
      <p class="party-line"><strong>Telefone:</strong> ${CONTRATADA.telefone} &nbsp;|&nbsp; <strong>E-mail:</strong> ${CONTRATADA.email}</p>
      <p class="party-line"><strong>Representante:</strong> ${CONTRATADA.representante}, CPF ${CONTRATADA.cpfRepresentante}, RG ${CONTRATADA.rgRepresentante}</p>
    </div>

    <div class="party">
      <span class="party-role">Contratante</span>
      <p class="party-line"><strong>Razão Social / Nome:</strong> ${data.company.name}</p>
      ${data.company.cnpj ? `<p class="party-line"><strong>CNPJ / CPF:</strong> ${data.company.cnpj}</p>` : `<p class="party-line"><strong>CNPJ / CPF:</strong> ___________________________________</p>`}
      <p class="party-line"><strong>Endereço:</strong> ___________________________________________________________</p>
      <p class="party-line"><strong>Bairro:</strong> _________________________ <strong>Cidade/UF:</strong> _______________________</p>
      <p class="party-line"><strong>Telefone:</strong> _________________________ <strong>E-mail:</strong> _______________________________</p>
      <p class="party-line"><strong>Representante:</strong> _________________________________ <strong>CPF:</strong> _____________________</p>
    </div>
  </div>

  <div class="clause">
    <h3>Cláusula 1ª — Do Objeto</h3>
    <p>O presente instrumento tem por objeto a prestação de serviços de tecnologia pela CONTRATADA
    à CONTRATANTE, consistindo no licenciamento de uso do sistema de Ponto de Venda (PDV)
    <strong>Restaurante PDV</strong>, na modalidade <em>Software as a Service</em> (SaaS), plano
    <strong>${data.plan}</strong>, compreendendo:</p>
    <ol>
      <li>Acesso ao sistema via navegador web, com suporte a múltiplos dispositivos;</li>
      <li>Painel administrativo para gestão de produtos, mesas, pedidos e caixa;</li>
      <li>Atualizações de versão disponibilizadas automaticamente durante a vigência;</li>
      <li>Suporte técnico nos canais e horários definidos na Cláusula 4ª;</li>
      <li>Armazenamento dos dados do CONTRATANTE em ambiente seguro com backups periódicos.</li>
    </ol>
  </div>

  <div class="clause">
    <h3>Cláusula 2ª — Da Vigência</h3>
    <p>O presente contrato vigorará ${vigencia}, renovando-se automaticamente por períodos sucessivos de
    ${cicloExt}, salvo notificação de não renovação por qualquer das partes, realizada com antecedência
    mínima de 30 (trinta) dias antes do término do período vigente, por e-mail ou notificação escrita.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 3ª — Do Valor e Forma de Pagamento</h3>
    <p>Pela prestação dos serviços descritos, a CONTRATANTE pagará à CONTRATADA o valor de
    <strong>${valor}</strong> por ciclo <strong>${ciclo}</strong>, com vencimento no dia
    <strong>10 (dez)</strong> de cada período de referência.</p>
    <p>São aceitos os seguintes meios de pagamento: PIX, transferência bancária (TED/DOC) ou boleto bancário.</p>
    <p class="paragrafo">O não pagamento até a data de vencimento acarretará multa moratória de 2% (dois por cento)
    sobre o valor em aberto, acrescida de juros de mora de 1% (um por cento) ao mês, calculados pro rata die,
    além de correção monetária pelo IGPM/FGV, sem prejuízo da suspensão imediata do acesso ao sistema após
    10 (dez) dias de inadimplência.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 4ª — Das Obrigações da Contratada</h3>
    <p>Compete à CONTRATADA:</p>
    <ol>
      <li>Garantir a disponibilidade do sistema com SLA mínimo de 99% (noventa e nove por cento) ao mês,
      excluídas janelas de manutenção programada comunicadas com antecedência;</li>
      <li>Realizar backups automáticos dos dados da CONTRATANTE com frequência mínima diária;</li>
      <li>Prestar suporte técnico de segunda a sexta-feira, das 08h às 18h (horário de Brasília),
      por meio de e-mail (${CONTRATADA.email}) e WhatsApp (${CONTRATADA.telefone});</li>
      <li>Comunicar à CONTRATANTE, com antecedência mínima de 48 (quarenta e oito) horas, as
      manutenções programadas que impliquem indisponibilidade do sistema;</li>
      <li>Manter a confidencialidade dos dados da CONTRATANTE, não os compartilhando com terceiros,
      salvo por determinação legal ou judicial.</li>
    </ol>
  </div>

  <div class="clause">
    <h3>Cláusula 5ª — Das Obrigações da Contratante</h3>
    <p>Compete à CONTRATANTE:</p>
    <ol>
      <li>Manter em sigilo as credenciais de acesso ao sistema, sendo integralmente responsável
      por uso indevido decorrente de compartilhamento não autorizado;</li>
      <li>Efetuar os pagamentos nas datas e condições acordadas neste instrumento;</li>
      <li>Utilizar o sistema exclusivamente para fins lícitos, em conformidade com a legislação
      brasileira e com os termos deste contrato;</li>
      <li>Notificar a CONTRATADA, imediatamente, sobre qualquer suspeita de violação de segurança,
      acesso não autorizado ou uso indevido do sistema;</li>
      <li>Manter seus dados cadastrais atualizados junto à CONTRATADA.</li>
    </ol>
  </div>

  <div class="clause">
    <h3>Cláusula 6ª — Da Propriedade Intelectual</h3>
    <p>O sistema <strong>Restaurante PDV</strong> e todos os seus componentes — incluindo código-fonte,
    interfaces, algoritmos, documentação e marca — são de propriedade exclusiva da CONTRATADA, protegidos
    pela Lei nº 9.609/1998 (Lei de Software) e pela Lei nº 9.610/1998 (Lei de Direitos Autorais).</p>
    <p class="paragrafo">Este contrato confere à CONTRATANTE licença de uso não exclusiva, intransferível
    e revogável do software, pelo período de vigência contratual. Não implica cessão, transferência ou
    sublicenciamento de quaisquer direitos de propriedade intelectual.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 7ª — Da Confidencialidade e Proteção de Dados (LGPD)</h3>
    <p>As partes comprometem-se a tratar os dados pessoais eventualmente compartilhados em estrita
    conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD),
    adotando medidas técnicas e organizacionais adequadas para proteger as informações contra
    acesso não autorizado, destruição, perda, alteração ou divulgação indevida.</p>
    <p>A CONTRATADA atuará como <em>operadora</em> dos dados inseridos pela CONTRATANTE no sistema,
    processando-os exclusivamente para as finalidades previstas neste contrato. A CONTRATANTE,
    na qualidade de <em>controladora</em>, é responsável pela legalidade do tratamento de dados
    de seus clientes e colaboradores dentro do sistema.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 8ª — Da Limitação de Responsabilidade</h3>
    <p>A CONTRATADA não será responsabilizada por danos indiretos, lucros cessantes ou perda de
    dados decorrentes de:</p>
    <ol>
      <li>Uso inadequado do sistema pela CONTRATANTE ou por terceiros com acesso autorizado por ela;</li>
      <li>Falhas de infraestrutura de terceiros (internet, energia elétrica, provedores de nuvem);</li>
      <li>Eventos de força maior ou caso fortuito, conforme o art. 393 do Código Civil Brasileiro;</li>
      <li>Manutenções programadas devidamente comunicadas.</li>
    </ol>
    <p class="paragrafo">Em qualquer hipótese, a responsabilidade máxima da CONTRATADA fica limitada
    ao valor pago pela CONTRATANTE nos últimos 3 (três) meses de vigência do contrato.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 9ª — Da Rescisão</h3>
    <p>Este contrato poderá ser rescindido:</p>
    <ol>
      <li><strong>Por qualquer das partes</strong>, mediante notificação escrita com antecedência
      mínima de 30 (trinta) dias, sem ônus ou penalidades;</li>
      <li><strong>Por inadimplência</strong> da CONTRATANTE, após decorridos 10 (dez) dias do
      vencimento sem pagamento, independentemente de notificação prévia, não gerando direito
      a restituição de valores já pagos;</li>
      <li><strong>Por descumprimento contratual</strong> de qualquer das partes, após notificação
      e prazo de 5 (cinco) dias úteis para regularização.</li>
    </ol>
    <p class="paragrafo">Rescindido o contrato, a CONTRATADA manterá os dados da CONTRATANTE
    disponíveis para exportação por 30 (trinta) dias, após os quais poderão ser definitivamente
    excluídos.</p>
  </div>

  <div class="clause">
    <h3>Cláusula 10ª — Das Disposições Gerais</h3>
    <ol>
      <li>Este contrato constitui o acordo integral entre as partes, substituindo quaisquer
      entendimentos anteriores sobre o mesmo objeto;</li>
      <li>Qualquer alteração deste instrumento somente terá validade se formalizada por escrito
      e assinada por ambas as partes;</li>
      <li>A tolerância de uma das partes em relação ao descumprimento de qualquer cláusula não
      constituirá novação ou renúncia ao direito de exigi-la futuramente;</li>
      <li>Caso qualquer disposição deste contrato seja considerada inválida, as demais permanecerão
      em pleno vigor.</li>
    </ol>
  </div>

  <div class="clause">
    <h3>Cláusula 11ª — Do Foro</h3>
    <p>Fica eleito o foro da Comarca de <strong>${CONTRATADA.foroCidade}/${CONTRATADA.foroUF}</strong>
    para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia expressa a qualquer
    outro, por mais privilegiado que seja, ressalvados os casos em que a legislação imponha foro
    diverso de forma imperativa.</p>
  </div>

  ${data.notes ? `<div class="notes-box"><strong>Condições específicas / Observações:</strong><br/>${data.notes}</div>` : ""}

  ${signatureBlock}

  <div class="footer">
    <span>${CONTRATADA.razaoSocial} · CNPJ ${CONTRATADA.cnpj}</span>
    <span>Documento gerado em ${fmt(new Date())} · ${data.company.name} · Plano ${data.plan}</span>
  </div>

</div>
</body>
</html>`
}
