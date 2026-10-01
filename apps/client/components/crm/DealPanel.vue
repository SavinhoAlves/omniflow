<template>
  <div class="px-4 py-4">
    <div class="mb-2 flex items-center justify-between">
      <span class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Negócio</span>
      <NuxtLink v-if="deal" :to="`/crm/deals/${deal.id}`" class="text-[11px] text-blue-300 hover:text-blue-200">Abrir</NuxtLink>
    </div>

    <div v-if="loading" class="h-24 animate-pulse rounded-xl bg-zinc-900" />

    <div v-else-if="deal" class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <NuxtLink :to="`/crm/deals/${deal.id}`" class="block text-[13px] font-semibold leading-snug text-white hover:text-blue-200">
        {{ deal.title }}
      </NuxtLink>
      <div class="mt-1.5 flex items-center justify-between gap-2 text-xs">
        <span class="font-semibold tabular-nums text-white">{{ formatBRL(deal.value) }}</span>
        <span class="truncate text-zinc-400">{{ currentStage?.name }} · {{ currentStage?.probability }}%</span>
      </div>

      <div v-if="stages.length" role="group" aria-label="Mover etapa" class="mt-2.5 grid gap-[3px]" :style="{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }">
        <button
          v-for="(s, i) in stages"
          :key="s.id"
          type="button"
          :title="s.name"
          :aria-label="`Mover para ${s.name}`"
          :aria-pressed="s.id === deal.stageId"
          :disabled="moving"
          class="h-5 rounded transition hover:opacity-80"
          :style="{ background: i <= currentIndex ? currentStage?.color : '#27272a' }"
          @click="move(s.id)"
        />
      </div>

      <p v-if="deal.nextTask" class="mt-2.5 flex items-start gap-1.5 text-[11px]" :class="isOverdue(deal.nextTask.dueAt) ? 'text-red-300' : 'text-zinc-400'">
        <Clock :size="12" class="mt-px shrink-0" />
        <span>{{ deal.nextTask.title || 'Tarefa' }} · {{ formatDue(deal.nextTask.dueAt) }}</span>
      </p>
      <p v-else class="mt-2.5 flex items-center gap-1.5 text-[11px] text-amber-300">
        <AlertCircle :size="12" /> Sem próxima atividade
      </p>

      <p v-if="otherCount" class="mt-2 text-[11px] text-zinc-500">+ {{ otherCount }} outro{{ otherCount > 1 ? 's' : '' }} negócio{{ otherCount > 1 ? 's' : '' }} em aberto</p>
    </div>

    <div v-else class="rounded-xl border border-dashed border-zinc-700 p-3 text-center">
      <p class="text-xs text-zinc-300">Este contato ainda não tem um negócio em aberto.</p>
      <button
        type="button"
        class="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-500"
        @click="showNew = true"
      >
        <Plus :size="13" /> Criar negócio
      </button>
    </div>

    <CrmNewDealModal
      :open="showNew"
      :contact-id="contactId"
      :contact-name="contactName"
      :conversation-id="conversationId"
      :default-source="defaultSource"
      @close="showNew = false"
      @created="onCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, Clock, Plus } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"
import { formatBRL, formatDue, isOverdue, type Deal, type Pipeline } from "../../composables/useCrm"

const props = defineProps<{
  contactId: string
  contactName?: string | null
  conversationId?: string | null
  channelLabel?: string | null
}>()

const api = useApi()
const deals = ref<Deal[]>([])
const pipelines = ref<Pipeline[]>([])
const loading = ref(true)
const moving = ref(false)
const showNew = ref(false)

// Prioriza o negócio criado nesta conversa; senão, o mais recente do contato
const deal = computed(() =>
  deals.value.find((d) => d.conversationId === props.conversationId) ?? deals.value[0] ?? null
)
const otherCount = computed(() => Math.max(0, deals.value.length - 1))
const stages = computed(() => pipelines.value.find((p) => p.id === deal.value?.pipelineId)?.stages ?? [])
const currentIndex = computed(() => stages.value.findIndex((s) => s.id === deal.value?.stageId))
const currentStage = computed(() => stages.value[currentIndex.value])
const defaultSource = computed(() => (props.channelLabel ? `Conversa — ${props.channelLabel}` : null))

async function load() {
  loading.value = true
  try {
    const [d, p] = await Promise.all([
      api<Deal[]>(`/crm/deals?contactId=${props.contactId}&status=OPEN`),
      pipelines.value.length ? Promise.resolve(pipelines.value) : api<Pipeline[]>("/crm/pipelines"),
    ])
    deals.value = d
    pipelines.value = p
  } catch {
    deals.value = []
  } finally {
    loading.value = false
  }
}

async function move(stageId: string) {
  if (!deal.value || stageId === deal.value.stageId) return
  moving.value = true
  try {
    await api(`/crm/deals/${deal.value.id}/move`, { method: "POST", body: { stageId } })
    await load()
  } catch {} finally {
    moving.value = false
  }
}

function onCreated() {
  showNew.value = false
  load()
}

watch(() => props.contactId, load, { immediate: true })
</script>
