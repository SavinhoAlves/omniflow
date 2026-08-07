<template>
  <div>
    <div class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-white">Canais</h1>
        <p class="text-zinc-400 mt-2">
          Conecte números de WhatsApp para atender seus clientes por aqui.
        </p>
      </div>

      <button
        class="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500"
        @click="openCreateModal"
      >
        <Plus :size="18" />
        Novo canal
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="n in 3" :key="n" class="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <!-- Erro ao carregar -->
    <div v-else-if="loadError" class="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-red-300">
      <p class="font-medium">Não foi possível carregar os canais.</p>
      <p class="mt-1 text-sm text-red-300/70">{{ loadError }}</p>
      <button class="mt-4 text-sm font-medium underline underline-offset-2" @click="loadInstances">
        Tentar novamente
      </button>
    </div>

    <!-- Vazio -->
    <div
      v-else-if="instances.length === 0"
      class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 py-16 text-center"
    >
      <div class="mb-4 rounded-2xl bg-blue-500/10 p-4 text-blue-400">
        <MessageCircle :size="32" />
      </div>
      <h2 class="text-lg font-semibold text-white">Nenhum canal conectado ainda</h2>
      <p class="mt-1.5 max-w-sm text-sm text-zinc-500">
        Conecte um número de WhatsApp para começar a receber e responder conversas por aqui.
      </p>
      <button
        class="mt-6 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500"
        @click="openCreateModal"
      >
        <Plus :size="18" />
        Conectar canal
      </button>
    </div>

    <!-- Lista -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="instance in instances"
        :key="instance.id"
        class="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <div>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="font-semibold text-white">{{ instance.name }}</h3>
              <p v-if="instance.description" class="mt-0.5 text-sm text-zinc-500">
                {{ instance.description }}
              </p>
            </div>

            <span class="shrink-0 rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
              {{ providerLabel[instance.providerType] }}
            </span>
          </div>

          <div class="mt-4 flex items-center gap-2 text-sm">
            <span class="h-2 w-2 rounded-full" :class="statusDot[instance.connectionStatus]" />
            <span :class="statusText[instance.connectionStatus]">
              {{ statusLabel[instance.connectionStatus] }}
            </span>
          </div>

          <p v-if="instance.phoneNumber" class="mt-1 text-sm text-zinc-500">
            {{ instance.phoneNumber }}
          </p>
        </div>

        <button
          class="mt-6 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition"
          :class="instance.connectionStatus === 'CONNECTED'
            ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            : 'bg-green-600 text-white hover:bg-green-500'"
          :disabled="connectingId === instance.id"
          @click="connect(instance)"
        >
          <LoaderCircle v-if="connectingId === instance.id" :size="16" class="animate-spin" />
          {{ instance.connectionStatus === 'CONNECTED' ? 'Reconectar' : 'Conectar' }}
        </button>
      </div>
    </div>

    <!-- Modal: novo canal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="showCreateModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Novo canal</h2>
            <button class="text-zinc-500 hover:text-zinc-300" @click="showCreateModal = false">
              <X :size="20" />
            </button>
          </div>

          <form class="space-y-4" @submit.prevent="createInstance">
            <div>
              <label class="text-sm text-zinc-400">Nome do canal</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="Suporte, Vendas, Comercial…"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Provedor</label>
              <div class="mt-1.5 grid grid-cols-3 gap-2">
                <button
                  v-for="option in providerOptions"
                  :key="option.value"
                  type="button"
                  class="rounded-xl border px-2 py-2.5 text-xs font-medium transition"
                  :class="form.providerType === option.value
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'"
                  @click="form.providerType = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
              <p class="mt-1.5 text-xs text-zinc-600">
                {{ providerHint[form.providerType] }}
              </p>
            </div>

            <!-- Credenciais — só pra provedores que exigem token/API key -->
            <div v-if="form.providerType === 'META_CLOUD_API'" class="space-y-3">
              <input
                v-model="form.credentials.phoneNumberId"
                type="text"
                placeholder="Phone Number ID"
                class="w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
              <input
                v-model="form.credentials.accessToken"
                type="password"
                placeholder="Access Token"
                class="w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>

            <div v-else-if="form.providerType === 'EVOLUTION_API'" class="space-y-3">
              <input
                v-model="form.credentials.baseUrl"
                type="text"
                placeholder="URL da Evolution API"
                class="w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
              <input
                v-model="form.credentials.apiKey"
                type="password"
                placeholder="API Key"
                class="w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>

            <p v-if="createError" class="text-sm text-red-400">{{ createError }}</p>

            <button
              type="submit"
              :disabled="creating || !form.name.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LoaderCircle v-if="creating" :size="16" class="animate-spin" />
              Criar canal
            </button>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Modal: QR code -->
    <Teleport to="body">
      <div
        v-if="qrModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="qrModal = null"
      >
        <div class="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <h2 class="text-lg font-semibold text-white">Escaneie para conectar</h2>
          <p class="mt-1 text-sm text-zinc-500">
            WhatsApp no celular → Aparelhos conectados → Conectar aparelho
          </p>

          <div class="mt-6 flex justify-center">
            <img
              v-if="qrModal.imageUrl"
              :src="qrModal.imageUrl"
              alt="QR Code para conectar o WhatsApp"
              class="h-56 w-56 rounded-xl bg-white p-2"
            />
            <div v-else class="flex h-56 w-56 items-center justify-center rounded-xl bg-zinc-800">
              <LoaderCircle :size="24" class="animate-spin text-zinc-500" />
            </div>
          </div>

          <button
            class="mt-6 text-sm font-medium text-zinc-400 hover:text-zinc-200"
            @click="qrModal = null"
          >
            Fechar
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import { Plus, MessageCircle, LoaderCircle, X } from "lucide-vue-next"
import QRCode from "qrcode"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })

