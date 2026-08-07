<template>
  <div class="flex h-full overflow-hidden">
    <!-- ============================================================
         Painel esquerdo — lista de conversas
    ============================================================ -->
    <div class="w-72 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-900/50">
      <!-- Header + Busca -->
      <div class="border-b border-zinc-800">
        <div class="flex items-center justify-between px-4 pb-2.5 pt-4">
          <h2 class="text-sm font-semibold text-white">Conversas</h2>
          <span
            v-if="openCount > 0"
            class="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums"
          >
            {{ openCount }}
          </span>
        </div>
        <div class="px-3 pb-3">
          <div class="relative">
            <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              v-model="search"
              type="search"
              placeholder="Buscar conversa..."
              class="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-8 pr-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      <!-- Abas -->
      <div class="flex gap-1 border-b border-zinc-800 px-3 py-2">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          class="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors"
          :class="activeTab === tab.value ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-400'"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Lista -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="listLoading && conversations.length === 0" class="space-y-3 p-4">
          <div v-for="i in 5" :key="i" class="flex animate-pulse gap-3">
            <div class="h-10 w-10 shrink-0 rounded-full bg-zinc-800" />
            <div class="flex-1 space-y-1.5">
              <div class="h-3 w-3/4 rounded bg-zinc-800" />
              <div class="h-2.5 w-1/2 rounded bg-zinc-800" />
            </div>
          </div>
        </div>

        <p v-else-if="conversations.length === 0" class="mt-12 text-center text-sm text-zinc-600">
          Nenhuma conversa encontrada.
        </p>

        <button
          v-for="conv in conversations"
          :key="conv.id"
          class="relative w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-zinc-800/40 hover:bg-zinc-800/40"
          :class="[
            activeConversationId === conv.id ? 'bg-zinc-800/70' : '',
            conv.status === 'RESOLVED' && activeConversationId !== conv.id ? 'opacity-50' : '',
          ]"
          @click="selectConversation(conv.id)"
        >
          <span v-if="activeConversationId === conv.id" class="absolute inset-y-0 left-0 w-0.5 rounded-r bg-blue-500" />
          <div
            class="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold"
            :style="{ background: avatarGradient(conv.contact.name ?? conv.contact.phoneNumber) }"
          >
            {{ initials(conv.contact.name ?? conv.contact.phoneNumber) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <p
                class="text-sm font-medium truncate"
                :class="conv.status === 'RESOLVED' ? 'text-zinc-500' : 'text-zinc-100'"
              >
                {{ conv.contact.name || conv.contact.phoneNumber }}
              </p>
              <span class="shrink-0 text-[10px] text-zinc-600">{{ formatTime(conv.lastMessageAt) }}</span>
            </div>
            <div class="mt-0.5 flex items-center gap-1">
              <CheckCheck
                v-if="conv.messages?.[0]?.direction === 'OUTBOUND' && conv.status === 'OPEN'"
                :size="12"
                class="shrink-0 text-blue-400"
              />
              <p class="truncate text-xs text-zinc-500">{{ conv.messages?.[0]?.content || 'Nova conversa' }}</p>
            </div>
          </div>
          <span v-if="conv.status === 'OPEN'" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <CheckCircle v-else :size="13" class="mt-0.5 shrink-0 text-zinc-600" />
        </button>
      </div>
    </div>

    <!-- ============================================================
         Painel central — chat
    ============================================================ -->
    <div v-if="activeConversation" class="flex flex-1 flex-col min-w-0">
      <!-- Header -->
      <div class="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-zinc-800 bg-zinc-900/60">
        <div
          class="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold"
          :style="{ background: avatarGradient(activeConversation.contact.name ?? activeConversation.contact.phoneNumber) }"
        >
          {{ initials(activeConversation.contact.name ?? activeConversation.contact.phoneNumber) }}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-semibold text-white truncate leading-tight">
              {{ activeConversation.contact.name || activeConversation.contact.phoneNumber }}
            </p>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
              :class="activeConversation.status === 'OPEN'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-zinc-700/50 text-zinc-500'"
            >
              {{ activeConversation.status === 'OPEN' ? 'Aberta' : 'Resolvida' }}
            </span>
          </div>
          <p class="text-xs text-zinc-500 truncate leading-tight">
            {{ activeConversation.contact.phoneNumber }}
            <span v-if="activeConversation.assignedTo"> · {{ activeConversation.assignedTo.name }}</span>
            <span v-if="activeConversation.department"> · {{ activeConversation.department.name }}</span>
          </p>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            v-if="activeConversation.status === 'OPEN'"
            class="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
            :disabled="statusChanging"
            @click="changeStatus('RESOLVED')"
          >
            <CheckCircle :size="13" />
            Resolver
          </button>
          <button
            v-else
            class="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
            :disabled="statusChanging"
            @click="changeStatus('OPEN')"
          >
            <RotateCcw :size="13" />
            Reabrir
          </button>

          <button
            class="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            :class="showInfoPanel ? 'bg-zinc-800 text-zinc-300' : ''"
            :title="showInfoPanel ? 'Fechar painel' : 'Abrir painel de detalhes'"
            @click="showInfoPanel = !showInfoPanel"
          >
            <PanelRight :size="16" />
          </button>
        </div>
      </div>

      <!-- Mensagens -->
      <div ref="messagesContainerRef" class="flex-1 overflow-y-auto p-5 space-y-2 bg-[#0d1117]">
        <template v-for="(msg, i) in messages" :key="msg.id">
          <div v-if="showDateSeparator(msg, messages[i - 1])" class="my-1 flex items-center gap-2 py-2">
            <div class="h-px flex-1 bg-zinc-800" />
            <span class="px-2 text-[10px] font-medium text-zinc-600">{{ formatDate(msg.createdAt) }}</span>
            <div class="h-px flex-1 bg-zinc-800" />
          </div>

          <div v-if="msg.type === 'SYSTEM'" class="flex justify-center py-1">
            <span class="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-[11px] italic text-zinc-500">
              {{ msg.content }}
            </span>
          </div>

          <div v-else-if="msg.direction === 'INBOUND'" class="flex justify-start">
            <div class="max-w-[72%] min-w-0 rounded-2xl rounded-bl-sm bg-[#1c2128] px-3.5 py-2.5 shadow-sm">
              <p class="text-sm text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
              <p class="mt-1 text-right text-[10px] text-zinc-500">{{ formatMessageTime(msg.createdAt) }}</p>
            </div>
          </div>

          <div v-else class="flex justify-end">
            <div class="max-w-[72%] min-w-0 rounded-2xl rounded-br-sm bg-blue-600 px-3.5 py-2.5 shadow-sm">
              <p class="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
              <div class="mt-1 flex items-center justify-end gap-1">
                <p class="text-[10px] text-blue-200">{{ formatMessageTime(msg.createdAt) }}</p>
                <CheckCheck :size="10" class="shrink-0 text-blue-200" />
              </div>
            </div>
          </div>
        </template>
        <div ref="scrollAnchorRef" />
      </div>

      <!-- Input -->
      <div class="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-3">
        <div v-if="activeConversation.status === 'RESOLVED'" class="flex items-center justify-center gap-2 py-2 text-xs text-zinc-500">
          <CheckCircle :size="13" class="text-zinc-600" />
          Conversa encerrada —
          <button class="text-blue-400 transition hover:text-blue-300" @click="changeStatus('OPEN')">
            Reabrir para responder
          </button>
        </div>
        <div v-else class="flex items-end gap-2">
          <textarea
            v-model="inputText"
            rows="1"
            placeholder="Digite uma mensagem…"
            class="flex-1 min-h-[40px] max-h-32 resize-none overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
            @keydown.enter.exact.prevent="sendMessage"
            @input="autoResize"
          />
          <button
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!inputText.trim() || sending"
            @click="sendMessage"
          >
            <Send :size="16" class="text-white" />
          </button>
        </div>
        <p v-if="activeConversation.status === 'OPEN'" class="mt-1.5 text-right text-[10px] text-zinc-700">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>

    <!-- Estado vazio -->
    <div v-else class="flex flex-1 flex-col items-center justify-center gap-4 bg-[#0d1117] px-8 text-center">
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
        <MessageSquare :size="26" class="text-zinc-600" />
      </div>
      <div class="space-y-1">
        <p class="text-sm font-medium text-zinc-400">Nenhuma conversa selecionada</p>
        <p class="text-xs text-zinc-600">Escolha uma conversa na lista ao lado para começar a atender</p>
      </div>
    </div>

    <!-- ============================================================
         Painel direito — detalhes e ações
    ============================================================ -->
    <div
      v-if="activeConversation && showInfoPanel"
      class="w-64 shrink-0 flex flex-col border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto"
    >
      <!-- Contato -->
      <div class="p-4 border-b border-zinc-800">
        <p class="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Contato</p>
        <div class="flex items-center gap-3">
          <div
            class="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold"
            :style="{ background: avatarGradient(activeConversation.contact.name ?? activeConversation.contact.phoneNumber) }"
          >
            {{ initials(activeConversation.contact.name ?? activeConversation.contact.phoneNumber) }}
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-white">
              {{ activeConversation.contact.name || activeConversation.contact.phoneNumber }}
            </p>
            <p class="text-xs text-zinc-500">{{ activeConversation.contact.phoneNumber }}</p>
          </div>
        </div>
      </div>

      <!-- Atribuição -->
      <div class="p-4 border-b border-zinc-800 space-y-3">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Atribuição</p>
        <div>
          <p class="mb-0.5 text-[10px] text-zinc-600">Atendente</p>
          <p class="text-sm text-zinc-300">{{ activeConversation.assignedTo?.name || '—' }}</p>
        </div>
        <div>
          <p class="mb-0.5 text-[10px] text-zinc-600">Departamento</p>
          <p class="text-sm text-zinc-300">{{ activeConversation.department?.name || '—' }}</p>
        </div>
        <button
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
          @click="openTransfer"
        >
          <ArrowRightLeft :size="13" />
          Transferir conversa
        </button>
      </div>

      <!-- Canal -->
      <div class="p-4 border-b border-zinc-800">
        <p class="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Canal</p>
        <div class="flex items-center gap-2.5">
          <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <MessageSquare :size="13" class="text-emerald-400" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm text-zinc-300">{{ activeConversation.instance?.name || 'WhatsApp' }}</p>
            <p class="text-[10px] text-zinc-600">WhatsApp</p>
          </div>
        </div>
      </div>

      <!-- Ações -->
      <div class="p-4 space-y-2">
        <p class="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Ações</p>
        <button
          v-if="activeConversation.status === 'OPEN'"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
          :disabled="statusChanging"
          @click="changeStatus('RESOLVED')"
        >
          <CheckCircle :size="13" />
          Resolver conversa
        </button>
        <button
          v-else
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
          :disabled="statusChanging"
          @click="changeStatus('OPEN')"
        >
          <RotateCcw :size="13" />
          Reabrir conversa
        </button>
      </div>
    </div>

    <!-- Modal: transferir -->
    <Teleport to="body">
      <div
        v-if="showTransferModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="showTransferModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-white">Transferir conversa</h2>
              <p class="mt-0.5 text-xs text-zinc-500">Altere o atendente ou o departamento responsável.</p>
            </div>
            <button class="text-zinc-500 hover:text-zinc-300" @click="showTransferModal = false">
              <X :size="20" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-sm text-zinc-400">Atendente</label>
              <select
                v-model="transferForm.assignedToId"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              >
                <option value="">Sem atribuição</option>
                <option v-for="user in transferUsers" :key="user.id" :value="user.id">{{ user.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-sm text-zinc-400">Departamento</label>
              <select
                v-model="transferForm.departmentId"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              >
                <option value="">Sem departamento</option>
                <option v-for="dept in transferDepts" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
              </select>
            </div>

            <p v-if="transferError" class="text-sm text-red-400">{{ transferError }}</p>

            <button
              :disabled="transferring"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              @click="confirmTransfer"
            >
              <LoaderCircle v-if="transferring" :size="16" class="animate-spin" />
              Confirmar transferência
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed, reactive } from "vue"
import {
  Search, CheckCheck, CheckCircle, RotateCcw, Send, MessageSquare,
  ArrowRightLeft, PanelRight, X, LoaderCircle,
} from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ layout: "chat", middleware: "auth" })

// ── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name?: string | null
  phoneNumber: string
  avatarUrl?: string | null
}

