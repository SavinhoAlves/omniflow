import { prisma } from "@omnichannel/database";
import {
  WhatsAppProviderFactory,
  WhatsAppProviderType,
} from "@omnichannel/providers";
import { encryptCredentials, decryptCredentials } from "../../shared/credentials-crypto";
import { BaileysQueueClient } from "./baileys-queue.client";

export class WhatsAppService {
  private providerFactory: WhatsAppProviderFactory;

  constructor() {
    const baileysQueueClient = new BaileysQueueClient();

    // Injeção das funções que buscam/decriptam credenciais por
    // instância — mantém `packages/providers` sem depender de
    // Prisma nem de detalhes de criptografia (ver
    // whatsapp-provider.factory.ts para o porquê).
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
    // companyId é injetado automaticamente pelo middleware do
    // Prisma — não precisa (e não deve) ser passado aqui.
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
        // `credentials` nunca é selecionado em listagens — só é
        // lido internamente por getDecryptedCredentials().
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
    const instance = await prisma.whatsAppInstance.findFirstOrThrow({
      where: { id: instanceId },
    });
    const provider = this.providerFactory.get(instance.providerType as WhatsAppProviderType);
    return provider.sendTextMessage(instanceId, { to, text });
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
