import { prisma } from "@omnichannel/database";
import { WhatsAppProviderFactory, WhatsAppProviderType } from "@omnichannel/providers";
import { decryptCredentials } from "../../shared/credentials-crypto";
import { BaileysQueueClient } from "../whatsapp/baileys-queue.client";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class ConversationsService {
  private providerFactory: WhatsAppProviderFactory;
  private baileysQueue: BaileysQueueClient;

  constructor() {
    this.baileysQueue = new BaileysQueueClient();
    this.providerFactory = new WhatsAppProviderFactory({
      getCredentials: async (instanceId) => {
        const inst = await prisma.whatsAppInstance.findFirstOrThrow({
          where: { id: instanceId },
          select: { credentials: true },
        });
        if (!inst.credentials) throw new Error(`Instância ${instanceId} sem credenciais`);
        return decryptCredentials(inst.credentials as string);
      },
      baileysQueue: this.baileysQueue,
    });
  }

  async list(filters: {
    status?: "OPEN" | "RESOLVED" | "LEAD";
    mine?: boolean;
    userId: string;
    departmentId?: string;
    search?: string;
    canViewAll?: boolean;
    userDepartmentIds?: string[];
  }) {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.mine) {
      where.assignedToId = filters.userId;
    } else if (!filters.canViewAll) {
      // MEMBER: só vê conversas atribuídas a si ou não atribuídas no seu departamento
      if (filters.userDepartmentIds?.length) {
        where.OR = [
          { assignedToId: filters.userId },
          { assignedToId: null, departmentId: { in: filters.userDepartmentIds } },
        ];
      } else {
        where.assignedToId = filters.userId;
      }
    }
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

  private async assertMetaWindowOpen(conversationId: string) {
    const lastInbound = await prisma.message.findFirst({
      where: { conversationId, direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const expiry = lastInbound
      ? new Date(lastInbound.createdAt.getTime() + 24 * 60 * 60 * 1000)
      : null;
    if (!expiry || expiry < new Date()) {
      const err: any = new Error(
        "Janela de 24 horas encerrada. Aguarde o contato enviar uma mensagem ou utilize um template aprovado."
      );
      err.code = "WINDOW_CLOSED";
      err.statusCode = 422;
      throw err;
    }
  }

  async sendMessage(conversationId: string, authorId: string, content: string) {
    const conv = await prisma.conversation.findFirstOrThrow({
      where: { id: conversationId },
      include: {
        contact: { select: { phoneNumber: true } },
        instance: { select: { id: true, providerType: true } },
      },
    });

    if (conv.instance.providerType === "META_CLOUD_API") {
      await this.assertMetaWindowOpen(conversationId);
    }

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

    const provider = this.providerFactory.get(conv.instance.providerType as WhatsAppProviderType);
    void provider
      .sendTextMessage(conv.instance.id, { to: conv.contact.phoneNumber, text: content })
      .catch((err: Error) =>
        console.error(`[conversations] Falha ao enviar via ${conv.instance.providerType}:`, err.message)
      );

    return message;
  }

  async startConversation(input: {
    contactPhone: string;
    instanceId: string;
    departmentId?: string | null;
    assignedToId?: string | null;
    message?: string;
    templateName?: string;
    languageCode?: string;
    templateComponents?: any[];
    authorId: string;
  }) {
    const instance = await prisma.whatsAppInstance.findFirstOrThrow({
      where: { id: input.instanceId },
      select: { id: true, companyId: true, providerType: true, defaultDepartmentId: true },
    });

    const { companyId } = instance;

    const contact = await prisma.contact.upsert({
      where: { companyId_phoneNumber: { companyId, phoneNumber: input.contactPhone } },
      create: { companyId, phoneNumber: input.contactPhone, name: input.contactPhone },
      update: {},
    });

    const departmentId = input.departmentId ?? instance.defaultDepartmentId ?? undefined;

    let conversation = await prisma.conversation.findFirst({
      where: { companyId, contactId: contact.id, instanceId: input.instanceId, status: "OPEN" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          companyId,
          contactId: contact.id,
          instanceId: input.instanceId,
          departmentId: departmentId ?? undefined,
          assignedToId: input.assignedToId ?? undefined,
          lastMessageAt: new Date(),
        },
      });
    }

    if (input.templateName && instance.providerType === "META_CLOUD_API") {
      // Envio proativo via template aprovado (cumpliance Meta)
      const provider = this.providerFactory.get("META_CLOUD_API" as WhatsAppProviderType);
      void provider
        .sendTemplateMessage!(instance.id, {
          to: input.contactPhone,
          templateName: input.templateName,
          languageCode: input.languageCode ?? "pt_BR",
          components: input.templateComponents ?? [],
        })
        .catch((err: Error) =>
          console.error(`[conversations] Falha ao enviar template via Meta:`, err.message)
        );

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          type: "TEXT",
          content: `[Template: ${input.templateName}]`,
          authorId: input.authorId,
        },
      });
      await prisma.conversation.updateMany({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });
    } else if (input.message) {
      if (instance.providerType === "META_CLOUD_API") {
        const err: any = new Error(
          "Meta Cloud API não permite texto livre como primeira mensagem. Selecione um template aprovado."
        );
        err.code = "USE_TEMPLATE";
        err.statusCode = 422;
        throw err;
      }

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          type: "TEXT",
          content: input.message,
          authorId: input.authorId,
        },
      });

      await prisma.conversation.updateMany({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      const provider = this.providerFactory.get(instance.providerType as WhatsAppProviderType);
      void provider
        .sendTextMessage(instance.id, { to: input.contactPhone, text: input.message })
        .catch((err: Error) =>
          console.error(`[conversations] Falha ao iniciar conversa via ${instance.providerType}:`, err.message)
        );
    }

    return conversation;
  }

  async assign(
    conversationId: string,
    data: { assignedToId?: string | null; departmentId?: string | null },
  ) {
    // Ao transferir para um atendente específico enquanto OPEN → vai para os Leads dele
    const convData: any = { assignedToId: data.assignedToId, departmentId: data.departmentId };
    if (data.assignedToId) {
      const current = await prisma.conversation.findFirst({
        where: { id: conversationId }, select: { status: true },
      });
      if ((current?.status as string) === "OPEN") convData.status = "LEAD";
    }

    const systemMsg =
      data.departmentId !== undefined && data.assignedToId === undefined
        ? "Departamento alterado."
        : data.assignedToId
          ? "Conversa transferida para um atendente."
          : "Atribuição removida.";

    await Promise.all([
      prisma.conversation.updateMany({ where: { id: conversationId }, data: convData }),
      prisma.message.create({
        data: { conversationId, direction: "OUTBOUND", type: "SYSTEM", content: systemMsg },
      }),
    ]);
  }

  async deleteConversation(conversationId: string) {
    await prisma.conversation.deleteMany({ where: { id: conversationId } });
  }

  async sendMedia(
    conversationId: string,
    authorId: string,
    data: { data: string; mimeType: string; filename: string }
  ) {
    const conv = await prisma.conversation.findFirstOrThrow({
      where: { id: conversationId },
      include: {
        contact: { select: { phoneNumber: true } },
        instance: { select: { id: true, providerType: true } },
      },
    });

    if (conv.instance.providerType === "META_CLOUD_API") {
      await this.assertMetaWindowOpen(conversationId);
    }

    const ext = data.filename.split(".").pop() ?? "bin";
    const uniqueName = `${randomUUID()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const base64 = data.data.replace(/^data:[^;]+;base64,/, "");
    await fs.writeFile(path.join(uploadsDir, uniqueName), Buffer.from(base64, "base64"));

    const apiUrl = process.env.API_URL ?? "http://localhost:3333";
    const mediaUrl = `${apiUrl}/uploads/${uniqueName}`;

    const mimeType = data.mimeType;
    let mediaType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" = "DOCUMENT";
    if (mimeType.startsWith("image/")) mediaType = "IMAGE";
    else if (mimeType.startsWith("video/")) mediaType = "VIDEO";
    else if (mimeType.startsWith("audio/")) mediaType = "AUDIO";

    const [message] = await Promise.all([
      prisma.message.create({
        data: { conversationId, direction: "OUTBOUND", type: mediaType, mediaUrl, content: data.filename, authorId },
        include: { author: { select: { id: true, name: true } } },
      }),
      prisma.conversation.updateMany({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
    ]);

    if (conv.instance.providerType === "BAILEYS") {
      void this.baileysQueue.enqueue(conv.instance.id, "send_media", {
        to: conv.contact.phoneNumber,
        mediaUrl,
        mediaType: mediaType.toLowerCase() as "image" | "video" | "audio" | "document",
        caption: data.filename,
        ptt: mediaType === "AUDIO",
      }).catch((err: Error) =>
        console.error(`[conversations] Falha ao enviar mídia:`, err.message)
      );
    }

    return message;
  }

  async beginConversation(conversationId: string) {
    const conv = await prisma.conversation.findFirstOrThrow({
      where: { id: conversationId },
      select: { id: true, status: true },
    });

    if ((conv.status as string) !== "LEAD") {
      throw new Error(`Conversa não está em status LEAD (atual: ${conv.status})`);
    }

    // Publica job para o worker executar o bot e mudar status para OPEN
    const { Queue } = await import("bullmq");
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    const parsed = new URL(url);
    const queue = new Queue("begin-conversation", {
      connection: { host: parsed.hostname, port: Number(parsed.port || 6379), password: parsed.password || undefined },
    });
    await queue.add("begin", { conversationId });
    await queue.close();

    return { ok: true };
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
