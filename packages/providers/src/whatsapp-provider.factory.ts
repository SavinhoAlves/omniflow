import { IWhatsAppProvider } from "./whatsapp-provider.interface";
import { MetaCloudApiProvider } from "./whatsapp/meta-cloud-api.provider";
import { EvolutionApiProvider } from "./whatsapp/evolution-api.provider";
import { BaileysProvider } from "./whatsapp/baileys.provider";

export type WhatsAppProviderType = "BAILEYS" | "META_CLOUD_API" | "EVOLUTION_API";

/**
 * Único ponto do sistema que sabe instanciar cada provider. Todo o
 * resto da aplicação (services, controllers) depende apenas de
 * `IWhatsAppProvider` — nunca importa uma implementação concreta
 * diretamente. Isso é o que torna trivial adicionar um provider novo
 * (Twilio, Gupshup, etc.) sem tocar em nenhum outro módulo.
 *
 * `getCredentials` e `queue` são injetados de fora (vêm da API/DI
 * container) porque este pacote (`packages/providers`) não deve
 * depender do Prisma nem do BullMQ diretamente — mantém o pacote
 * puro e testável isoladamente.
 */
export class WhatsAppProviderFactory {
  constructor(
    private readonly deps: {
      getMetaCredentials: (instanceId: string) => Promise<any>;
      getEvolutionCredentials: (instanceId: string) => Promise<any>;
      baileysQueue: { enqueue: <T>(instanceId: string, command: string, payload?: unknown) => Promise<T> };
    }
  ) {}

  get(providerType: WhatsAppProviderType): IWhatsAppProvider {
    switch (providerType) {
      case "META_CLOUD_API":
        return new MetaCloudApiProvider(this.deps.getMetaCredentials);
      case "EVOLUTION_API":
        return new EvolutionApiProvider(this.deps.getEvolutionCredentials);
      case "BAILEYS":
        return new BaileysProvider(this.deps.baileysQueue);
      default: {
        const _exhaustive: never = providerType;
        throw new Error(`Provider desconhecido: ${_exhaustive}`);
      }
    }
  }
}

export * from "./whatsapp-provider.interface";
