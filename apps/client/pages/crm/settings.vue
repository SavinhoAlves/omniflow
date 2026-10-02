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

        <div class="hidden grid-cols-[64px_28px_minmax(0,1fr)_120px_140px_110px_40px] gap-3 px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 md:grid">
          <span>Ordem</span><span /><span>Nome</span><span>Probabilidade</span><span>Alerta de parado</span><span>Ao entrar</span><span />
        </div>
        <ol>
          <li
            v-for="(s, i) in draft.stages"
            :key="s.key"
            class="border-t border-zinc-800"
          >
          <div class="grid grid-cols-[64px_28px_minmax(0,1fr)_auto_40px] items-center gap-3 px-4 py-2.5 md:grid-cols-[64px_28px_minmax(0,1fr)_120px_140px_110px_40px]">
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
            <button
              type="button"
              :aria-expanded="expandedStage === s.key"
              :aria-label="`Ações ao entrar em ${s.name}`"
              class="flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs transition"
              :class="s.onEnter.length ? 'border-violet-800 bg-violet-950/60 text-violet-200' : 'border-zinc-800 text-zinc-400 hover:text-white'"
              @click="expandedStage = expandedStage === s.key ? null : s.key"
            >
              <Zap :size="12" />
              {{ s.onEnter.length ? `${s.onEnter.length} ${s.onEnter.length === 1 ? 'ação' : 'ações'}` : 'Ações' }}
            </button>
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
          </div>
          <div v-if="expandedStage === s.key" class="border-t border-zinc-800/60 bg-zinc-900/60 px-4 py-3 md:pl-[116px]">
            <p class="mb-2.5 text-xs font-semibold text-zinc-300">Quando um negócio entrar em “{{ s.name }}”:</p>
            <CrmStageActionsEditor v-model="s.onEnter" :stage-name="s.name" />
          </div>
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

      <!-- Automações do funil -->
      <section aria-labelledby="au-title" class="rounded-2xl border border-zinc-800 bg-zinc-900">
        <div class="p-4 pb-3">
          <h2 id="au-title" class="flex items-center gap-2 text-[15px] font-semibold text-white"><Zap :size="15" class="text-violet-300" /> Integração com o atendimento</h2>
          <p class="mt-0.5 text-xs text-zinc-400">Regras que ligam conversas, bot e envios ao funil “{{ draft.name }}”. Tudo que acontece fica registrado na linha do tempo do negócio.</p>
        </div>

        <ul>
          <!-- Criar negócio por departamento -->
          <li class="border-t border-zinc-800 p-4">
            <div class="flex items-start gap-4">
              <div class="min-w-0 flex-1">
                <p class="text-[13.5px] font-medium text-white">Criar negócio quando a conversa for direcionada a um departamento</p>
                <p class="text-xs text-zinc-400">Pelo bot de triagem ou por transferência. O negócio nasce na primeira etapa com contato, conversa e origem preenchidos.</p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="draft.automations.createOnDepartment.enabled"
                aria-label="Criar negócio por departamento"
                class="relative h-[26px] w-11 shrink-0 rounded-full transition"
                :class="draft.automations.createOnDepartment.enabled ? 'bg-blue-600' : 'bg-zinc-700'"
                @click="draft.automations.createOnDepartment.enabled = !draft.automations.createOnDepartment.enabled"
              >
                <span class="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all" :class="draft.automations.createOnDepartment.enabled ? 'left-[21px]' : 'left-[3px]'" />
              </button>
            </div>
            <div v-if="draft.automations.createOnDepartment.enabled" class="mt-3 flex flex-wrap gap-1.5">
              <p v-if="!departments.length" class="text-xs text-zinc-500">Nenhum departamento cadastrado.</p>
              <button
                v-for="d in departments"
                :key="d.id"
                type="button"
                :aria-pressed="draft.automations.createOnDepartment.departmentIds.includes(d.id)"
                class="h-8 rounded-full border px-3 text-xs transition"
                :class="draft.automations.createOnDepartment.departmentIds.includes(d.id) ? 'border-blue-500 bg-blue-950/60 text-blue-100' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'"
                @click="toggleDepartment(d.id)"
              >
                {{ d.name }}
              </button>
            </div>
          </li>

          <!-- Proposta -->
          <li class="border-t border-zinc-800 p-4">
            <div class="flex items-start gap-4">
              <div class="min-w-0 flex-1">
                <p class="text-[13.5px] font-medium text-white">Avançar o negócio ao enviar a proposta na conversa</p>
                <p class="text-xs text-zinc-400">Quando um documento com a palavra-chave no nome é enviado. O negócio só avança, nunca volta de etapa.</p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="draft.automations.proposalDocument.enabled"
                aria-label="Avançar ao enviar proposta"
                class="relative h-[26px] w-11 shrink-0 rounded-full transition"
                :class="draft.automations.proposalDocument.enabled ? 'bg-blue-600' : 'bg-zinc-700'"
                @click="draft.automations.proposalDocument.enabled = !draft.automations.proposalDocument.enabled"
              >
                <span class="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all" :class="draft.automations.proposalDocument.enabled ? 'left-[21px]' : 'left-[3px]'" />
              </button>
            </div>
            <div v-if="draft.automations.proposalDocument.enabled" class="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
              Palavra-chave
              <input
                v-model="draft.automations.proposalDocument.keyword"
                aria-label="Palavra-chave no nome do arquivo"
                maxlength="50"
                class="h-9 w-36 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-sm text-white outline-none focus:border-blue-500"
              >
              mover para
              <select
                v-model="draft.automations.proposalDocument.stageId"
                aria-label="Etapa de destino"
                class="h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-sm text-white outline-none [color-scheme:dark]"
              >
                <option v-for="s in draft.stages.filter((x) => x.id)" :key="s.key" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
          </li>

          <!-- Quem responde primeiro -->
          <li class="flex items-start gap-4 border-t border-zinc-800 p-4">
            <div class="min-w-0 flex-1">
              <p class="text-[13.5px] font-medium text-white">Atribuir o negócio a quem responder primeiro</p>
              <p class="text-xs text-zinc-400">Vale para negócios sem responsável. As tarefas sem dono passam para a mesma pessoa.</p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="draft.automations.assignFirstResponder.enabled"
              aria-label="Atribuir a quem responder primeiro"
              class="relative h-[26px] w-11 shrink-0 rounded-full transition"
              :class="draft.automations.assignFirstResponder.enabled ? 'bg-blue-600' : 'bg-zinc-700'"
              @click="draft.automations.assignFirstResponder.enabled = !draft.automations.assignFirstResponder.enabled"
            >
              <span class="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all" :class="draft.automations.assignFirstResponder.enabled ? 'left-[21px]' : 'left-[3px]'" />
            </button>
          </li>

          <!-- CSAT -->
          <li class="border-t border-zinc-800 p-4">
            <div class="flex items-start gap-4">
              <div class="min-w-0 flex-1">
                <p class="text-[13.5px] font-medium text-white">Enviar pesquisa de satisfação ao ganhar o negócio</p>
                <p class="text-xs text-zinc-400">A resposta “1” a “5” do cliente em até 72h vira a nota CSAT da conversa, e o cliente recebe um agradecimento.</p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="draft.automations.csatOnWon.enabled"
                aria-label="Pesquisa de satisfação ao ganhar"
                class="relative h-[26px] w-11 shrink-0 rounded-full transition"
                :class="draft.automations.csatOnWon.enabled ? 'bg-blue-600' : 'bg-zinc-700'"
                @click="draft.automations.csatOnWon.enabled = !draft.automations.csatOnWon.enabled"
              >
                <span class="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all" :class="draft.automations.csatOnWon.enabled ? 'left-[21px]' : 'left-[3px]'" />
              </button>
            </div>
            <label v-if="draft.automations.csatOnWon.enabled" class="mt-3 block">
              <span class="mb-1 block text-xs text-zinc-400">Mensagem (use <code v-pre class="text-zinc-300">{{nome}}</code> para o nome do contato)</span>
              <textarea
                v-model="draft.automations.csatOnWon.message"
                rows="2"
                maxlength="1000"
                class="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
            </label>
          </li>
        </ul>
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
import { ChevronDown, ChevronUp, Lock, Plus, Trash2, X, Zap } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"
import {
  DEFAULT_CSAT_MESSAGE, STAGE_COLORS, apiErrorMessage, type Pipeline, type StageAction,
} from "../../composables/useCrm"

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
  onEnter: StageAction[]
}

