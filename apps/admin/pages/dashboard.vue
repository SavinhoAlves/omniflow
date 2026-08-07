<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white">Dashboard</h1>
      <p class="text-zinc-400 mt-2">Visão geral do seu atendimento.</p>
    </div>

    <!-- Checklist de primeiros passos — some sozinho quando tudo estiver configurado -->
    <div
      v-if="showChecklist"
      class="mb-8 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6"
    >
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-white">Primeiros passos</h2>
        <span class="text-sm text-zinc-400">{{ completedSteps }}/4 concluído{{ completedSteps === 1 ? "" : "s" }}</span>
      </div>

      <div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div class="h-full rounded-full bg-blue-500 transition-all" :style="{ width: `${(completedSteps / 4) * 100}%` }" />
      </div>

      <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="step in checklist"
          :key="step.label"
          :to="step.path"
          class="flex items-center gap-3 rounded-xl border p-3.5 transition"
          :class="step.done ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-700 bg-zinc-900 hover:border-blue-500/50'"
        >
          <CheckCircle2 v-if="step.done" :size="20" class="shrink-0 text-green-400" />
          <Circle v-else :size="20" class="shrink-0 text-zinc-600" />
          <span class="text-sm" :class="step.done ? 'text-zinc-500 line-through' : 'text-zinc-200'">
            {{ step.label }}
          </span>
        </NuxtLink>
      </div>
    </div>

    <!-- Cards -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div class="flex justify-between">
          <div>
            <p class="text-sm text-zinc-400">Canais conectados</p>
            <h2 class="mt-2 text-3xl font-bold text-white">{{ stats.channelsConnected }}</h2>
            <p class="mt-1 text-xs text-zinc-600">de {{ stats.channelsTotal }} cadastrados</p>
          </div>
          <div class="rounded-xl bg-green-500/10 p-3 text-green-400">
            <MessageCircle />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div class="flex justify-between">
          <div>
            <p class="text-sm text-zinc-400">Departamentos</p>
            <h2 class="mt-2 text-3xl font-bold text-white">{{ stats.departments }}</h2>
          </div>
          <div class="rounded-xl bg-blue-500/10 p-3 text-blue-400">
            <Network />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div class="flex justify-between">
          <div>
            <p class="text-sm text-zinc-400">Atendentes</p>
            <h2 class="mt-2 text-3xl font-bold text-white">{{ stats.agents }}</h2>
          </div>
          <div class="rounded-xl bg-purple-500/10 p-3 text-purple-400">
            <Users />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div class="flex justify-between">
          <div>
            <p class="text-sm text-zinc-400">Fluxo de atendimento</p>
            <h2 class="mt-2 text-2xl font-bold" :class="stats.workflowEnabled ? 'text-green-400' : 'text-zinc-500'">
              {{ stats.workflowEnabled ? "Ativo" : "Não configurado" }}
            </h2>
          </div>
          <div class="rounded-xl bg-yellow-500/10 p-3 text-yellow-400">
            <Workflow />
          </div>
        </div>
      </div>
    </div>

    <!-- Atividade recente -->
    <div class="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 class="mb-1 text-xl font-semibold text-white">Atividade recente</h2>
      <p class="mb-5 text-sm text-zinc-500">Últimas conversas atendidas pela sua equipe.</p>

      <div class="flex flex-col items-center py-10 text-center text-zinc-500">
        <Inbox :size="36" class="mb-3" />
        Nenhum atendimento por aqui ainda.
        <p class="mt-1 max-w-sm text-sm text-zinc-600">
          Assim que uma conversa chegar por um canal conectado, ela aparece aqui.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, onMounted } from "vue"
import { MessageCircle, Network, Users, Workflow, Inbox, CheckCircle2, Circle } from "lucide-vue-next"
import { useApi } from "../composables/useApi"

definePageMeta({ middleware: "auth" })

const api = useApi()

const stats = reactive({
  channelsConnected: 0,
  channelsTotal: 0,
  departments: 0,
  agents: 0,
  workflowEnabled: false,
})

const checklist = computed(() => [
  { label: "Conectar um canal", path: "/whatsapp", done: stats.channelsTotal > 0 },
  { label: "Criar um departamento", path: "/departments", done: stats.departments > 0 },
  { label: "Cadastrar um atendente", path: "/users", done: stats.agents > 0 },
  { label: "Configurar o fluxo de atendimento", path: "/workflows", done: stats.workflowEnabled },
])

const completedSteps = computed(() => checklist.value.filter((s) => s.done).length)
const showChecklist = computed(() => completedSteps.value < 4)

async function loadDashboard() {
  // Cada consulta é independente e tolera falha isoladamente — um
  // endpoint que ainda não existe (departments, users, workflows)
  // não deve derrubar os cards que já funcionam (whatsapp).
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
}

onMounted(loadDashboard)
</script>
