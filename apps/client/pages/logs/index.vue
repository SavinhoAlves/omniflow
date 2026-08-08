<template>
  <div class="space-y-5">

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 items-end">

      <div class="flex flex-col gap-1">
        <label class="text-xs text-zinc-500">Tipo de ação</label>
        <select
          v-model="filters.action"
          class="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @change="fetchLogs"
        >
          <option value="">Todas as ações</option>
          <optgroup label="Autenticação">
            <option value="auth.login">Login</option>
          </optgroup>
          <optgroup label="Conversas">
            <option value="conversation.started">Conversa iniciada</option>
            <option value="conversation.closed">Conversa encerrada</option>
            <option value="conversation.reopened">Conversa reaberta</option>
            <option value="conversation.transferred">Conversa transferida</option>
            <option value="conversation.opened">Mensagem recebida (sistema)</option>
          </optgroup>
          <optgroup label="Mensagens">
            <option value="message.sent">Mensagem enviada</option>
          </optgroup>
          <optgroup label="Usuários">
            <option value="user.created">Usuário criado</option>
          </optgroup>
          <optgroup label="WhatsApp">
            <option value="whatsapp.connect_requested">Conexão solicitada</option>
          </optgroup>
        </select>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs text-zinc-500">De</label>
        <input
          v-model="filters.from"
          type="date"
          class="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @change="fetchLogs"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs text-zinc-500">Até</label>
        <input
          v-model="filters.to"
          type="date"
          class="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @change="fetchLogs"
        />
      </div>

      <button
        class="ml-auto flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 text-sm transition-all"
        @click="clearFilters"
      >
        <RefreshCw :size="14" />
        Limpar
      </button>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border border-zinc-800 overflow-hidden">

      <!-- Loading skeleton -->
      <div v-if="loading" class="divide-y divide-zinc-800">
        <div v-for="i in 8" :key="i" class="flex items-center gap-4 px-5 py-4">
          <div class="h-4 w-36 bg-zinc-800 rounded animate-pulse" />
          <div class="h-5 w-28 bg-zinc-800 rounded-full animate-pulse" />
          <div class="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
          <div class="h-4 flex-1 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!logs.length" class="py-20 text-center">
        <ClipboardList :size="36" class="mx-auto text-zinc-700 mb-3" />
        <p class="text-zinc-500 text-sm">Nenhum evento registrado ainda.</p>
        <p class="text-zinc-600 text-xs mt-1">As ações do sistema aparecerão aqui em tempo real.</p>
      </div>

      <!-- Log rows -->
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-zinc-800 bg-zinc-900/50">
                <th class="text-left px-5 py-3 text-xs font-semibold text-zinc-500 whitespace-nowrap">Data / Hora</th>
                <th class="text-left px-5 py-3 text-xs font-semibold text-zinc-500">Ação</th>
                <th class="text-left px-5 py-3 text-xs font-semibold text-zinc-500">Usuário</th>
                <th class="text-left px-5 py-3 text-xs font-semibold text-zinc-500">Detalhes</th>
                <th class="text-left px-5 py-3 text-xs font-semibold text-zinc-500 whitespace-nowrap">IP</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800/60">
              <tr
                v-for="log in logs"
                :key="log.id"
                class="hover:bg-zinc-900/40 transition-colors"
              >
                <td class="px-5 py-3.5 text-zinc-400 whitespace-nowrap font-mono text-xs">
                  {{ formatDate(log.createdAt) }}
                </td>
                <td class="px-5 py-3.5">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    :class="actionStyle(log.action).class"
                  >
                    <component :is="actionStyle(log.action).icon" :size="11" />
                    {{ actionLabel(log.action) }}
                  </span>
                </td>
                <td class="px-5 py-3.5">
                  <div v-if="log.userName" class="flex items-center gap-2">
                    <div class="h-6 w-6 rounded-full bg-gradient-to-br from-blue-600/40 to-cyan-500/30 border border-blue-500/20 flex items-center justify-center text-[10px] font-semibold text-blue-300 shrink-0">
                      {{ log.userName.charAt(0).toUpperCase() }}
                    </div>
                    <span class="text-white text-sm">{{ log.userName }}</span>
                  </div>
                  <span v-else class="text-zinc-600 text-xs">Sistema</span>
                </td>
                <td class="px-5 py-3.5 text-zinc-400 text-xs max-w-xs truncate">
                  {{ formatDetails(log) }}
                </td>
                <td class="px-5 py-3.5 text-zinc-600 font-mono text-xs whitespace-nowrap">
                  {{ log.ip ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pages > 1" class="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900/30">
          <span class="text-xs text-zinc-500">{{ total }} eventos · página {{ page }} de {{ pages }}</span>
          <div class="flex gap-2">
            <button
              class="px-3 py-1.5 rounded-lg text-xs border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              :disabled="page <= 1"
              @click="goPage(page - 1)"
            >
              Anterior
            </button>
            <button
              class="px-3 py-1.5 rounded-lg text-xs border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              :disabled="page >= pages"
              @click="goPage(page + 1)"
            >
              Próxima
            </button>
          </div>
        </div>
      </template>
    </div>

  </div>
</template>

<script setup lang="ts">
import {
  LogIn, MessageSquare, CheckCircle, RotateCcw,
  ArrowLeftRight, UserPlus, Wifi, RefreshCw,
  ClipboardList, Mail,
} from "lucide-vue-next"
import { useApi } from "~/composables/useApi"

definePageMeta({ layout: "default", middleware: "auth" })

const api = useApi()

interface LogEntry {
  id: string
  userId: string | null
  userName: string | null
  action: string
  entity: string | null
  entityId: string | null
  details: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

const logs    = ref<LogEntry[]>([])
const total   = ref(0)
const page    = ref(1)
const pages   = ref(1)
const loading = ref(true)

const filters = reactive({
  action: "",
  from: "",
  to: "",
})

async function fetchLogs() {
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(page.value) })
    if (filters.action) params.set("action", filters.action)
    if (filters.from)   params.set("from",   filters.from)
    if (filters.to)     params.set("to",     filters.to)

    const data: any = await api(`/logs?${params}`)
    logs.value  = data.logs
    total.value = data.total
    pages.value = data.pages
    page.value  = data.page
  } finally {
    loading.value = false
  }
}

