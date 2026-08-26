<template>
  <div class="space-y-6">

    <!-- Instance selector + Sync -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <label class="text-sm text-zinc-500">Canal:</label>
        <select
          v-model="selectedInstanceId"
          class="rounded-xl border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
          @change="loadTemplates"
        >
          <option value="">Selecione um canal Meta...</option>
          <option v-for="inst in metaInstances" :key="inst.id" :value="inst.id">
            {{ inst.name }}{{ inst.phoneNumber ? ` (${inst.phoneNumber})` : '' }}
          </option>
        </select>
      </div>

      <button
        v-if="selectedInstanceId"
        class="flex items-center gap-1.5 rounded-xl border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-400 transition hover:border-blue-500/40 hover:text-blue-400 disabled:opacity-40"
        :disabled="syncing"
        @click="syncTemplates"
      >
        <RefreshCw :size="14" :class="syncing ? 'animate-spin' : ''" />
        {{ syncing ? 'Sincronizando...' : 'Sincronizar com Meta' }}
      </button>

      <p v-if="syncResult" class="text-xs text-emerald-400">{{ syncResult }}</p>
    </div>

    <!-- Filter tabs -->
    <div v-if="selectedInstanceId" class="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1 w-fit">
      <button
        v-for="f in statusFilters"
        :key="f.value"
        class="rounded-lg px-3 py-1.5 text-xs font-medium transition"
        :class="activeFilter === f.value ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'"
        @click="activeFilter = f.value"
      >
        {{ f.label }}
        <span class="ml-1 text-[10px] opacity-60">{{ countByStatus(f.value) }}</span>
      </button>
    </div>

    <!-- Empty state — no instance selected -->
    <div v-if="!selectedInstanceId" class="flex flex-col items-center py-20 text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
        <LayoutList :size="24" class="text-zinc-700" />
      </div>
      <p class="text-sm font-medium text-zinc-500">Selecione um canal Meta Cloud API</p>
      <p class="mt-1 text-xs text-zinc-700">Templates HSM aprovados pela Meta serão listados aqui.</p>
    </div>

    <!-- No meta instances -->
    <div v-else-if="metaInstances.length === 0 && !loadingInstances" class="flex flex-col items-center py-20 text-center">
      <p class="text-sm text-zinc-500">Nenhum canal Meta Cloud API configurado.</p>
      <NuxtLink to="/whatsapp" class="mt-3 text-xs text-blue-400 hover:underline">Ir para Canais →</NuxtLink>
    </div>

    <!-- Loading -->
    <div v-else-if="loadingTemplates" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="i in 6" :key="i" class="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <!-- Empty templates -->
    <div v-else-if="filtered.length === 0 && selectedInstanceId" class="flex flex-col items-center py-16 text-center">
      <p class="text-sm text-zinc-500">Nenhum template encontrado.</p>
      <button class="mt-3 text-xs text-blue-400 hover:underline" @click="syncTemplates">Sincronizar agora</button>
    </div>

    <!-- Templates grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="tpl in filtered"
        :key="tpl.id"
        class="flex flex-col rounded-2xl border bg-zinc-900 p-5 transition"
        :class="statusBorder[tpl.status] ?? 'border-zinc-800 hover:border-zinc-700'"
      >
        <!-- Header -->
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold text-white">{{ tpl.name }}</p>
            <p class="mt-0.5 text-[11px] text-zinc-600">{{ tpl.language }} · {{ categoryLabel[tpl.category] ?? tpl.category }}</p>
          </div>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            :class="statusChip[tpl.status] ?? 'bg-zinc-800 text-zinc-500'"
          >
            {{ statusLabel[tpl.status] ?? tpl.status }}
          </span>
        </div>

        <!-- Quality badge -->
        <div v-if="tpl.quality" class="mt-2">
          <span
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
            :class="qualityChip[tpl.quality] ?? 'bg-zinc-800 text-zinc-500'"
          >
            {{ qualityLabel[tpl.quality] ?? tpl.quality }}
          </span>
        </div>

        <!-- Rejection reason -->
        <p v-if="tpl.rejectionReason" class="mt-2 text-[10px] text-red-400">
          ✕ {{ tpl.rejectionReason }}
        </p>

        <!-- Components preview -->
        <div class="mt-3 flex-1 space-y-1.5">
          <div
            v-for="(comp, ci) in (tpl.components ?? []).slice(0, 3)"
            :key="ci"
            class="rounded-lg bg-zinc-800/50 px-2.5 py-1.5"
          >
            <p class="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{{ comp.type }}</p>
            <p class="mt-0.5 line-clamp-2 text-[11px] text-zinc-400">
              {{ comp.text ?? (Array.isArray(comp.buttons) ? comp.buttons.map((b: any) => b.text).join(' | ') : '—') }}
            </p>
          </div>
        </div>

        <!-- Footer -->
        <p class="mt-3 text-[9px] text-zinc-700">
          Sincronizado {{ formatRelative(tpl.syncedAt) }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw, LayoutList } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })
