<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <p class="text-sm text-zinc-500">
        {{ instances.length === 0
          ? 'Nenhum canal configurado ainda'
          : `${instances.length} canal${instances.length !== 1 ? 'is' : ''} configurado${instances.length !== 1 ? 's' : ''}` }}
      </p>
      <button
        class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        @click="openCreateModal"
      >
        <Plus :size="16" />
        Novo canal
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="n in 3" :key="n" class="h-48 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <!-- Erro -->
    <div v-else-if="loadError" class="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
      <p class="font-medium text-red-300">Não foi possível carregar os canais.</p>
      <p class="mt-1 text-sm text-red-300/70">{{ loadError }}</p>
      <button class="mt-4 text-sm font-medium text-red-400 underline underline-offset-2" @click="loadInstances">
        Tentar novamente
      </button>
    </div>

    <!-- Vazio -->
    <div
      v-else-if="instances.length === 0"
      class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 py-20 text-center"
    >
      <div class="mb-4 rounded-2xl bg-blue-500/10 p-4">
        <MessageCircle :size="32" class="text-blue-400" />
      </div>
      <h2 class="text-lg font-semibold text-white">Nenhum canal conectado ainda</h2>
      <p class="mt-2 max-w-sm text-sm text-zinc-500">
        Conecte um canal de mensagens para começar a receber e responder conversas por aqui.
      </p>
      <button
        class="mt-6 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
        @click="openCreateModal"
      >
        <Plus :size="16" />
        Conectar canal
      </button>
    </div>

    <!-- Lista agrupada por plataforma -->
    <template v-else>
      <template v-for="group in instanceGroups" :key="group.platform">
        <div class="mb-6">
          <div class="mb-3 flex items-center gap-2">
            <component :is="platformIcon[group.platform]" :size="14" :class="platformColor[group.platform]" />
            <h3 class="text-xs font-semibold uppercase tracking-wider" :class="platformColor[group.platform]">
              {{ platformLabel[group.platform] }}
            </h3>
            <span class="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{{ group.instances.length }}</span>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="instance in group.instances"
              :key="instance.id"
              class="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700"
            >
              <div class="flex items-start gap-3">
                <div class="mt-0.5 shrink-0 rounded-xl p-2.5" :class="providerIconBg[instance.providerType]">
                  <component :is="providerIcon[instance.providerType]" :size="18" :class="providerIconColor[instance.providerType]" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="truncate font-semibold text-white">{{ instance.name }}</h3>
                    <span class="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                      {{ providerLabel[instance.providerType] }}
                    </span>
                  </div>
                  <p v-if="instance.phoneNumber" class="mt-0.5 text-sm text-zinc-500">{{ instance.phoneNumber }}</p>
                  <p v-else-if="instance.description" class="mt-0.5 truncate text-sm text-zinc-500">{{ instance.description }}</p>
                </div>
              </div>

              <div class="mt-4 flex items-center gap-2 text-sm">
                <span class="h-2 w-2 shrink-0 rounded-full" :class="statusDot[instance.connectionStatus]" />
                <span :class="statusTextColor[instance.connectionStatus]">{{ statusLabel[instance.connectionStatus] }}</span>
              </div>

              <!-- Webhook URL para provedores baseados em webhook -->
              <div
                v-if="webhookProviders.has(instance.providerType) && instance.connectionStatus === 'CONNECTED'"
                class="mt-3 rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-3 py-2"
              >
                <p class="text-[11px] font-medium text-zinc-400">Webhook URL</p>
                <p class="mt-0.5 break-all font-mono text-[11px] text-zinc-500">
                  {{ webhookUrl(instance) }}
                </p>
              </div>

              <button
                class="mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition"
                :class="instance.connectionStatus === 'CONNECTED'
                  ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                  : 'bg-blue-600 text-white hover:bg-blue-500'"
                :disabled="connectingId === instance.id"
                @click="connect(instance)"
              >
                <LoaderCircle v-if="connectingId === instance.id" :size="15" class="animate-spin" />
                <template v-else>
                  <RefreshCw v-if="instance.connectionStatus === 'CONNECTED'" :size="15" />
                  <Plug v-else :size="15" />
                </template>
                {{ instance.connectionStatus === 'CONNECTED' ? 'Reconectar' : 'Conectar' }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- Modal: novo canal ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
        @click.self="showCreateModal = false"
      >
        <div class="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Novo canal</h2>
            <button class="text-zinc-500 transition hover:text-zinc-300" @click="showCreateModal = false">
              <X :size="20" />
            </button>
          </div>

          <form class="space-y-5" @submit.prevent="createInstance">
            <!-- Nome -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-zinc-400">Nome do canal</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="Suporte, Vendas, Comercial…"
                class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
              />
            </div>

            <!-- Plataforma -->
            <div>
              <label class="mb-2 block text-sm font-medium text-zinc-400">Plataforma</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="opt in providerOptions"
                  :key="opt.value"
                  type="button"
                  class="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition"
                  :class="form.providerType === opt.value
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'"
                  @click="form.providerType = opt.value"
                >
                  <component :is="providerIcon[opt.value]" :size="20" />
                  {{ opt.label }}
                </button>
              </div>
              <p class="mt-2 text-xs text-zinc-600">{{ providerHint[form.providerType] }}</p>
            </div>

            <!-- Credenciais: WhatsApp Meta Cloud API -->
            <template v-if="form.providerType === 'META_CLOUD_API'">
              <div class="space-y-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">Credenciais WhatsApp Business</p>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">Phone Number ID</label>
                  <input v-model="form.credentials.phoneNumberId" type="text" placeholder="123456789012345"
                    class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                  <p class="mt-1 text-[11px] text-zinc-600">Business Suite → Conta WhatsApp Business → Números de telefone</p>
                </div>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">WABA ID</label>
                  <input v-model="form.credentials.wabaId" type="text" placeholder="987654321098765"
                    class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">Access Token</label>
                  <div class="relative">
                    <input v-model="form.credentials.accessToken" :type="showToken ? 'text' : 'password'" placeholder="EAAxxxxxxxxxx…"
                      class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                    <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300" @click="showToken = !showToken">
                      <Eye v-if="!showToken" :size="15" /><EyeOff v-else :size="15" />
                    </button>
                  </div>
                </div>
                <div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <p class="mb-1 text-xs font-medium text-blue-400">Configure o Webhook após criar</p>
                  <p class="break-all font-mono text-[11px] text-blue-300 select-all">{{ config.public.apiUrl }}/whatsapp/webhook/meta?instanceId=<em class="text-blue-500">{id}</em></p>
                </div>
              </div>
            </template>

            <!-- Credenciais: Evolution API -->
            <template v-else-if="form.providerType === 'EVOLUTION_API'">
              <div class="space-y-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">Credenciais Evolution</p>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">URL da instância</label>
                  <input v-model="form.credentials.baseUrl" type="text" placeholder="https://evolution.meudominio.com"
                    class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">Nome da instância</label>
                  <input v-model="form.credentials.instanceName" type="text" placeholder="minha-instancia"
                    class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">API Key</label>
                  <input v-model="form.credentials.apiKey" type="password" placeholder="••••••••••••••••"
                    class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                </div>
              </div>
            </template>

            <!-- Credenciais: Facebook Messenger -->
            <template v-else-if="form.providerType === 'FACEBOOK_MESSENGER'">
              <div class="space-y-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">Credenciais Messenger</p>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">Page ID</label>
                  <input v-model="form.credentials.pageId" type="text" placeholder="123456789"
                    class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                  <p class="mt-1 text-[11px] text-zinc-600">ID numérico da sua Página do Facebook</p>
                </div>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">Page Access Token</label>
                  <div class="relative">
                    <input v-model="form.credentials.pageAccessToken" :type="showToken ? 'text' : 'password'" placeholder="EAAxxxxxxxxxx…"
                      class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                    <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300" @click="showToken = !showToken">
                      <Eye v-if="!showToken" :size="15" /><EyeOff v-else :size="15" />
                    </button>
                  </div>
                  <p class="mt-1 text-[11px] text-zinc-600">Token permanente gerado via System User no Business Manager</p>
                </div>
                <div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <p class="mb-1 text-xs font-medium text-blue-400">Configure o Webhook após criar</p>
                  <p class="mb-0.5 text-[11px] text-zinc-500">App → Webhooks → Page object → Subscribe a <strong class="text-zinc-300">messages</strong></p>
                  <p class="break-all font-mono text-[11px] text-blue-300 select-all">{{ config.public.apiUrl }}/messenger/webhook?instanceId=<em class="text-blue-500">{id}</em></p>
                </div>
              </div>
            </template>

            <!-- Credenciais: Instagram -->
            <template v-else-if="form.providerType === 'INSTAGRAM'">
              <div class="space-y-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">Credenciais Instagram</p>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">Page ID (Facebook)</label>
                  <input v-model="form.credentials.pageId" type="text" placeholder="123456789"
                    class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                  <p class="mt-1 text-[11px] text-zinc-600">Página do Facebook vinculada à conta Business do Instagram</p>
                </div>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">Instagram Account ID</label>
                  <input v-model="form.credentials.igAccountId" type="text" placeholder="987654321"
                    class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                  <p class="mt-1 text-[11px] text-zinc-600">ID da sua conta Business no Instagram</p>
                </div>
                <div>
                  <label class="mb-1 block text-xs text-zinc-500">Page Access Token</label>
                  <div class="relative">
                    <input v-model="form.credentials.pageAccessToken" :type="showToken ? 'text' : 'password'" placeholder="EAAxxxxxxxxxx…"
                      class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
                    <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300" @click="showToken = !showToken">
                      <Eye v-if="!showToken" :size="15" /><EyeOff v-else :size="15" />
                    </button>
                  </div>
                  <p class="mt-1 text-[11px] text-zinc-600">Requer permissão <code class="text-zinc-400">instagram_business_manage_messages</code></p>
                </div>
                <div class="rounded-xl border border-pink-500/20 bg-pink-500/5 p-3">
                  <p class="mb-1 text-xs font-medium text-pink-400">Configure o Webhook após criar</p>
                  <p class="mb-0.5 text-[11px] text-zinc-500">App → Webhooks → Instagram object → Subscribe a <strong class="text-zinc-300">messages</strong></p>
                  <p class="break-all font-mono text-[11px] text-pink-300 select-all">{{ config.public.apiUrl }}/messenger/webhook?instanceId=<em class="text-pink-500">{id}</em></p>
                </div>
              </div>
            </template>

            <p v-if="createError" class="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {{ createError }}
            </p>

            <button
              type="submit"
              :disabled="creating || !form.name.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LoaderCircle v-if="creating" :size="16" class="animate-spin" />
              {{ creating ? 'Criando…' : 'Criar canal' }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Modal: QR Code ────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="qrModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        @click.self="closeQrModal"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-semibold text-white">Conectar via QR Code</h2>
            <button class="text-zinc-500 transition hover:text-zinc-300" @click="closeQrModal">
              <X :size="18" />
            </button>
          </div>

          <div v-if="qrModal.connected" class="flex flex-col items-center py-8 text-center">
            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle :size="36" class="text-green-400" />
            </div>
            <p class="text-lg font-semibold text-white">WhatsApp conectado!</p>
            <p class="mt-1 text-sm text-zinc-500">O canal está pronto para receber mensagens.</p>
          </div>

          <div v-else-if="qrModal.error" class="flex flex-col items-center py-8 text-center">
            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <AlertCircle :size="36" class="text-red-400" />
            </div>
            <p class="text-lg font-semibold text-white">Falha na conexão</p>
            <p class="mt-1 text-sm text-zinc-500">{{ qrModal.error }}</p>
            <button class="mt-5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-500" @click="regenQr">
              Tentar novamente
            </button>
          </div>

          <template v-else>
            <ol class="mb-5 space-y-2 text-sm text-zinc-400">
              <li class="flex items-start gap-2.5">
                <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">1</span>
                Abra o <span class="font-medium text-white">WhatsApp</span> no celular
              </li>
              <li class="flex items-start gap-2.5">
                <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">2</span>
                <span class="font-medium text-white">⋮</span> → <span class="font-medium text-white">Aparelhos conectados</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">3</span>
                <span class="font-medium text-white">Conectar um aparelho</span> e aponte para o QR Code
              </li>
            </ol>

            <div class="flex justify-center">
              <div class="relative flex h-60 w-60 items-center justify-center overflow-hidden rounded-2xl bg-white p-2">
                <img v-if="qrModal.imageUrl" :src="qrModal.imageUrl" alt="QR Code" class="h-full w-full object-contain" />
                <div v-else class="flex flex-col items-center gap-2 text-zinc-400">
                  <LoaderCircle :size="28" class="animate-spin text-zinc-400" />
                  <span class="text-xs">Gerando QR…</span>
                </div>
                <div v-if="qrModal.countdown <= 10 && qrModal.countdown > 0 && qrModal.imageUrl"
                  class="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/60">
                  <p class="text-3xl font-bold text-white">{{ qrModal.countdown }}</p>
                  <p class="text-xs text-zinc-300">QR expirando</p>
                </div>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between text-sm">
              <div class="flex items-center gap-2 text-zinc-400">
                <span class="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                Aguardando leitura…
              </div>
              <div v-if="qrModal.countdown > 0" class="flex items-center gap-1 text-zinc-500">
                <Timer :size="13" />
                <span>{{ qrModal.countdown }}s</span>
              </div>
            </div>

            <div class="mt-4 flex items-center gap-3">
              <button class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700" @click="regenQr">
                <RefreshCw :size="14" /> Gerar novo QR
              </button>
              <button class="flex-1 rounded-xl py-2 text-sm text-zinc-500 transition hover:text-zinc-300" @click="closeQrModal">
                Cancelar
              </button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from "vue"
import {
  Plus, MessageCircle, LoaderCircle, X, Smartphone, Globe, Server,
  RefreshCw, Plug, Eye, EyeOff, CheckCircle, AlertCircle, Timer,
  Facebook, Instagram,
} from "lucide-vue-next"
import QRCode from "qrcode"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })

