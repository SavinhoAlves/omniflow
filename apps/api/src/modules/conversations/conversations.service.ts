import { prisma } from "@omnichannel/database";
import { Queue } from "bullmq";

function getRedisOptions() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(url);
  return { host: parsed.hostname, port: Number(parsed.port || 6379), password: parsed.password || undefined };
}

const baileysQueue = new Queue("baileys-commands", { connection: getRedisOptions() });

export class ConversationsService {
  async list(filters: {
    status?: "OPEN" | "RESOLVED";
    mine?: boolean;
    userId: string;
    departmentId?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.mine) where.assignedToId = filters.userId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.search) {
      where.contact = {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { phoneNumber: { contains: filters.search } },
        ],
      };
    }

    return prisma.conversation.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, phoneNumber: true, avatarUrl: true } },
        assignedTo: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, direction: true, type: true, createdAt: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });
  }

  async get(conversationId: string) {
    return prisma.conversation.findFirstOrThrow({
      where: { id: conversationId },
      include: {
        contact: true,
        assignedTo: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        instance: { select: { id: true, name: true, providerType: true, phoneNumber: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100,
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async getMessages(conversationId: string, before?: string) {
    // Verifica pertencimento ao tenant (companyId injetado pelo middleware em Conversation)
    await prisma.conversation.findFirstOrThrow({ where: { id: conversationId }, select: { id: true } });

    const where: any = { conversationId };
    if (before) where.createdAt = { lt: new Date(before) };
    return prisma.message.findMany({
      where,
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
  }

  async sendMessage(conversationId: string, authorId: string, content: string) {
    const conv = await prisma.conversation.findFirstOrThrow({
      where: { id: conversationId },
      include: {
        contact: { select: { phoneNumber: true } },
        instance: { select: { providerType: true } },
      },
    });

    const [message] = await Promise.all([
      prisma.message.create({
        data: { conversationId, direction: "OUTBOUND", type: "TEXT", content, authorId },
        include: { author: { select: { id: true, name: true } } },
      }),
      prisma.conversation.updateMany({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    if (conv.instance.providerType === "BAILEYS") {
      void baileysQueue
        .add("send_text", {
          instanceId: conv.instanceId,
          command: "send_text",
          payload: { to: conv.contact.phoneNumber, text: content },
        })
        .catch(() => {});
    }

    return message;
  }

  async assign(
    conversationId: string,
    data: { assignedToId?: string | null; departmentId?: string | null },
  ) {
    const [conv] = await Promise.all([
      prisma.conversation.updateMany({
        where: { id: conversationId },
        data: {
          assignedToId: data.assignedToId,
          departmentId: data.departmentId,
        },
      }),
      prisma.message.create({
        data: {
          conversationId,
          direction: "OUTBOUND",
          type: "SYSTEM",
          content:
            data.assignedToId !== undefined
              ? data.assignedToId
                ? "Conversa atribuída a um atendente."
                : "Atribuição removida."
              : "Departamento alterado.",
        },
      }),
    ]);
    return conv;
  }

  async changeStatus(conversationId: string, status: "OPEN" | "RESOLVED") {
    await Promise.all([
      prisma.conversation.updateMany({
        where: { id: conversationId },
        data: { status },
      }),
      prisma.message.create({
        data: {
          conversationId,
          direction: "OUTBOUND",
          type: "SYSTEM",
          content: status === "RESOLVED" ? "Conversa encerrada." : "Conversa reaberta.",
        },
      }),
    ]);
  }
}