interface ConvSummary {
  id: string
  status: "OPEN" | "RESOLVED"
  lastMessageAt?: string | null
  contact: Contact
  assignedTo?: { id: string; name: string } | null
  department?: { id: string; name: string } | null
  messages?: { content?: string | null; direction: string; type: string; createdAt: string }[]
}

interface FullConversation extends ConvSummary {
  instance: { id: string; name: string; providerType: string; phoneNumber?: string }
}

interface Message {
  id: string
  conversationId: string
  direction: "INBOUND" | "OUTBOUND"
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "SYSTEM"
  content?: string | null
  createdAt: string
  author?: { id: string; name: string } | null
}

// ── State ────────────────────────────────────────────────────────────────────

const api = useApi()

const search = ref("")
const activeTab = ref<"ALL" | "MINE" | "RESOLVED">("ALL")
const conversations = ref<ConvSummary[]>([])
const listLoading = ref(true)
const activeConversationId = ref<string | null>(null)
const activeConversation = ref<FullConversation | null>(null)
const messages = ref<Message[]>([])
const inputText = ref("")
const sending = ref(false)
const statusChanging = ref(false)
const showInfoPanel = ref(true)
const messagesContainerRef = ref<HTMLElement | null>(null)
const scrollAnchorRef = ref<HTMLElement | null>(null)

