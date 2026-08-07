<template>
  <div class="space-y-6">

    <!-- Period selector -->
    <div class="flex items-center justify-between">
      <p class="text-sm text-zinc-500">{{ periodLabels[period] }}</p>
      <div class="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
        <button
          v-for="p in periods"
          :key="p.value"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          :class="period === p.value ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'"
          @click="setPeriod(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- KPI cards — row 1 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <template v-if="loadingOverview">
        <div v-for="i in 4" :key="i" class="h-28 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
      </template>
      <template v-else-if="overview">
        <MetricCard
          title="Conversas no período"
          :value="overview.totalConversations"
          :subtitle="`${overview.openConversations} ainda em aberto`"
          :icon="MessageSquare"
          color="blue"
        />
        <MetricCard
          title="Resolvidas"
          :value="overview.resolvedInPeriod"
          subtitle="No período selecionado"
          :icon="CheckCircle"
          color="green"
        />
        <MetricCard
          title="Novos contatos"
          :value="overview.newContacts"
          subtitle="Primeiros contatos"
          :icon="UserPlus"
          color="purple"
        />
        <MetricCard
          title="Tempo médio"
          :value="formatDuration(overview.avgResolutionMinutes)"
          subtitle="Para resolver"
          :icon="Clock"
          color="yellow"
        />
      </template>
    </div>

    <!-- KPI cards — row 2 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <template v-if="loadingOverview">
        <div v-for="i in 4" :key="i" class="h-28 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
      </template>
      <template v-else-if="overview">
        <MetricCard
          title="Msgs recebidas"
          :value="overview.messagesInbound"
          subtitle="Clientes → atendentes"
          :icon="ArrowDownLeft"
          color="blue"
        />
        <MetricCard
          title="Msgs enviadas"
          :value="overview.messagesOutbound"
          subtitle="Atendentes → clientes"
          :icon="ArrowUpRight"
          color="green"
        />
        <!-- Taxa de resolução — card largo -->
        <div class="col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex items-center gap-6">
          <div class="flex-1">
            <p class="text-sm text-zinc-400">Taxa de resolução</p>
            <h2 class="mt-2 text-3xl font-bold text-white">{{ resolutionRate }}%</h2>
            <p class="mt-1 text-xs text-zinc-500">
              {{ overview.resolvedInPeriod }} de {{ overview.totalConversations }} conversas
            </p>
          </div>
          <div class="flex-1">
            <div class="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-700"
                :style="{ width: `${resolutionRate}%` }"
              />
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Volume chart -->
    <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h3 class="text-sm font-semibold text-white mb-5">Volume de conversas por dia</h3>

      <div v-if="loadingVolume" class="h-40 flex items-end gap-1">
        <div
          v-for="i in 14"
          :key="i"
          class="flex-1 bg-zinc-800 rounded-t animate-pulse"
          :style="{ height: `${30 + (i * 17 % 55)}%` }"
        />
      </div>

      <template v-else-if="volume.length">
        <!-- bars -->
        <div class="flex items-end gap-1 pt-2" style="height: 160px">
          <div
            v-for="(day, i) in volume"
            :key="day.date"
            class="flex-1 flex flex-col items-center justify-end gap-0.5 group cursor-default"
            style="height: 100%"
          >
            <span class="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              {{ day.total }}
            </span>
            <div
              class="w-full bg-blue-500/60 hover:bg-blue-500 rounded-t transition-colors duration-150"
              :style="{ height: maxVolume > 0 ? `${Math.max(3, Math.round((day.total / maxVolume) * 140))}px` : '3px' }"
              :title="`${day.date}: ${day.total} conversa${day.total === 1 ? '' : 's'}`"
            />
          </div>
        </div>
        <!-- X-axis labels -->
        <div class="flex mt-2">
          <span
            v-for="(day, i) in volume"
            :key="day.date + 'l'"
            class="flex-1 text-center text-[10px] text-zinc-600 select-none"
          >
            {{ showLabel(i, volume.length) ? formatDateShort(day.date) : '' }}
          </span>
        </div>
      </template>

      <p v-else class="text-sm text-zinc-500 py-10 text-center">
        Nenhuma conversa no período.
      </p>
    </div>

    <!-- Agents + Departments -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- Agents -->
      <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 class="text-sm font-semibold text-white mb-5">Top atendentes</h3>

        <div v-if="loadingAgents" class="space-y-4">
          <div v-for="i in 4" :key="i" class="space-y-1.5">
            <div class="h-4 w-3/4 bg-zinc-800 rounded animate-pulse" />
            <div class="h-1.5 bg-zinc-800 rounded-full animate-pulse" />
          </div>
        </div>

        <div v-else-if="agents.length" class="space-y-4">
          <div v-for="agent in agents" :key="agent.agentId">
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2 min-w-0">
                <div
                  class="h-6 w-6 rounded-full bg-gradient-to-br from-blue-600/40 to-cyan-500/30 border border-blue-500/20 flex items-center justify-center text-[10px] font-semibold text-blue-300 shrink-0"
                >
                  {{ agent.agentName.charAt(0).toUpperCase() }}
                </div>
                <span class="text-sm text-white truncate">{{ agent.agentName }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0 ml-2">
                <span class="text-xs text-green-400">{{ agent.resolved }} ✓</span>
                <span class="text-xs text-zinc-500">/ {{ agent.total }}</span>
              </div>
            </div>
            <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                :style="{ width: `${maxAgentTotal > 0 ? (agent.total / maxAgentTotal) * 100 : 0}%` }"
              />
            </div>
          </div>
        </div>

        <p v-else class="text-sm text-zinc-500 py-8 text-center">
          Nenhuma conversa atribuída no período.
        </p>
      </div>

      <!-- Departments -->
      <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 class="text-sm font-semibold text-white mb-5">Departamentos</h3>

        <div v-if="loadingDepts" class="space-y-4">
          <div v-for="i in 4" :key="i" class="space-y-1.5">
            <div class="h-4 w-3/4 bg-zinc-800 rounded animate-pulse" />
            <div class="h-1.5 bg-zinc-800 rounded-full animate-pulse" />
          </div>
        </div>

        <div v-else-if="departments.length" class="space-y-4">
          <div v-for="dept in departments" :key="dept.departmentId">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-sm text-white truncate max-w-[200px]">{{ dept.departmentName }}</span>
              <div class="flex items-center gap-2 shrink-0 ml-2">
                <span class="text-xs text-green-400">{{ dept.resolved }} ✓</span>
                <span class="text-xs text-zinc-500">/ {{ dept.total }}</span>
              </div>
            </div>
            <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-purple-500 to-pink-400 rounded-full transition-all duration-500"
                :style="{ width: `${maxDeptTotal > 0 ? (dept.total / maxDeptTotal) * 100 : 0}%` }"
              />
            </div>
          </div>
        </div>

        <p v-else class="text-sm text-zinc-500 py-8 text-center">
          Nenhuma conversa por departamento.
        </p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import {
  MessageSquare, CheckCircle, UserPlus, Clock,
  ArrowDownLeft, ArrowUpRight,
} from "lucide-vue-next"
import { useApi } from "~/composables/useApi"

definePageMeta({ layout: "default", middleware: "auth" })

const api = useApi()

// ── Period ────────────────────────────────────────────────────────────────────

const periods = [
  { value: "today", label: "Hoje"    },
  { value: "7d",    label: "7 dias"  },
  { value: "30d",   label: "30 dias" },
  { value: "90d",   label: "90 dias" },
] as const

type Period = typeof periods[number]["value"]

const periodLabels: Record<Period, string> = {
  today: "Dados de hoje",
  "7d":  "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
}

const period = ref<Period>("7d")

function setPeriod(p: Period) {
  period.value = p
  fetchAll()
}

// ── Types & state ─────────────────────────────────────────────────────────────

interface Overview {
  totalConversations:  number
  openConversations:   number
  resolvedInPeriod:    number
  newContacts:         number
  messagesInbound:     number
  messagesOutbound:    number
  avgResolutionMinutes: number | null
}

interface VolumeDay { date: string; total: number }
interface AgentRow  { agentId: string; agentName: string; total: number; resolved: number }
interface DeptRow   { departmentId: string; departmentName: string; total: number; resolved: number }

const overview    = ref<Overview | null>(null)
const volume      = ref<VolumeDay[]>([])
const agents      = ref<AgentRow[]>([])
const departments = ref<DeptRow[]>([])

const loadingOverview = ref(true)
const loadingVolume   = ref(true)
const loadingAgents   = ref(true)
const loadingDepts    = ref(true)

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchAll() {
  loadingOverview.value = true
  loadingVolume.value   = true
  loadingAgents.value   = true
  loadingDepts.value    = true

  const p = period.value

  await Promise.allSettled([
    api(`/reports/overview?period=${p}`)
      .then((d: any) => { overview.value = d })
      .finally(() => { loadingOverview.value = false }),

    api(`/reports/volume?period=${p}`)
      .then((d: any) => { volume.value = d })
      .finally(() => { loadingVolume.value = false }),

    api(`/reports/agents?period=${p}`)
      .then((d: any) => { agents.value = d })
      .finally(() => { loadingAgents.value = false }),

    api(`/reports/departments?period=${p}`)
      .then((d: any) => { departments.value = d })
      .finally(() => { loadingDepts.value = false }),
  ])
}

onMounted(fetchAll)

// ── Computed ──────────────────────────────────────────────────────────────────

const resolutionRate = computed(() => {
  if (!overview.value || overview.value.totalConversations === 0) return 0
  return Math.round((overview.value.resolvedInPeriod / overview.value.totalConversations) * 100)
})

const maxVolume     = computed(() => Math.max(...volume.value.map((d) => d.total), 1))
const maxAgentTotal = computed(() => Math.max(...agents.value.map((a) => a.total), 1))
const maxDeptTotal  = computed(() => Math.max(...departments.value.map((d) => d.total), 1))

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "--"
  if (minutes < 1) return "< 1 min"
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatDateShort(iso: string): string {
  const [, month, day] = iso.split("-")
  return `${day}/${month}`
}

function showLabel(i: number, total: number): boolean {
  if (total <= 9)  return true
  if (total <= 31) return i % 5 === 0 || i === total - 1
  return i % 15 === 0 || i === total - 1
}
</script>
