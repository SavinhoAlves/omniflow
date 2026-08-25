import { prisma, tenantStorage } from "@omnichannel/database";

interface ConversationContext {
  id: string;
  companyId: string;
  messages: Array<{ role: "user" | "assistant"; content: string; isInternal: boolean }>;
}

async function callClaude(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurado");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  return data.content[0]?.text ?? "";
}

async function loadConversationContext(conversationId: string, companyId: string): Promise<ConversationContext> {
  const messages = await tenantStorage.run({ companyId }, () =>
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { direction: true, content: true, isInternal: true },
    })
  );

  return {
    id: conversationId,
    companyId,
    messages: messages
      .filter((m) => m.content && !m.isInternal)
      .map((m) => ({
        role: m.direction === "OUTBOUND" ? "assistant" : "user",
        content: m.content!,
        isInternal: m.isInternal,
      })),
  };
}

function buildConversationTranscript(ctx: ConversationContext): string {
  return ctx.messages
    .map((m) => `${m.role === "user" ? "Cliente" : "Agente"}: ${m.content}`)
    .join("\n");
}

// T8.1: Reply suggestions
export async function suggestReplies(conversationId: string, companyId: string): Promise<string[]> {
  const ctx = await loadConversationContext(conversationId, companyId);
  if (ctx.messages.length === 0) return [];

  const transcript = buildConversationTranscript(ctx);
  const raw = await callClaude(
    "Você é um assistente de atendimento ao cliente em português brasileiro. Gere 3 sugestões de resposta curtas, empáticas e profissionais para o atendente enviar ao cliente. Responda APENAS com JSON: {\"replies\": [\"...\", \"...\", \"...\"]}",
    `Histórico:\n${transcript}\n\nGere 3 sugestões de resposta para o atendente.`
  );

  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    return Array.isArray(parsed.replies) ? parsed.replies.slice(0, 3) : [];
  } catch {
    return [];
  }
}

// T8.2: Auto-categorization
export async function categorize(conversationId: string, companyId: string): Promise<string> {
  const ctx = await loadConversationContext(conversationId, companyId);
  if (ctx.messages.length === 0) return "other";

  const transcript = buildConversationTranscript(ctx);
  const raw = await callClaude(
    'Categorize esta conversa em UMA das categorias: billing, support, sales, complaint, other. Responda APENAS com JSON: {"category": "..."}',
    `Conversa:\n${transcript}`
  );

  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const valid = ["billing", "support", "sales", "complaint", "other"];
    return valid.includes(parsed.category) ? parsed.category : "other";
  } catch {
    return "other";
  }
}

// T8.3: Sentiment analysis
export async function analyzeSentiment(conversationId: string, companyId: string): Promise<{ sentiment: string; score: number }> {
  const ctx = await loadConversationContext(conversationId, companyId);
  if (ctx.messages.length === 0) return { sentiment: "neutral", score: 0.5 };

  const transcript = buildConversationTranscript(ctx);
  const raw = await callClaude(
    'Analise o sentimento do CLIENTE nesta conversa. Responda APENAS com JSON: {"sentiment": "positive|neutral|negative", "score": 0.0-1.0}',
    `Conversa:\n${transcript}`
  );

  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const valid = ["positive", "neutral", "negative"];
    return {
      sentiment: valid.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : 0.5,
    };
  } catch {
    return { sentiment: "neutral", score: 0.5 };
  }
}

// T8.4: Conversation summary
export async function summarize(conversationId: string, companyId: string): Promise<string> {
  const ctx = await loadConversationContext(conversationId, companyId);
  if (ctx.messages.length === 0) return "";

  const transcript = buildConversationTranscript(ctx);
  const summary = await callClaude(
    "Gere um resumo conciso (2-3 frases) desta conversa de atendimento ao cliente em português, destacando o problema e a resolução (se houver).",
    `Conversa:\n${transcript}`
  );

  return summary.trim();
}

// Persist AI analysis results to DB
export async function analyzeAndPersist(conversationId: string, companyId: string) {
  const [suggestions, category, sentimentResult, summary] = await Promise.all([
    suggestReplies(conversationId, companyId),
    categorize(conversationId, companyId),
    analyzeSentiment(conversationId, companyId),
    summarize(conversationId, companyId),
  ]);

  await tenantStorage.run({ companyId }, () =>
    prisma.aiConversationMeta.upsert({
      where: { conversationId },
      create: {
        conversationId,
        sentiment: sentimentResult.sentiment,
        sentimentScore: sentimentResult.score,
        category,
        summary,
        suggestedReplies: suggestions as any,
        lastProcessedAt: new Date(),
      },
      update: {
        sentiment: sentimentResult.sentiment,
        sentimentScore: sentimentResult.score,
        category,
        summary,
        suggestedReplies: suggestions as any,
        lastProcessedAt: new Date(),
      },
    })
  );

  return { suggestions, category, sentiment: sentimentResult, summary };
}