const config = useRuntimeConfig()

type ProviderType = "BAILEYS" | "META_CLOUD_API" | "EVOLUTION_API" | "FACEBOOK_MESSENGER" | "INSTAGRAM"
type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "CONNECTING" | "QR_PENDING" | "ERROR"
type Platform = "whatsapp" | "messenger" | "instagram"

interface ChannelInstance {
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
const instances = ref<ChannelInstance[]>([])
const loading = ref(true)
const loadError = ref("")

async function loadInstances() {
  loading.value = true
  loadError.value = ""
  try {
    instances.value = await api<ChannelInstance[]>("/whatsapp/instances")
  } catch (err: any) {
    loadError.value = err?.data?.message ?? "Tente novamente em instantes."
  } finally {
    loading.value = false
  }
}

// ── Metadados por provider ───────────────────────────────────────────────────

const providerLabel: Record<ProviderType, string> = {
  BAILEYS:            "QR Code",
  META_CLOUD_API:     "Meta API",
  EVOLUTION_API:      "Evolution",
  FACEBOOK_MESSENGER: "Messenger",
  INSTAGRAM:          "Instagram",
}

const providerHint: Record<ProviderType, string> = {
  BAILEYS:            "Conecta escaneando um QR Code, como o WhatsApp Web. Ideal para começar rápido sem aprovação da Meta.",
  META_CLOUD_API:     "API oficial da Meta para WhatsApp Business. Requer número verificado e aprovação.",
  EVOLUTION_API:      "Conecta a uma instância Evolution API auto-hospedada.",
  FACEBOOK_MESSENGER: "Receba e responda mensagens da sua Página do Facebook via Messenger.",
  INSTAGRAM:          "Receba e responda mensagens diretas do Instagram Business.",
}

const providerOptions: { value: ProviderType; label: string }[] = [
  { value: "BAILEYS",            label: "WA QR Code"  },
  { value: "META_CLOUD_API",     label: "WA Meta API" },
  { value: "EVOLUTION_API",      label: "Evolution"   },
  { value: "FACEBOOK_MESSENGER", label: "Messenger"   },
  { value: "INSTAGRAM",          label: "Instagram"   },
]

const providerIcon: Record<ProviderType, any> = {
  BAILEYS:            Smartphone,
  META_CLOUD_API:     Globe,
  EVOLUTION_API:      Server,
  FACEBOOK_MESSENGER: Facebook,
  INSTAGRAM:          Instagram,
}

const providerIconBg: Record<ProviderType, string> = {
  BAILEYS:            "bg-blue-500/10",
  META_CLOUD_API:     "bg-green-500/10",
  EVOLUTION_API:      "bg-purple-500/10",
  FACEBOOK_MESSENGER: "bg-blue-600/10",
  INSTAGRAM:          "bg-pink-500/10",
}

const providerIconColor: Record<ProviderType, string> = {
  BAILEYS:            "text-blue-400",
  META_CLOUD_API:     "text-green-400",
  EVOLUTION_API:      "text-purple-400",
  FACEBOOK_MESSENGER: "text-blue-500",
  INSTAGRAM:          "text-pink-400",
}

const statusLabel: Record<ConnectionStatus, string> = {
  CONNECTED:    "Conectado",
  DISCONNECTED: "Desconectado",
  CONNECTING:   "Conectando…",
  QR_PENDING:   "Aguardando QR Code",
  ERROR:        "Erro na conexão",
}

const statusDot: Record<ConnectionStatus, string> = {
  CONNECTED:    "bg-green-500",
  DISCONNECTED: "bg-zinc-600",
  CONNECTING:   "bg-yellow-500 animate-pulse",
  QR_PENDING:   "bg-yellow-500 animate-pulse",
  ERROR:        "bg-red-500",
}

const statusTextColor: Record<ConnectionStatus, string> = {
  CONNECTED:    "text-green-400",
  DISCONNECTED: "text-zinc-500",
  CONNECTING:   "text-yellow-400",
  QR_PENDING:   "text-yellow-400",
  ERROR:        "text-red-400",
}

// Providers que recebem mensagens via webhook (precisam de URL)
const webhookProviders = new Set<ProviderType>(["META_CLOUD_API", "FACEBOOK_MESSENGER", "INSTAGRAM"])

function webhookUrl(instance: ChannelInstance) {
  const base = config.public.apiUrl as string
  if (instance.providerType === "META_CLOUD_API") {
    return `${base}/whatsapp/webhook/meta?instanceId=${instance.id}`
  }
  return `${base}/messenger/webhook?instanceId=${instance.id}`
}

// ── Agrupamento por plataforma ───────────────────────────────────────────────

const PROVIDER_PLATFORM: Record<ProviderType, Platform> = {
  BAILEYS:            "whatsapp",
  META_CLOUD_API:     "whatsapp",
  EVOLUTION_API:      "whatsapp",
  FACEBOOK_MESSENGER: "messenger",
  INSTAGRAM:          "instagram",
}

const platformLabel: Record<Platform, string> = {
  whatsapp:  "WhatsApp",
  messenger: "Facebook Messenger",
  instagram: "Instagram",
}

const platformIcon: Record<Platform, any> = {
  whatsapp:  MessageCircle,
  messenger: Facebook,
  instagram: Instagram,
}

const platformColor: Record<Platform, string> = {
  whatsapp:  "text-green-500",
  messenger: "text-blue-500",
  instagram: "text-pink-400",
}

const instanceGroups = computed(() => {
  const map = new Map<Platform, ChannelInstance[]>()
  for (const inst of instances.value) {
    const plat = PROVIDER_PLATFORM[inst.providerType]
    if (!map.has(plat)) map.set(plat, [])
    map.get(plat)!.push(inst)
  }
  // Ordem fixa: WhatsApp → Messenger → Instagram
  const order: Platform[] = ["whatsapp", "messenger", "instagram"]
  return order.filter((p) => map.has(p)).map((p) => ({ platform: p, instances: map.get(p)! }))
})

// ── Modal de criação ─────────────────────────────────────────────────────────

const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref("")
const showToken = ref(false)

function emptyForm() {
  return {
    name: "",
    providerType: "BAILEYS" as ProviderType,
    credentials: {
      // WhatsApp Meta
      phoneNumberId: "", wabaId: "", accessToken: "",
      // Evolution
      baseUrl: "", instanceName: "", apiKey: "",
      // Messenger / Instagram
      pageId: "", pageAccessToken: "", igAccountId: "",
    },
  }
}

const form = reactive(emptyForm())

function openCreateModal() {
  Object.assign(form, emptyForm())
  showToken.value = false
  createError.value = ""
  showCreateModal.value = true
}

async function createInstance() {
  creating.value = true
  createError.value = ""

  let credentials: object | undefined
  if (form.providerType === "META_CLOUD_API") {
    credentials = {
      phoneNumberId: form.credentials.phoneNumberId,
      wabaId: form.credentials.wabaId,
      accessToken: form.credentials.accessToken,
    }
  } else if (form.providerType === "EVOLUTION_API") {
    credentials = {
      baseUrl: form.credentials.baseUrl,
      instanceName: form.credentials.instanceName,
      apiKey: form.credentials.apiKey,
    }
  } else if (form.providerType === "FACEBOOK_MESSENGER") {
    credentials = {
      pageId: form.credentials.pageId,
      pageAccessToken: form.credentials.pageAccessToken,
    }
  } else if (form.providerType === "INSTAGRAM") {
    credentials = {
      pageId: form.credentials.pageId,
      igAccountId: form.credentials.igAccountId,
      pageAccessToken: form.credentials.pageAccessToken,
    }
  }

  try {
    const created = await api<ChannelInstance>("/whatsapp/instances", {
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

// ── QR Code modal ─────────────────────────────────────────────────────────────

interface QrModalState {
  instanceId: string
  imageUrl: string | null
  rawQr: string | null
  countdown: number
  connected: boolean
  error: string
}

const qrModal = ref<QrModalState | null>(null)
let qrPollTimer: ReturnType<typeof setInterval> | null = null
let qrCountdownTimer: ReturnType<typeof setInterval> | null = null

function stopQrTimers() {
  if (qrPollTimer)    { clearInterval(qrPollTimer);    qrPollTimer = null }
  if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null }
}

function closeQrModal() { stopQrTimers(); qrModal.value = null }

async function setQrImage(rawQr: string) {
  return QRCode.toDataURL(rawQr, { width: 448, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
}

async function openQrModal(instanceId: string, rawQr: string) {
  stopQrTimers()
  const imageUrl = await setQrImage(rawQr)
  qrModal.value = { instanceId, imageUrl, rawQr, countdown: 60, connected: false, error: "" }

  qrCountdownTimer = setInterval(() => {
    if (!qrModal.value) return
    qrModal.value.countdown--
    if (qrModal.value.countdown <= 0) regenQr()
  }, 1000)

  qrPollTimer = setInterval(async () => {
    if (!qrModal.value) return
    try {
      const state = await api<{ status: ConnectionStatus; qrCode?: string }>(
        `/whatsapp/instances/${instanceId}/connect`, { method: "POST" }
      )
      if (!qrModal.value) return
      if (state.status === "CONNECTED") {
        stopQrTimers(); qrModal.value.connected = true
        setTimeout(async () => { closeQrModal(); await loadInstances() }, 1800)
        return
      }
      if (state.status === "ERROR") {
        stopQrTimers(); qrModal.value.error = "Falha ao estabelecer conexão."
        return
      }
      if (state.qrCode && state.qrCode !== qrModal.value.rawQr) {
        const newImage = await setQrImage(state.qrCode)
        if (qrModal.value) { qrModal.value.imageUrl = newImage; qrModal.value.rawQr = state.qrCode; qrModal.value.countdown = 60 }
      }
    } catch {}
  }, 3000)
}

async function regenQr() {
  if (!qrModal.value) return
  const instanceId = qrModal.value.instanceId
  qrModal.value.imageUrl = null; qrModal.value.error = ""
  if (qrModal.value.countdown <= 0) qrModal.value.countdown = 0
  try {
    const state = await api<{ status: ConnectionStatus; qrCode?: string }>(
      `/whatsapp/instances/${instanceId}/connect`, { method: "POST" }
    )
    if (!qrModal.value) return
    if (state.status === "CONNECTED") {
      stopQrTimers(); qrModal.value.connected = true
      setTimeout(async () => { closeQrModal(); await loadInstances() }, 1800)
      return
    }
    if (state.qrCode) {
      const newImage = await setQrImage(state.qrCode)
      if (qrModal.value) { qrModal.value.imageUrl = newImage; qrModal.value.rawQr = state.qrCode; qrModal.value.countdown = 60 }
    }
  } catch {
    if (qrModal.value) qrModal.value.error = "Não foi possível gerar um novo QR Code."
  }
}

// ── Connect ───────────────────────────────────────────────────────────────────

const connectingId = ref<string | null>(null)

async function connect(instance: ChannelInstance) {
  connectingId.value = instance.id
  try {
    let state = await api<{ status: ConnectionStatus; qrCode?: string }>(
      `/whatsapp/instances/${instance.id}/connect`, { method: "POST" }
    )
    instance.connectionStatus = state.status

    if (instance.providerType === "BAILEYS") {
      let rawQr = state.qrCode
      let attempts = 0
      while (!rawQr && (state.status === "CONNECTING" || state.status === "QR_PENDING") && attempts < 10) {
        await new Promise((r) => setTimeout(r, 1500))
        try {
          const check = await api<{ status: ConnectionStatus; qrCode?: string }>(
            `/whatsapp/instances/${instance.id}/connect`, { method: "POST" }
          )
          state = check; instance.connectionStatus = check.status; rawQr = check.qrCode
        } catch {}
        attempts++
      }
      if (rawQr) await openQrModal(instance.id, rawQr)
      else if (state.status === "CONNECTED") await loadInstances()
    } else {
      if (state.status === "CONNECTED") await loadInstances()
    }
  } catch {
    instance.connectionStatus = "ERROR"
  } finally {
    connectingId.value = null
  }
}

onMounted(loadInstances)
onBeforeUnmount(stopQrTimers)
</script>