type ProviderType = "BAILEYS" | "META_CLOUD_API" | "EVOLUTION_API"
type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "CONNECTING" | "QR_PENDING" | "ERROR"

interface WhatsAppInstance {
  id: string
  name: string
  description?: string | null
  phoneNumber?: string | null
  providerType: ProviderType
  connectionStatus: ConnectionStatus
  defaultDepartmentId?: string | null
  createdAt: string
}

const api = useApi()

const instances = ref<WhatsAppInstance[]>([])
const loading = ref(true)
const loadError = ref("")

const providerLabel: Record<ProviderType, string> = {
  BAILEYS: "QR Code",
  META_CLOUD_API: "Meta Cloud API",
  EVOLUTION_API: "Evolution API",
}

const providerHint: Record<ProviderType, string> = {
  BAILEYS: "Conecta escaneando um QR Code, como o WhatsApp Web. Ideal pra começar rápido.",
  META_CLOUD_API: "API oficial da Meta. Exige um número verificado no Business Manager.",
  EVOLUTION_API: "Conecta a uma instância própria da Evolution API.",
}

const providerOptions: { value: ProviderType; label: string }[] = [
  { value: "BAILEYS", label: "QR Code" },
  { value: "META_CLOUD_API", label: "Meta Cloud" },
  { value: "EVOLUTION_API", label: "Evolution" },
]

const statusLabel: Record<ConnectionStatus, string> = {
  CONNECTED: "Conectado",
  DISCONNECTED: "Desconectado",
  CONNECTING: "Conectando…",
  QR_PENDING: "Aguardando leitura do QR Code",
  ERROR: "Erro na conexão",
}

const statusDot: Record<ConnectionStatus, string> = {
  CONNECTED: "bg-green-500",
  DISCONNECTED: "bg-zinc-600",
  CONNECTING: "bg-yellow-500 animate-pulse",
  QR_PENDING: "bg-yellow-500 animate-pulse",
  ERROR: "bg-red-500",
}

