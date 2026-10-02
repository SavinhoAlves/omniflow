<template>
  <div class="mx-auto max-w-5xl space-y-5 pb-24">
    <div role="tablist" aria-label="Funis" class="flex flex-wrap items-end gap-1 border-b border-zinc-800">
      <button
        v-for="p in pipelines"
        :key="p.id"
        type="button"
        role="tab"
        :aria-selected="p.id === pipelineId"
        class="-mb-px flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium transition"
        :class="p.id === pipelineId ? 'border-blue-500 text-white' : 'border-transparent text-zinc-400 hover:text-white'"
        @click="selectPipeline(p.id)"
      >
        <span class="h-2 w-2 rounded-full" :style="{ background: p.color }" />
        {{ p.name }}
      </button>
      <button
        type="button"
        class="mb-1.5 ml-2 h-9 rounded-lg border border-dashed border-zinc-700 px-3 text-sm text-zinc-300 transition hover:bg-zinc-900"
        @click="createPipeline"
      >
        + Novo funil
      </button>
    </div>

    <p v-if="error" class="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">{{ error }}</p>

    <div v-if="loading" class="h-96 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />

    <template v-else-if="draft">
      <!-- Funil -->
      <section class="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <label class="block min-w-[220px] flex-1">
          <span class="mb-1.5 block text-xs text-zinc-400">Nome do funil</span>
          <input
            v-model="draft.name"
            maxlength="80"
            class="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-blue-500"
          >
        </label>
        <div>
          <span class="mb-1.5 block text-xs text-zinc-400">Cor</span>
          <div class="flex h-10 items-center gap-1">
            <button
              v-for="c in STAGE_COLORS"
              :key="c"
              type="button"
              :aria-label="`Usar a cor ${c}`"
              :aria-pressed="draft.color === c"
              class="h-6 w-6 rounded-full border-2 transition"
              :class="draft.color === c ? 'border-white' : 'border-transparent'"
              :style="{ background: c }"
              @click="draft.color = c"
            />
          </div>
        </div>
        <button
          type="button"
          class="flex h-10 items-center gap-1.5 rounded-xl border border-red-900 px-3 text-sm text-red-300 transition hover:bg-red-950/50"
          @click="deletePipeline"
        >
          <Trash2 :size="14" /> Excluir funil
        </button>
      </section>

      <!-- Etapas -->
      <section aria-labelledby="stages-title" class="rounded-2xl border border-zinc-800 bg-zinc-900">
        <div class="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
          <div>
            <h2 id="stages-title" class="text-[15px] font-semibold text-white">Etapas</h2>
            <p class="mt-0.5 text-xs text-zinc-400">A probabilidade alimenta a previsão ponderada; o alerta marca negócios parados na etapa.</p>
          </div>
          <span class="text-xs text-zinc-400">{{ draft.stages.length }} etapas · a etapa de ganho é fixa</span>
        </div>

        <div class="hidden grid-cols-[64px_28px_minmax(0,1fr)_130px_150px_40px] gap-3 px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 md:grid">
          <span>Ordem</span><span /><span>Nome</span><span>Probabilidade</span><span>Alerta de parado</span><span />
        </div>
        <ol>
          <li
            v-for="(s, i) in draft.stages"
            :key="s.key"
            class="grid grid-cols-[64px_28px_minmax(0,1fr)_40px] items-center gap-3 border-t border-zinc-800 px-4 py-2.5 md:grid-cols-[64px_28px_minmax(0,1fr)_130px_150px_40px]"
          >
            <span class="flex gap-0.5">
              <button
                type="button"
                :aria-label="`Subir ${s.name}`"
                :disabled="s.isWon || i === 0"
                class="flex h-8 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                @click="moveStage(i, -1)"
              >
                <ChevronUp :size="15" />
              </button>
              <button
                type="button"
                :aria-label="`Descer ${s.name}`"
                :disabled="s.isWon || i >= draft.stages.length - 2"
                class="flex h-8 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                @click="moveStage(i, 1)"
              >
                <ChevronDown :size="15" />
              </button>
            </span>
            <span class="relative">
              <button
                type="button"
                :aria-label="`Cor da etapa ${s.name}`"
                :aria-expanded="colorPickerFor === s.key"
                :disabled="s.isWon"
                class="block h-6 w-6 rounded-md"
                :style="{ background: s.color }"
                @click="colorPickerFor = colorPickerFor === s.key ? null : s.key"
              />
              <span
                v-if="colorPickerFor === s.key"
                class="absolute left-0 top-8 z-10 flex gap-1 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-xl"
              >
                <button
                  v-for="c in STAGE_COLORS"
                  :key="c"
                  type="button"
                  :aria-label="`Cor ${c}`"
                  class="h-6 w-6 rounded-md border-2"
                  :class="s.color === c ? 'border-white' : 'border-transparent'"
                  :style="{ background: c }"
                  @click="s.color = c; colorPickerFor = null"
                />
              </span>
            </span>
            <label>
              <span class="sr-only">Nome da etapa</span>
              <input
                v-model="s.name"
                maxlength="60"
                :disabled="s.isWon"
                class="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-white outline-none focus:border-blue-500 disabled:text-zinc-400"
              >
            </label>
            <label class="hidden items-center gap-1.5 md:flex">
              <span class="sr-only">Probabilidade em porcentagem</span>
              <input
                v-model.number="s.probability"
                type="number"
                min="0"
                max="100"
                :disabled="s.isWon"
                class="h-9 w-20 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-sm tabular-nums text-white outline-none focus:border-blue-500 disabled:text-zinc-400"
              >
              <span class="text-zinc-400">%</span>
            </label>
            <label class="hidden items-center gap-1.5 text-sm text-zinc-300 md:flex">
              <span class="sr-only">Dias para alerta de negócio parado</span>
              <template v-if="!s.isWon">
                após
                <input
                  v-model.number="s.rottenDays"
                  type="number"
                  min="1"
                  max="365"
                  placeholder="—"
                  class="h-9 w-16 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-sm tabular-nums text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                >
                dias
              </template>
              <span v-else class="text-zinc-500">—</span>
            </label>
            <span class="flex justify-center">
              <Lock v-if="s.isWon" :size="15" class="text-zinc-500" aria-label="Etapa fixa" />
              <button
                v-else
                type="button"
                :aria-label="`Remover etapa ${s.name}`"
                class="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
                @click="removeStage(i)"
              >
                <Trash2 :size="15" />
              </button>
            </span>
          </li>
        </ol>
        <div class="border-t border-zinc-800 p-4">
          <button
            type="button"
            :disabled="draft.stages.length >= 15"
            class="flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 px-3 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            @click="addStage"
          >
            <Plus :size="14" /> Adicionar etapa
          </button>
        </div>
      </section>

      <!-- Motivos de perda -->
      <section aria-labelledby="lr-title" class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 id="lr-title" class="text-[15px] font-semibold text-white">Motivos de perda</h2>
        <p class="mb-3 mt-0.5 text-xs text-zinc-400">Obrigatórios ao marcar um negócio como perdido — valem para todos os funis.</p>
        <div class="flex flex-wrap gap-2">
          <span v-for="(r, i) in reasons" :key="r" class="flex items-center gap-1 rounded-lg bg-zinc-800 py-1.5 pl-3 pr-1.5 text-sm text-zinc-100">
            {{ r }}
            <button type="button" :aria-label="`Remover motivo ${r}`" class="rounded p-0.5 text-zinc-400 hover:text-white" @click="reasons.splice(i, 1); reasonsDirty = true">
              <X :size="13" />
            </button>
          </span>
          <input
            v-model="reasonDraft"
            aria-label="Novo motivo de perda"
            placeholder="+ Adicionar motivo"
            maxlength="100"
            class="h-9 w-48 rounded-lg border border-dashed border-zinc-700 bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
            @keydown.enter.prevent="addReason"
          >
        </div>
      </section>
    </template>

    <div
      v-if="dirty"
      role="status"
      class="fixed bottom-0 left-64 right-0 z-20 flex items-center justify-end gap-2.5 border-t border-zinc-800 bg-zinc-950/95 px-6 py-3.5 backdrop-blur"
    >
      <span class="flex-1 text-sm text-amber-300">Você tem alterações não salvas</span>
      <button type="button" class="h-10 rounded-xl border border-zinc-700 px-4 text-sm text-white hover:bg-zinc-900" @click="resetDraft">Descartar</button>
      <button type="button" :disabled="saving" class="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50" @click="save">
        {{ saving ? 'Salvando…' : 'Salvar alterações' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronUp, Lock, Plus, Trash2, X } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"
import { STAGE_COLORS, apiErrorMessage, type Pipeline } from "../../composables/useCrm"

definePageMeta({ middleware: "auth" })
useHead({ title: "Configurar funil" })

interface StageDraft {
  key: string
  id?: string
  name: string
  color: string
  probability: number
  rottenDays: number | null | ""
  isWon: boolean
}

const api = useApi()
const pipelines = ref<Pipeline[]>([])
const pipelineId = ref("")
const draft = ref<{ name: string; color: string; stages: StageDraft[] } | null>(null)
const snapshot = ref("")
const reasons = ref<string[]>([])
const reasonDraft = ref("")
const reasonsDirty = ref(false)
const loading = ref(true)
const saving = ref(false)
const error = ref("")
const colorPickerFor = ref<string | null>(null)

let keySeq = 0

const pipeline = computed(() => pipelines.value.find((p) => p.id === pipelineId.value))
const dirty = computed(() => reasonsDirty.value || (!!draft.value && JSON.stringify(draft.value) !== snapshot.value))

function resetDraft() {
  const p = pipeline.value
  draft.value = p
    ? {
        name: p.name,
        color: p.color,
        stages: p.stages.map((s) => ({
          key: s.id, id: s.id, name: s.name, color: s.color,
          probability: s.probability, rottenDays: s.rottenDays ?? null, isWon: s.isWon,
        })),
      }
    : null
  snapshot.value = JSON.stringify(draft.value)
  reasonsDirty.value = false
  loadReasons()
}

async function loadReasons() {
  try {
    reasons.value = (await api<{ name: string }[]>("/crm/lost-reasons")).map((r) => r.name)
  } catch {}
}

async function load(selectId?: string) {
  loading.value = true
  try {
    pipelines.value = await api<Pipeline[]>("/crm/pipelines")
    pipelineId.value = selectId && pipelines.value.some((p) => p.id === selectId)
      ? selectId
      : pipelines.value.find((p) => p.isDefault)?.id ?? pipelines.value[0]?.id ?? ""
    resetDraft()
    error.value = ""
  } catch (err) {
    error.value = apiErrorMessage(err, "Não foi possível carregar os funis.")
  } finally {
    loading.value = false
  }
}

function selectPipeline(id: string) {
  if (id === pipelineId.value) return
  if (dirty.value && !confirm("Descartar as alterações não salvas deste funil?")) return
  pipelineId.value = id
  resetDraft()
}

function moveStage(i: number, dir: -1 | 1) {
  const list = draft.value!.stages
  const j = i + dir
  if (j < 0 || list[j]?.isWon) return
  ;[list[i], list[j]] = [list[j], list[i]]
}

function addStage() {
  const list = draft.value!.stages
  const wonIdx = list.findIndex((s) => s.isWon)
  const stage: StageDraft = {
    key: `new-${++keySeq}`, name: "Nova etapa", color: STAGE_COLORS[3], probability: 50, rottenDays: 7, isWon: false,
  }
  list.splice(wonIdx === -1 ? list.length : wonIdx, 0, stage)
}

function removeStage(i: number) {
  draft.value!.stages.splice(i, 1)
}

function addReason() {
  const r = reasonDraft.value.trim()
  reasonDraft.value = ""
  if (!r || reasons.value.includes(r)) return
  reasons.value.push(r)
  reasonsDirty.value = true
}

async function save() {
  if (!draft.value || !pipeline.value) return
  if (draft.value.stages.some((s) => !s.name.trim())) {
    error.value = "Toda etapa precisa de um nome."
    return
  }
  saving.value = true
  error.value = ""
  try {
    await api(`/crm/pipelines/${pipeline.value.id}`, {
      method: "PUT",
      body: {
        name: draft.value.name.trim(),
        color: draft.value.color,
        stages: draft.value.stages.filter((s) => !s.isWon).map((s) => ({
          id: s.id,
          name: s.name.trim(),
          color: s.color,
          probability: Math.max(0, Math.min(100, Number(s.probability) || 0)),
          rottenDays: s.rottenDays === "" || s.rottenDays == null ? null : Number(s.rottenDays),
        })),
      },
    })
    if (reasonsDirty.value && reasons.value.length) {
      await api("/crm/lost-reasons", { method: "PUT", body: { names: reasons.value } })
    }
    await load(pipeline.value.id)
  } catch (err) {
    error.value = apiErrorMessage(err, "Não foi possível salvar. Verifique se você tem permissão para configurar o CRM.")
  } finally {
    saving.value = false
  }
}

async function createPipeline() {
  const name = prompt("Nome do novo funil:")?.trim()
  if (!name) return
  try {
    const created = await api<Pipeline>("/crm/pipelines", { method: "POST", body: { name } })
    await load(created.id)
  } catch (err) {
    error.value = apiErrorMessage(err, "Não foi possível criar o funil.")
  }
}

async function deletePipeline() {
  if (!pipeline.value) return
  if (!confirm(`Excluir o funil "${pipeline.value.name}"?`)) return
  try {
    await api(`/crm/pipelines/${pipeline.value.id}`, { method: "DELETE" })
    await load()
  } catch (err) {
    error.value = apiErrorMessage(err, "Não foi possível excluir o funil.")
  }
}

onMounted(() => load())
</script>
