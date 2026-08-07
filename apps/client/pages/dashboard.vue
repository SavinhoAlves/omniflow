<template>
  <div>
    <!-- Checklist de primeiros passos -->
    <div
      v-if="!loading && showChecklist"
      class="mb-8 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6"
    >
      <div class="flex items-center justify-between gap-4">
        <h2 class="font-semibold text-white">Primeiros passos</h2>
        <span class="text-sm text-zinc-400 shrink-0">
          {{ completedSteps }}/{{ checklist.length }} concluído{{ completedSteps === 1 ? "" : "s" }}
        </span>
      </div>

      <div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          class="h-full rounded-full bg-blue-500 transition-all duration-500"
          :style="{ width: `${(completedSteps / checklist.length) * 100}%` }"
        />
      </div>

      <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="step in checklist"
          :key="step.label"
          :to="step.path"
          class="flex items-center gap-3 rounded-xl border p-3.5 transition"
          :class="step.done
            ? 'border-zinc-800 bg-zinc-900/50 cursor-default pointer-events-none'
            : 'border-zinc-700 bg-zinc-900 hover:border-blue-500/50 hover:bg-zinc-800/60'"
        >
          <CheckCircle2 v-if="step.done" :size="20" class="shrink-0 text-green-400" />
          <Circle v-else :size="20" class="shrink-0 text-zinc-600" />
          <span class="text-sm leading-snug" :class="step.done ? 'text-zinc-500 line-through' : 'text-zinc-200'">
            {{ step.label }}
          </span>
        </NuxtLink>
      </div>
    </div>

    <!-- Metric cards -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <template v-if="loading">
        <div v-for="n in 4" :key="n" class="h-36 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
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
          title="Fluxo de atendimento"
          :value="stats.workflowEnabled ? 'Ativo' : 'Desativado'"
          :subtitle="stats.workflowEnabled ? '' : 'Configure em Fluxos'"
          :icon="Workflow"
          color="yellow"
        />
      </template>
    </div>

    <!-- Atividade recente -->
    <div class="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900">
      <div class="border-b border-zinc-800 px-6 py-4">
        <h2 class="font-semibold text-white">Atividade recente</h2>
        <p class="mt-0.5 text-sm text-zinc-500">Últimas conversas atendidas pela equipe.</p>
      </div>

      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="n in 3" :key="n" class="h-12 animate-pulse rounded-xl bg-zinc-800/60" />
      </div>

      <div v-else class="flex flex-col items-center py-14 text-center">
        <div class="mb-4 rounded-2xl bg-zinc-800 p-4">
          <Inbox :size="28" class="text-zinc-500" />
        </div>
        <p class="font-medium text-zinc-400">Nenhum atendimento por aqui ainda.</p>
        <p class="mt-1 max-w-xs text-sm text-zinc-600">
          Assim que uma conversa chegar por um canal conectado, ela aparece aqui.
        </p>
        <NuxtLink
          to="/whatsapp"
          class="mt-5 flex items-center gap-1.5 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
        >
          <MessageCircle :size="15" />
          Conectar um canal
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue"
import { MessageCircle, Network, Users, Workflow, Inbox, CheckCircle2, Circle } from "lucide-vue-next"
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

const checklist = computed(() => [
  { label: "Conectar um canal",               path: "/whatsapp",    done: stats.channelsTotal > 0 },
  { label: "Criar um departamento",           path: "/departments", done: stats.departments > 0 },
  { label: "Cadastrar um atendente",          path: "/users",       done: stats.agents > 0 },
  { label: "Configurar o fluxo de atendimento", path: "/workflows", done: stats.workflowEnabled },
])

const completedSteps = computed(() => checklist.value.filter((s) => s.done).length)
const showChecklist = computed(() => completedSteps.value < checklist.value.length)

async function loadDashboard() {
  loading.value = true
  try {
    const [whatsappResult, departmentsResult, usersResult, workflowResult] = await Promise.allSettled([
      api<any[]>("/whatsapp/instances"),
      api<any[]>("/departments"),
      api<any[]>("/users"),
      api<{ enabled: boolean }>("/workflows/default"),
    ])

    if (whatsappResult.status === "fulfilled") {
      stats.channelsTotal = whatsappResult.value.length
      stats.channelsConnected = whatsappResult.value.filter((i) => i.connectionStatus === "CONNECTED").length
    }
    if (departmentsResult.status === "fulfilled") stats.departments = departmentsResult.value.length
    if (usersResult.status === "fulfilled") stats.agents = usersResult.value.length
    if (workflowResult.status === "fulfilled") stats.workflowEnabled = !!workflowResult.value?.enabled
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>