// Transfer
const showTransferModal = ref(false)
const transferring = ref(false)
const transferError = ref("")
const transferUsers = ref<{ id: string; name: string; email?: string }[]>([])
const transferDepts = ref<{ id: string; name: string }[]>([])
const transferForm = reactive({ assignedToId: "", departmentId: "" })

const TABS = [
  { label: "Todas", value: "ALL" as const },
  { label: "Minhas", value: "MINE" as const },
  { label: "Resolvidas", value: "RESOLVED" as const },
]

// ── Computed ─────────────────────────────────────────────────────────────────

const openCount = computed(() => conversations.value.filter((c) => c.status === "OPEN").length)

// ── Search debounce ───────────────────────────────────────────────────────────

const debouncedSearch = ref("")
let searchTimer: ReturnType<typeof setTimeout>
watch(search, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = val }, 300)
})

// ── Polling ───────────────────────────────────────────────────────────────────

let listInterval: ReturnType<typeof setInterval> | null = null
let messagesInterval: ReturnType<typeof setInterval> | null = null

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #10b981, #3b82f6)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
]

function avatarGradient(name: string) {
  const idx = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
}

// ── Date / time helpers ───────────────────────────────────────────────────────

function formatTime(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 1) return "Ontem"
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" })
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return "Hoje"
  if (diffDays === 1) return "Ontem"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}

