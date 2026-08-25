import {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
  proto,
} from "@whiskeysockets/baileys";
import { prisma, tenantStorage } from "@omnichannel/database";

// Workers always run with platform privilege — no tenant context needed.
async function runPlatform<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ isPlatform: true }, fn);
}

function serialize(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data, BufferJSON.replacer));
}

function deserialize(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data), BufferJSON.reviver);
}

/**
 * Drop-in replacement for Baileys' useMultiFileAuthState that persists
 * auth credentials and signal keys in PostgreSQL (bailey_sessions and
 * bailey_session_keys tables) instead of the local filesystem.
 *
 * This ensures session survives container restarts — critical for
 * multi-tenant production deployments.
 */
export async function useDatabaseAuthState(instanceId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearSession: () => Promise<void>;
}> {
  // Upsert the session record; create if first connect.
  const sessionRecord = await runPlatform(() =>
    prisma.baileySession.upsert({
      where: { instanceId },
      create: { instanceId },
      update: {},
      select: { id: true, creds: true },
    })
  );

  const creds: AuthenticationCreds = sessionRecord.creds
    ? (deserialize(sessionRecord.creds) as AuthenticationCreds)
    : initAuthCreds();

  const saveCreds = async () => {
    await runPlatform(() =>
      prisma.baileySession.update({
        where: { instanceId },
        data: { creds: serialize(creds) as any },
      })
    );
  };

  const clearSession = async () => {
    await runPlatform(() =>
      prisma.baileySession.deleteMany({ where: { instanceId } })
    );
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const records = await runPlatform(() =>
          prisma.baileySessionKey.findMany({
            where: {
              sessionId: sessionRecord.id,
              keyType: type,
              keyId: { in: ids },
            },
            select: { keyId: true, value: true },
          })
        );

        const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        for (const r of records) {
          let value = deserialize(r.value);
          // app-state-sync-key values must be deserialized as protobuf objects
          if (type === "app-state-sync-key" && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(
              value as object
            );
          }
          data[r.keyId] = value as SignalDataTypeMap[typeof type];
        }
        return data;
      },

      set: async (data) => {
        const ops: Promise<unknown>[] = [];
        for (const [type, typeData] of Object.entries(data)) {
          for (const [id, value] of Object.entries(
            typeData as Record<string, unknown>
          )) {
            if (value != null) {
              ops.push(
                runPlatform(() =>
                  prisma.baileySessionKey.upsert({
                    where: {
                      sessionId_keyType_keyId: {
                        sessionId: sessionRecord.id,
                        keyType: type,
                        keyId: id,
                      },
                    },
                    create: {
                      sessionId: sessionRecord.id,
                      keyType: type,
                      keyId: id,
                      value: serialize(value) as any,
                    },
                    update: { value: serialize(value) as any },
                  })
                )
              );
            } else {
              // null/undefined → delete the key from the store
              ops.push(
                runPlatform(() =>
                  prisma.baileySessionKey.deleteMany({
                    where: {
                      sessionId: sessionRecord.id,
                      keyType: type,
                      keyId: id,
                    },
                  })
                )
              );
            }
          }
        }
        await Promise.all(ops);
      },
    },
  };

  return { state, saveCreds, clearSession };
}
