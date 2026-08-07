import { prisma } from "@omnichannel/database";
import {
  WhatsAppProviderFactory,
  WhatsAppProviderType,
} from "@omnichannel/providers";
import type {
  SendMediaMessageInput,
  SendTemplateMessageInput,
  UploadMediaInput,
} from "@omnichannel/providers";
import { encryptCredentials, decryptCredentials } from "../../shared/credentials-crypto";
import { BaileysQueueClient } from "./baileys-queue.client";

export class WhatsAppService {
  private providerFactory: WhatsAppProviderFactory;

  constructor() {
    const baileysQueueClient = new BaileysQueueClient();
    this.providerFactory = new WhatsAppProviderFactory({
      getMetaCredentials: (instanceId) => this.getDecryptedCredentials(instanceId),
      getEvolutionCredentials: (instanceId) => this.getDecryptedCredentials(instanceId),
      baileysQueue: baileysQueueClient,
    });
  }

  async createInstance(input: {
    name: string;
    description?: string;
    providerType: WhatsAppProviderType;
    defaultDepartmentId?: string;
    credentials?: object;
  }) {
    return prisma.whatsAppInstance.create({
      data: {
        name: input.name,
        description: input.description,
        providerType: input.providerType,
        defaultDepartmentId: input.defaultDepartmentId,
        credentials: input.credentials ? encryptCredentials(input.credentials) : undefined,
      },
    });
  }

  async listInstances() {
    return prisma.whatsAppInstance.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        phoneNumber: true,
        providerType: true,
        connectionStatus: true,
        defaultDepartmentId: true,
        createdAt: true,
      },
    });
  }

  async connect(instanceId: string) {
    const instance = await prisma.whatsAppInstance.findFirstOrThrow({
      where: { id: instanceId },
    });
    const provider = this.providerFactory.get(instance.providerType as WhatsAppProviderType);
    const state = await provider.connect(instanceId);
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: { connectionStatus: state.status, qrCode: state.qrCode ?? null },
    });
    return state;
  }

  async sendTextMessage(instanceId: string, to: string, text: string) {
    const instance = await this.getInstanceOrThrow(instanceId);
    const provider = this.providerFactory.get(instance.providerType as WhatsAppProviderType);
    return provider.sendTextMessage(instanceId, { to, text });
  }

  // [Update 4] Envio de mídia
  async sendMediaMessage(instanceId: string, input: SendMediaMessageInput) {
    const instance = await this.getInstanceOrThrow(instanceId);
    const provider = this.providerFactory.get(instance.providerType as WhatsAppProviderType);
    return provider.sendMediaMessage(instanceId, input);
  }

  // [Update 4] Upload de mídia → media_id (suportado apenas pelo Meta)
  async uploadMedia(instanceId: string, input: UploadMediaInput) {
    const instance = await this.getInstanceOrThrow(instanceId);
    const provider = this.providerFactory.get(instance.providerType as WhatsAppProviderType);
    if (!provider.uploadMedia) {
      throw new Error(`O provider ${instance.providerType} não suporta upload de mídia`);
    }
    return provider.uploadMedia(instanceId, input);
  }

  // [Update 5] Templates HSM
  async sendTemplateMessage(instanceId: string, input: SendTemplateMessageInput) {
    const instance = await this.getInstanceOrThrow(instanceId);
    const provider = this.providerFactory.get(instance.providerType as WhatsAppProviderType);
    if (!provider.sendTemplateMessage) {
      throw new Error(`O provider ${instance.providerType} não suporta templates HSM`);
    }
    return provider.sendTemplateMessage(instanceId, input);
  }

  private async getInstanceOrThrow(instanceId: string) {
    return prisma.whatsAppInstance.findFirstOrThrow({ where: { id: instanceId } });
  }

  private async getDecryptedCredentials(instanceId: string): Promise<any> {
    const instance = await prisma.whatsAppInstance.findFirstOrThrow({
      where: { id: instanceId },
      select: { credentials: true },
    });
    if (!instance.credentials) {
      throw new Error(`Instância ${instanceId} não possui credenciais configuradas`);
    }
    return decryptCredentials(instance.credentials as string);
  }
}
