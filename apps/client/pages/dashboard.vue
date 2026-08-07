<template>
  <div class="space-y-6">

    <!-- Checklist de primeiros passos -->
    <div
      v-if="!loading && showChecklist"
      class="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5"
    >
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Rocket :size="16" class="text-blue-400" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-white">Primeiros passos</h2>
            <p class="text-xs text-zinc-500">{{ completedSteps }}/{{ checklist.length }} concluídos</p>
          </div>
        </div>
        <div class="hidden sm:flex items-center gap-2">
          <div class="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
            <div
              class="h-full rounded-full bg-blue-500 transition-all duration-500"
              :style="{ width: `${(completedSteps / checklist.length) * 100}%` }"
            />
          </div>
          <span class="text-xs text-zinc-500">{{ Math.round((completedSteps / checklist.length) * 100) }}%</span>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="step in checklist"
          :key="step.label"
          :to="step.path"
          class="flex items-center gap-2.5 rounded-xl border p-3 transition"
          :class="step.done
            ? 'border-zinc-800 bg-zinc-900/50 cursor-default pointer-events-none'
            : 'border-zinc-700/60 bg-zinc-900 hover:border-blue-500/40 hover:bg-zinc-800/60'"
        >
          <CheckCircle2 v-if="step.done" :size="17" class="shrink-0 text-green-400" />
          <div v-else class="h-4 w-4 shrink-0 rounded-full border border-zinc-600" />
          <span
            class="text-sm leading-snug"
            :class="step.done ? 'text-zinc-600 line-through' : 'text-zinc-300'"
          >
            {{ step.label }}
          </span>
        </NuxtLink>
      </div>
    </div>

    <!-- Metric cards -->
    <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <template v-if="loading">
        <div v-for="n in 4" :key="n" class="h-32 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
      </template>
      <template v-else>
        <MetricCard
          title="Canais conectados"
          :value="stats.channelsConnected"
          :subtitle="`de ${stats.channelsTotal} cadastrado${stats.channelsTotal === 1 ? '' : 's'}`"
          :icon="MessageCircle"
          color="green"
        />
        <MetricCard
          title="Departamentos"
          :value="stats.departments"
          :icon="Network"
          color="blue"
        />
        <MetricCard
          title="Atendentes"
          :value="stats.agents"
          :icon="Users"
          color="purple"
        />
        <MetricCard
          title="Fluxo"
          :value="stats.workflowEnabled ? 'Ativo' : 'Desativado'"
          :subtitle="stats.workflowEnabled ? 'Bot configurado' : 'Configure em Fluxos'"
          :icon="Workflow"
          :color="stats.workflowEnabled ? 'green' : 'yellow'"
        />
      </template>
    </div>

    <!-- Conversas recentes -->
    <div class="rounded-2xl border border-zinc-800 bg-zinc-900">
      <div class="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          <h2 class="text-sm font-semibold text-white">Conversas recentes</h2>
          <p class="mt-0.5 text-xs text-zinc-500">Atendimentos em aberto agora.</p>
        </div>
        <NuxtLink
          to="/conversations"
          class="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          Ver todas →
        </NuxtLink>
      </div>

      <div v-if="loading" class="p-4 space-y-2.5">
        <div v-for="n in 4" :key="n" class="flex items-center gap-3 animate-pulse">
          <div class="h-9 w-9 rounded-full bg-zinc-800 shrink-0" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3 bg-zinc-800 rounded w-1/3" />
            <div class="h-2.5 bg-zinc-800 rounded w-1/2" />
          </div>
          <div class="h-2.5 bg-zinc-800 rounded w-12 shrink-0" />
        </div>
      </div>

      <template v-else-if="recentConversations.length > 0">
        <NuxtLink
          v-for="conv in recentConversations"
          :key="conv.id"
          to="/conversations"
          class="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/40 transition-colors border-b border-zinc-800/60 last:border-0 group"
        >
          <!-- Avatar -->
          <div
            class="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            :style="{ background: avatarGradient(conv.contact.name ?? conv.contact.phoneNumber) }"
          >
            {{ contactInitials(conv.contact.name ?? conv.contact.phoneNumber) }}
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-zinc-100 truncate">
              {{ conv.contact.name || conv.contact.phoneNumber }}
            </p>
            <p class="text-xs text-zinc-500 truncate mt-0.5">
              {{ conv.messages?.[0]?.content || 'Nova conversa' }}
            </p>
          </div>

          <!-- Right side -->
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span class="text-[10px] text-zinc-600">{{ formatTime(conv.lastMessageAt) }}</span>
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
        </NuxtLink>
      </template>

      <div v-else class="flex flex-col items-center py-12 text-center">
        <div class="mb-3 rounded-2xl bg-zinc-800 p-3.5">
          <Inbox :size="24" class="text-zinc-600" />
        </div>
        <p class="text-sm font-medium text-zinc-500">Nenhum atendimento em aberto.</p>
        <p class="mt-1 max-w-xs text-xs text-zinc-600">
          Quando uma mensagem chegar por um canal conectado, ela aparece aqui.
        </p>
        <NuxtLink
          to="/whatsapp"
          class="mt-4 flex items-center gap-1.5 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
        >
          <MessageCircle :size="13" />
          Conectar um canal
        </NuxtLink>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue"
