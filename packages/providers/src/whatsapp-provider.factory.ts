import { IWhatsAppProvider } from "./whatsapp-provider.interface";
import { MetaCloudApiProvider } from "./whatsapp/meta-cloud-api.provider";
import { EvolutionApiProvider } from "./whatsapp/evolution-api.provider";
import { BaileysProvider } from "./whatsapp/baileys.provider";
import { FacebookMessengerProvider } from "./messenger/facebook-messenger.provider";
import { InstagramProvider } from "./messenger/instagram.provider";

export type WhatsAppProviderType =
  | "BAILEYS"
  | "META_CLOUD_API"
  | "EVOLUTION_API"
  | "FACEBOOK_MESSENGER"
  | "INSTAGRAM";

/**
 * Único ponto que sabe instanciar cada provider. Todo o resto da
 * aplicação depende apenas de `IWhatsAppProvider`.
 *
 * `getCredentials` é injetado de fora (vem do WhatsAppService que
 * conhece Prisma e criptografia). Este pacote permanece puro.
 */
export class WhatsAppProviderFactory {
  constructor(
    private readonly deps: {
      getCredentials: (instanceId: string) => Promise<any>;
      baileysQueue: {
        enqueue: <T>(instanceId: string, command: string, payload?: unknown) => Promise<T>;
      };
    }
  ) {}

  get(providerType: WhatsAppProviderType): IWhatsAppProvider {
    switch (providerType) {
      case "META_CLOUD_API":
        return new MetaCloudApiProvider(this.deps.getCredentials);
      case "EVOLUTION_API":
        return new EvolutionApiProvider(this.deps.getCredentials);
      case "BAILEYS":
        return new BaileysProvider(this.deps.baileysQueue);
      case "FACEBOOK_MESSENGER":
        return new FacebookMessengerProvider(this.deps.getCredentials);
      case "INSTAGRAM":
        return new InstagramProvider(this.deps.getCredentials);
      default: {
        const _exhaustive: never = providerType;
        throw new Error(`Provider desconhecido: ${_exhaustive}`);
      }
    }
  }
}

export * from "./whatsapp-provider.interface";
