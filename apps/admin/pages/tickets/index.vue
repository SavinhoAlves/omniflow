<template>
  <div>
    <div class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-white">Suporte</h1>
        <p class="mt-2 text-zinc-400">Fila global de tickets de todas as empresas.</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="mb-6 flex flex-wrap gap-3">
      <select
        v-model="filterStatus"
        class="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 outline-none transition focus:border-blue-500"
        @change="load"
      >
        <option value="">Todos os status</option>
        <option value="OPEN">Aberto</option>
        <option value="IN_PROGRESS">Em andamento</option>
        <option value="RESOLVED">Resolvido</option>
        <option value="CLOSED">Fechado</option>
      </select>

      <select
        v-model="filterPriority"
        class="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 outline-none transition focus:border-blue-500"
        @change="load"
      >
        <option value="">Todas as prioridades</option>
        <option value="URGENT">Urgente</option>
        <option value="HIGH">Alta</option>
        <option value="MEDIUM">Média</option>
        <option value="LOW">Baixa</option>
      </select>
    </div>

    <!-- Stats rápidos -->
    <div class="mb-6 grid grid-cols-4 gap-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
      >
        <p class="text-2xl font-bold text-white">{{ stat.value }}</p>
        <p class="mt-1 text-sm text-zinc-500">{{ stat.label }}</p>
      </div>
    </div>

    <!-- Lista -->
    <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <div v-for="n in 4" :key="n" class="h-16 animate-pulse rounded-xl bg-zinc-800/60" />
      </div>

      <!-- Vazio -->
      <div v-else-if="tickets.length === 0" class="flex flex-col items-center py-12 text-center text-zinc-500">
        <LifeBuoy :size="40" class="mb-3" />
        Nenhum ticket encontrado.
      </div>

      <!-- Tickets -->
      <div v-else class="space-y-3">
        <div
          v-for="t in tickets"
          :key="t.id"
          class="rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <NuxtLink
                  :to="`/companies/${t.company.id}`"
                  class="text-xs font-medium text-blue-400 hover:underline"
                >
                  {{ t.company.name }}
                </NuxtLink>
                <span class="text-zinc-700">·</span>
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="ticketTypeClass(t.type)">
                  {{ ticketTypeLabel(t.type) }}
                </span>
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="ticketPriorityClass(t.priority)">
                  {{ ticketPriorityLabel(t.priority) }}
                </span>
              </div>
              <p class="mt-1 font-semibold text-white">{{ t.title }}</p>
              <p class="mt-0.5 text-xs text-zinc-400 line-clamp-1">{{ t.description }}</p>
              <p class="mt-1 text-xs text-zinc-600">{{ formatDateTime(t.createdAt) }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <select
                class="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none"
                :value="t.status"
                @change="updateStatus(t.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="OPEN">Aberto</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="RESOLVED">Resolvido</option>
                <option value="CLOSED">Fechado</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { LifeBuoy } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })

const api = useApi()

interface Ticket {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  createdAt: string
  company: { id: string; name: string }
}

const tickets = ref<Ticket[]>([])
const loading = ref(true)
const filterStatus = ref("")
const filterPriority = ref("")

const stats = computed(() => [
  { label: "Abertos", value: tickets.value.filter(t => t.status === "OPEN").length },
  { label: "Em andamento", value: tickets.value.filter(t => t.status === "IN_PROGRESS").length },
  { label: "Resolvidos", value: tickets.value.filter(t => t.status === "RESOLVED").length },
  { label: "Urgentes", value: tickets.value.filter(t => t.priority === "URGENT" && t.status !== "CLOSED").length },
])

async function load() {
  loading.value = true
  const params = new URLSearchParams()
  if (filterStatus.value) params.set("status", filterStatus.value)
  if (filterPriority.value) params.set("priority", filterPriority.value)
  try {
    const qs = params.toString()
    tickets.value = await api<Ticket[]>(`/platform/tickets${qs ? `?${qs}` : ""}`)
  } catch {
    tickets.value = []
  } finally {
    loading.value = false
  }
}

async function updateStatus(id: string, status: string) {
  await api(`/platform/tickets/${id}`, { method: "PATCH", body: { status } })
  await load()
}

function formatDateTime(d: string) {
  return d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"
}

function ticketTypeLabel(t: string) {
  return { SYNC: "Sync", INSTALLATION: "Instalação", BUG: "Bug", OTHER: "Outro" }[t] ?? t
}

function ticketTypeClass(t: string) {
  return {
    SYNC: "bg-blue-500/10 text-blue-400",
    INSTALLATION: "bg-purple-500/10 text-purple-400",
    BUG: "bg-red-500/10 text-red-400",
    OTHER: "bg-zinc-700/50 text-zinc-400",
  }[t] ?? "bg-zinc-700/50 text-zinc-400"
}

function ticketPriorityLabel(p: string) {
  return { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente" }[p] ?? p
}

function ticketPriorityClass(p: string) {
  return {
    LOW: "bg-zinc-700/50 text-zinc-400",
    MEDIUM: "bg-blue-500/10 text-blue-400",
    HIGH: "bg-orange-500/10 text-orange-400",
    URGENT: "bg-red-500/10 text-red-400",
  }[p] ?? "bg-zinc-700/50 text-zinc-400"
}

onMounted(load)
</script>