interface AutomationsDraft {
  createOnDepartment: { enabled: boolean; departmentIds: string[] }
  proposalDocument: { enabled: boolean; keyword: string; stageId: string | null }
  assignFirstResponder: { enabled: boolean }
  csatOnWon: { enabled: boolean; message: string }
}

const api = useApi()
const pipelines = ref<Pipeline[]>([])
const pipelineId = ref("")
const draft = ref<{ name: string; color: string; stages: StageDraft[]; automations: AutomationsDraft } | null>(null)
const departments = ref<{ id: string; name: string }[]>([])
const expandedStage = ref<string | null>(null)
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

function automationsDraft(p: Pipeline): AutomationsDraft {
  const a = p.automations ?? {}
  return {
    createOnDepartment: { enabled: !!a.createOnDepartment?.enabled, departmentIds: [...(a.createOnDepartment?.departmentIds ?? [])] },
    proposalDocument: {
      enabled: !!a.proposalDocument?.enabled,
      keyword: a.proposalDocument?.keyword ?? "proposta",
      stageId: a.proposalDocument?.stageId ?? p.stages.find((s) => s.name.toLowerCase().includes("proposta"))?.id ?? null,
    },
    assignFirstResponder: { enabled: !!a.assignFirstResponder?.enabled },
    csatOnWon: { enabled: !!a.csatOnWon?.enabled, message: a.csatOnWon?.message ?? DEFAULT_CSAT_MESSAGE },
  }
}