function showDateSeparator(msg: Message, prev?: Message) {
  if (!prev) return true
  return new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString()
}

// ── Load conversations ────────────────────────────────────────────────────────

let currentLoadId = 0

async function loadConversations() {
  const loadId = ++currentLoadId
  try {
    const params = new URLSearchParams()
    if (activeTab.value === "MINE") params.set("mine", "true")
    params.set("status", activeTab.value === "RESOLVED" ? "RESOLVED" : "OPEN")
    if (debouncedSearch.value) params.set("search", debouncedSearch.value)

    const result = await api<ConvSummary[]>(`/conversations?${params}`)
    if (loadId === currentLoadId) conversations.value = result
  } catch {
    // polling errors are silent
  } finally {
    if (loadId === currentLoadId) listLoading.value = false
  }
}

// ── Load transfer options ─────────────────────────────────────────────────────

async function loadTransferOptions() {
  const [usersRes, deptsRes] = await Promise.allSettled([
    api<{ id: string; name: string; email: string }[]>("/users"),
    api<{ id: string; name: string }[]>("/departments"),
  ])
  transferUsers.value = usersRes.status === "fulfilled" ? usersRes.value : []
  transferDepts.value = deptsRes.status === "fulfilled" ? deptsRes.value : []
}

// ── Select conversation ───────────────────────────────────────────────────────