function goPage(p: number) {
  page.value = p
  fetchLogs()
}

function clearFilters() {
  filters.action = ""
  filters.from   = ""
  filters.to     = ""
  page.value     = 1
  fetchLogs()
}

onMounted(fetchLogs)

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

const ACTION_META: Record<string, { label: string; icon: any; class: string }> = {
  "auth.login":                  { label: "Login",               icon: LogIn,          class: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20" },
  "conversation.started":        { label: "Conversa iniciada",   icon: MessageSquare,  class: "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20" },
  "conversation.opened":         { label: "Msg recebida",        icon: Mail,           class: "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20" },
  "conversation.closed":         { label: "Encerrada",           icon: CheckCircle,    class: "bg-green-500/10 text-green-400 ring-1 ring-green-500/20" },
  "conversation.reopened":       { label: "Reaberta",            icon: RotateCcw,      class: "bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20" },
  "conversation.transferred":    { label: "Transferida",         icon: ArrowLeftRight, class: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20" },
  "message.sent":                { label: "Msg enviada",         icon: MessageSquare,  class: "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20" },
  "user.created":                { label: "Usuário criado",      icon: UserPlus,       class: "bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20" },
  "whatsapp.connect_requested":  { label: "WhatsApp conectado",  icon: Wifi,           class: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20" },
}

function actionStyle(action: string) {
  return ACTION_META[action] ?? { label: action, icon: ClipboardList, class: "bg-zinc-800 text-zinc-400" }
}

function actionLabel(action: string) {
  return ACTION_META[action]?.label ?? action
}

function formatDetails(log: LogEntry): string {
  if (!log.details) return "—"
  const d = log.details
  if (log.action === "conversation.started")     return `Para: ${d.contactPhone}`
  if (log.action === "conversation.transferred") return d.departmentId ? `Dept: ${d.departmentId}` : d.assignedToId ? `Atendente atribuído` : "Atribuição removida"
  if (log.action === "user.created")             return `${d.name} <${d.email}> (${d.role})`
  if (log.action === "whatsapp.connect_requested") return `Status: ${d.status}`
  return JSON.stringify(d)
}
</script>