import { MessageCircle, Network, Users, Workflow, Inbox, CheckCircle2, Rocket } from "lucide-vue-next"
import { useApi } from "../composables/useApi"

definePageMeta({ middleware: "auth" })

const api = useApi()
const loading = ref(true)

const stats = reactive({
  channelsConnected: 0,
  channelsTotal: 0,
  departments: 0,
  agents: 0,
  workflowEnabled: false,
})

const recentConversations = ref<any[]>([])

const checklist = computed(() => [
  { label: "Conectar um canal",                 path: "/whatsapp",    done: stats.channelsTotal > 0 },
  { label: "Criar um departamento",             path: "/departments", done: stats.departments > 0 },
  { label: "Cadastrar um atendente",            path: "/users",       done: stats.agents > 0 },
  { label: "Configurar fluxo de atendimento",   path: "/workflows",   done: stats.workflowEnabled },
])

const completedSteps = computed(() => checklist.value.filter((s) => s.done).length)
const showChecklist = computed(() => completedSteps.value < checklist.value.length)

// ── Helpers de avatar (idêntico ao conversations page) ─────────────────────

const AVATAR_COLORS = [
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #10b981, #3b82f6)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
]

function avatarGradient(name: string) {
  const idx = [...(name || "?")].reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function contactInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
}

function formatTime(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 1) return "Ontem"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

// ── Data loading ───────────────────────────────────────────────────────────

async function loadDashboard() {
  loading.value = true
  try {
    const [whatsappResult, departmentsResult, usersResult, workflowResult, conversationsResult] =
      await Promise.allSettled([
        api<any[]>("/whatsapp/instances"),
        api<any[]>("/departments"),
        api<any[]>("/users"),
        api<{ enabled: boolean }>("/workflows/default"),
        api<any[]>("/conversations?status=OPEN"),
      ])

    if (whatsappResult.status === "fulfilled") {
      stats.channelsTotal = whatsappResult.value.length
      stats.channelsConnected = whatsappResult.value.filter((i) => i.connectionStatus === "CONNECTED").length
    }
    if (departmentsResult.status === "fulfilled") stats.departments = departmentsResult.value.length
    if (usersResult.status === "fulfilled") stats.agents = usersResult.value.length
    if (workflowResult.status === "fulfilled") stats.workflowEnabled = !!workflowResult.value?.enabled
    if (conversationsResult.status === "fulfilled") {
      recentConversations.value = conversationsResult.value.slice(0, 6)
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>