useHead({ title: "Templates" })

const api = useApi()

interface WaInstance {
  id: string
  name: string
  phoneNumber?: string
  providerType: string
}

interface Template {
  id: string
  name: string
  language: string
  category: string
  status: string
  quality: string | null
  components: any[]
  rejectionReason: string | null
  syncedAt: string
}

// ── State ──────────────────────────────────────────────────────────────────────

const loadingInstances = ref(true)
const loadingTemplates = ref(false)
const syncing          = ref(false)
const syncResult       = ref("")
const instances        = ref<WaInstance[]>([])
const templates        = ref<Template[]>([])
const selectedInstanceId = ref("")
const activeFilter     = ref("ALL")

const metaInstances = computed(() =>
  instances.value.filter((i) => i.providerType === "META_CLOUD_API")
)

const statusFilters = [
  { value: "ALL",      label: "Todos"     },
  { value: "APPROVED", label: "Aprovados" },
  { value: "PENDING",  label: "Pendentes" },
  { value: "REJECTED", label: "Rejeitados"},
  { value: "PAUSED",   label: "Pausados"  },
]

const filtered = computed(() => {
  if (activeFilter.value === "ALL") return templates.value
  return templates.value.filter((t) => t.status === activeFilter.value)
})

function countByStatus(status: string) {
  if (status === "ALL") return templates.value.length
  return templates.value.filter((t) => t.status === status).length
}

// ── Maps ───────────────────────────────────────────────────────────────────────

const categoryLabel: Record<string, string> = {
  UTILITY:        "Utilidade",
  MARKETING:      "Marketing",
  AUTHENTICATION: "Autenticação",
}

const statusLabel: Record<string, string> = {
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  PENDING:  "Pendente",
  PAUSED:   "Pausado",
  DISABLED: "Desativado",
}

const statusChip: Record<string, string> = {
  APPROVED: "bg-emerald-500/15 text-emerald-400",
  REJECTED: "bg-red-500/15 text-red-400",
  PENDING:  "bg-amber-500/15 text-amber-400",
  PAUSED:   "bg-zinc-800 text-zinc-400",
  DISABLED: "bg-zinc-800 text-zinc-600",
}

const statusBorder: Record<string, string> = {
  APPROVED: "border-emerald-900/40 hover:border-emerald-800/60",
  REJECTED: "border-red-900/40 hover:border-red-800/60",
  PENDING:  "border-amber-900/40 hover:border-amber-800/60",
}

const qualityLabel: Record<string, string> = {
  GREEN:  "✓ Qualidade alta",
  YELLOW: "⚠ Qualidade média",
  RED:    "✕ Qualidade baixa",
}

const qualityChip: Record<string, string> = {
  GREEN:  "bg-emerald-500/10 text-emerald-400",
  YELLOW: "bg-amber-500/10 text-amber-400",
  RED:    "bg-red-500/10 text-red-400",
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

async function loadInstances() {
  loadingInstances.value = true
  try {
    instances.value = await api<WaInstance[]>("/whatsapp/instances")
    if (metaInstances.value.length === 1) {
      selectedInstanceId.value = metaInstances.value[0].id
      await loadTemplates()
    }
  } catch {}
  loadingInstances.value = false
}

async function loadTemplates() {
  if (!selectedInstanceId.value) return
  loadingTemplates.value = true
  templates.value = []
  syncResult.value = ""
  try {
    templates.value = await api<Template[]>(`/whatsapp/instances/${selectedInstanceId.value}/templates`)
  } catch {}
  loadingTemplates.value = false
}

async function syncTemplates() {
  if (!selectedInstanceId.value || syncing.value) return
  syncing.value   = true
  syncResult.value = ""
  try {
    const result = await api<{ synced: number }>(`/whatsapp/instances/${selectedInstanceId.value}/templates/sync`, { method: "POST" })
    syncResult.value = `${result.synced} template${result.synced !== 1 ? 's' : ''} sincronizado${result.synced !== 1 ? 's' : ''}!`
    await loadTemplates()
    setTimeout(() => { syncResult.value = "" }, 4000)
  } catch {
    syncResult.value = ""
  } finally {
    syncing.value = false
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)   return "agora"
  if (mins < 60)  return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days > 1 ? "s" : ""}`
}

onMounted(loadInstances)
</script>