async function selectConversation(id: string) {
  if (activeConversationId.value === id) return
  activeConversationId.value = id
  messages.value = []
  clearInterval(messagesInterval!)

  try {
    activeConversation.value = await api<FullConversation>(`/conversations/${id}`)
    messages.value = activeConversation.value.messages as unknown as Message[]
    scrollToBottom()
  } catch {
    activeConversation.value = null
  }

  messagesInterval = setInterval(pollMessages, 3000)
}

async function pollMessages() {
  if (!activeConversationId.value) return
  try {
    const fresh = await api<Message[]>(`/conversations/${activeConversationId.value}/messages`)
    if (fresh.length !== messages.value.length) {
      messages.value = fresh
      scrollToBottom()
    }
  } catch {}
}

function scrollToBottom(smooth = true) {
  nextTick(() => scrollAnchorRef.value?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" }))
}

// ── Send message ──────────────────────────────────────────────────────────────

async function sendMessage() {
  const content = inputText.value.trim()
  if (!content || sending.value || !activeConversationId.value) return
  sending.value = true
  inputText.value = ""

  const optimistic: Message = {
    id: `opt-${Date.now()}`,
    conversationId: activeConversationId.value,
    direction: "OUTBOUND",
    type: "TEXT",
    content,
    createdAt: new Date().toISOString(),
  }
  messages.value.push(optimistic)
  scrollToBottom()

  try {
    const created = await api<Message>(`/conversations/${activeConversationId.value}/messages`, {
      method: "POST",
      body: { content },
    })
    const idx = messages.value.findIndex((m) => m.id === optimistic.id)
    if (idx !== -1) messages.value.splice(idx, 1, created)
    await loadConversations()
  } catch {
    messages.value = messages.value.filter((m) => m.id !== optimistic.id)
    inputText.value = content
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

// ── Change status ─────────────────────────────────────────────────────────────

async function changeStatus(status: "OPEN" | "RESOLVED") {
  if (!activeConversationId.value) return
  statusChanging.value = true
  try {
    await api(`/conversations/${activeConversationId.value}/status`, {
      method: "PATCH",
      body: { status },
    })
    if (activeConversation.value) activeConversation.value.status = status
    await Promise.all([loadConversations(), pollMessages()])
  } catch {
  } finally {
    statusChanging.value = false
  }
}

// ── Transfer ──────────────────────────────────────────────────────────────────

function openTransfer() {
  transferForm.assignedToId = activeConversation.value?.assignedTo?.id ?? ""
  transferForm.departmentId = activeConversation.value?.department?.id ?? ""
  transferError.value = ""
  showTransferModal.value = true
}

async function confirmTransfer() {
  if (!activeConversationId.value) return
  transferring.value = true
  transferError.value = ""
  try {
    await api(`/conversations/${activeConversationId.value}/assign`, {
      method: "PATCH",
      body: {
        assignedToId: transferForm.assignedToId || null,
        departmentId: transferForm.departmentId || null,
      },
    })
    activeConversation.value = await api<FullConversation>(`/conversations/${activeConversationId.value}`)
    messages.value = activeConversation.value.messages as unknown as Message[]
    showTransferModal.value = false
    await loadConversations()
  } catch (err: any) {
    transferError.value = err?.data?.error ?? err?.data?.message ?? "Não foi possível transferir."
  } finally {
    transferring.value = false
  }
}

// ── Textarea auto-resize ──────────────────────────────────────────────────────

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = "auto"
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`
}

// ── Watchers & lifecycle ──────────────────────────────────────────────────────

watch(activeTab, () => {
  conversations.value = []
  listLoading.value = true
  loadConversations()
})

watch(debouncedSearch, () => {
  listLoading.value = true
  loadConversations()
})

onMounted(() => {
  loadConversations()
  loadTransferOptions()
  listInterval = setInterval(loadConversations, 5000)
})

onUnmounted(() => {
  clearInterval(listInterval!)
  clearInterval(messagesInterval!)
})
</script>