const statusText: Record<ConnectionStatus, string> = {
  CONNECTED: "text-green-400",
  DISCONNECTED: "text-zinc-500",
  CONNECTING: "text-yellow-400",
  QR_PENDING: "text-yellow-400",
  ERROR: "text-red-400",
}

async function loadInstances() {
  loading.value = true
  loadError.value = ""
  try {
    instances.value = await api<WhatsAppInstance[]>("/whatsapp/instances")
  } catch (err: any) {
    loadError.value = err?.data?.message ?? "Tente novamente em instantes."
  } finally {
    loading.value = false
  }
}

// --- Criar canal ---

const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref("")

function emptyForm() {
  return {
    name: "",
    providerType: "BAILEYS" as ProviderType,
    credentials: { phoneNumberId: "", accessToken: "", baseUrl: "", apiKey: "" },
  }
}

const form = reactive(emptyForm())

function openCreateModal() {
  Object.assign(form, emptyForm())
  createError.value = ""
  showCreateModal.value = true
}

async function createInstance() {
  creating.value = true
  createError.value = ""

  const credentials =
    form.providerType === "META_CLOUD_API"
      ? { phoneNumberId: form.credentials.phoneNumberId, accessToken: form.credentials.accessToken }
      : form.providerType === "EVOLUTION_API"
        ? { baseUrl: form.credentials.baseUrl, apiKey: form.credentials.apiKey }
        : undefined

  try {
    const created = await api<WhatsAppInstance>("/whatsapp/instances", {
      method: "POST",
      body: { name: form.name.trim(), providerType: form.providerType, credentials },
    })
    instances.value.unshift(created)
    showCreateModal.value = false
  } catch (err: any) {
    createError.value = err?.data?.message ?? "Não foi possível criar o canal."
  } finally {
    creating.value = false
  }
}

// --- Conectar / QR code ---

const connectingId = ref<string | null>(null)
const qrModal = ref<{ instanceId: string; imageUrl: string | null } | null>(null)

async function connect(instance: WhatsAppInstance) {
  connectingId.value = instance.id
  try {
    const state = await api<{ status: ConnectionStatus; qrCode?: string }>(
      `/whatsapp/instances/${instance.id}/connect`,
      { method: "POST" }
    )

    instance.connectionStatus = state.status

    if (state.status === "QR_PENDING" && state.qrCode) {
      qrModal.value = { instanceId: instance.id, imageUrl: null }
      const imageUrl = await QRCode.toDataURL(state.qrCode, { width: 448, margin: 1 })
      if (qrModal.value?.instanceId === instance.id) {
        qrModal.value.imageUrl = imageUrl
      }
      return
    }

    // Baileys pode demorar a emitir o QR — abre o modal com spinner e faz polling
    if (state.status === "CONNECTING" || state.status === "QR_PENDING") {
      qrModal.value = { instanceId: instance.id, imageUrl: null }

      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 2000))

        if (qrModal.value?.instanceId !== instance.id) break // usuário fechou o modal

        try {
          const poll = await api<{ status: ConnectionStatus; qrCode?: string }>(
            `/whatsapp/instances/${instance.id}/connect`,
            { method: "POST" }
          )

          instance.connectionStatus = poll.status

          if (poll.status === "CONNECTED") {
            qrModal.value = null
            break
          }

          if (poll.qrCode) {
            const imageUrl = await QRCode.toDataURL(poll.qrCode, { width: 448, margin: 1 })
            if (qrModal.value?.instanceId === instance.id) {
              qrModal.value.imageUrl = imageUrl
            }
            break
          }
        } catch {
          // continua tentando
        }
      }
    }
  } catch (err: any) {
    instance.connectionStatus = "ERROR"
  } finally {
    connectingId.value = null
  }
}

onMounted(loadInstances)
</script>