function resetDraft() {
  const p = pipeline.value
  draft.value = p
    ? {
        name: p.name,
        color: p.color,
        stages: p.stages.map((s) => ({
          key: s.id, id: s.id, name: s.name, color: s.color,
          probability: s.probability, rottenDays: s.rottenDays ?? null, isWon: s.isWon,
          onEnter: JSON.parse(JSON.stringify(s.onEnter ?? [])),
        })),
        automations: automationsDraft(p),
      }
    : null
  expandedStage.value = null
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
    key: `new-${++keySeq}`, name: "Nova etapa", color: STAGE_COLORS[3], probability: 50, rottenDays: 7, isWon: false, onEnter: [],
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
  const incomplete = draft.value.stages.find((s) =>
    s.onEnter.some((a) => (a.type === "create_task" ? !a.title.trim() : !a.text.trim()))
  )
  if (incomplete) {
    error.value = `Preencha ou remova as ações vazias da etapa “${incomplete.name}”.`
    expandedStage.value = incomplete.key
    return
  }
  const auto = draft.value.automations
  if (auto.createOnDepartment.enabled && !auto.createOnDepartment.departmentIds.length) {
    error.value = "Escolha pelo menos um departamento para criar negócios automaticamente."
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
        automations: {
          ...auto,
          proposalDocument: { ...auto.proposalDocument, keyword: auto.proposalDocument.keyword.trim() || "proposta" },
          csatOnWon: { ...auto.csatOnWon, message: auto.csatOnWon.message.trim() || DEFAULT_CSAT_MESSAGE },
        },
        stages: draft.value.stages.filter((s) => !s.isWon).map((s) => ({
          id: s.id,
          name: s.name.trim(),
          color: s.color,
          probability: Math.max(0, Math.min(100, Number(s.probability) || 0)),
          rottenDays: s.rottenDays === "" || s.rottenDays == null ? null : Number(s.rottenDays),
          onEnter: cleanActions(s.onEnter),
        })),
        wonStageOnEnter: cleanActions(draft.value.stages.find((s) => s.isWon)?.onEnter ?? []),
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

function cleanActions(actions: StageAction[]): StageAction[] {
  return actions.map((a) =>
    a.type === "create_task"
      ? { type: "create_task", taskType: a.taskType, title: a.title.trim(), dueInHours: Math.max(0, Number(a.dueInHours) || 0) }
      : { type: "send_message", text: a.text.trim(), delayMinutes: Math.max(0, Math.round(Number(a.delayMinutes) || 0)) }
  )
}

function toggleDepartment(id: string) {
  const ids = draft.value!.automations.createOnDepartment.departmentIds
  const idx = ids.indexOf(id)
  if (idx === -1) ids.push(id)
  else ids.splice(idx, 1)
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

onMounted(async () => {
  load()
  try { departments.value = await api("/crm/departments") } catch {}
})
</script>
