<template>
  <div class="space-y-6">

    <!-- Header row -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        <button
          v-for="s in STATUS_FILTERS"
          :key="s.value"
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
          :class="statusFilter === s.value ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'"
          @click="statusFilter = s.value; loadCampaigns()"
        >
          {{ s.label }}
        </button>
      </div>
      <button
        class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
        @click="openCreate"
      >
        <Plus :size="16" />
        Nova campanha
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="i in 6" :key="i" class="h-44 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <!-- Empty -->
    <div v-else-if="campaigns.length === 0" class="flex flex-col items-center py-20 text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
        <Megaphone :size="24" class="text-zinc-700" />
      </div>
      <p class="text-sm font-medium text-zinc-500">Nenhuma campanha encontrada</p>
      <p class="mt-1 text-xs text-zinc-700">Crie sua primeira campanha de disparo em massa.</p>
      <button
        class="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
        @click="openCreate"
      >
        <Plus :size="14" />
        Nova campanha
      </button>
    </div>

    <!-- Campaign cards -->
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="camp in campaigns"
        :key="camp.id"
        class="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700"
      >
        <!-- Top row -->
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold text-white">{{ camp.name }}</p>
            <p class="mt-0.5 truncate text-xs text-zinc-500">
              {{ camp.instance?.name ?? '—' }}
              <span v-if="camp.template">· {{ camp.template.name }}</span>
            </p>
            <p v-if="camp.messageText" class="mt-1 line-clamp-2 text-xs text-zinc-400">“{{ camp.messageText }}”</p>
            <p v-else-if="!camp.template" class="mt-1 text-xs text-amber-300">Sem conteúdo — não pode ser disparada</p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            :class="STATUS_CLASSES[camp.status] ?? 'bg-zinc-800 text-zinc-500'"
          >
            {{ STATUS_LABELS[camp.status] ?? camp.status }}
          </span>
        </div>

        <!-- Analytics bar (only when started) -->
        <div v-if="camp.totalCount > 0" class="mt-4 space-y-1.5">
          <div class="flex justify-between text-[11px] text-zinc-500">
            <span>Entregues</span>
            <span>{{ camp.deliveredCount ?? 0 }} / {{ camp.totalCount }}</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              class="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700"
              :style="{ width: `${camp.totalCount > 0 ? Math.round(((camp.deliveredCount ?? 0) / camp.totalCount) * 100) : 0}%` }"
            />
          </div>
          <div class="flex justify-between text-[10px] text-zinc-700">
            <span>{{ camp.sentCount ?? 0 }} enviadas</span>
            <span>{{ camp.readCount ?? 0 }} lidas</span>
          </div>
        </div>

        <!-- No audience yet -->
        <div v-else class="mt-4 rounded-xl border border-dashed border-zinc-800 py-3 text-center text-[11px] text-zinc-700">
          Audiência: {{ audienceLabel((camp.audienceFilter as any)) }}
        </div>

        <!-- Scheduled at -->
        <p v-if="camp.scheduledAt" class="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
          <Calendar :size="11" />
          Agendada para {{ formatDate(camp.scheduledAt) }}
        </p>

        <!-- Actions -->
        <div class="mt-4 flex items-center gap-2 border-t border-zinc-800/60 pt-4">
          <button
            v-if="camp.status === 'DRAFT' || camp.status === 'SCHEDULED'"
            class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            :disabled="launching === camp.id"
            @click="launchCampaign(camp)"
          >
            <LoaderCircle v-if="launching === camp.id" :size="12" class="animate-spin" />
            <Rocket v-else :size="12" />
            Disparar
          </button>
          <button
            v-if="['DRAFT','SCHEDULED','RUNNING','PAUSED'].includes(camp.status)"
            class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            :disabled="cancelling === camp.id"
            @click="cancelCampaign(camp)"
          >
            <LoaderCircle v-if="cancelling === camp.id" :size="12" class="animate-spin" />
            <Ban v-else :size="12" />
            Cancelar
          </button>
          <button
            v-if="camp.status === 'DRAFT' || camp.status === 'CANCELLED'"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-800 text-zinc-600 transition hover:border-red-900/60 hover:text-red-500"
            @click="deleteCampaign(camp)"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Create modal ── -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        @click.self="showModal = false"
      >
        <div class="flex w-full max-w-lg flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 shadow-2xl" style="max-height: 90vh;">
          <div class="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
            <div>
              <h2 class="text-base font-semibold text-white">Nova campanha</h2>
              <p class="mt-0.5 text-xs text-zinc-500">Defina nome, canal, mensagem e audiência do disparo.</p>
            </div>
            <button class="text-zinc-600 transition hover:text-zinc-300" @click="showModal = false">
              <X :size="18" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            <div>
              <label class="text-sm font-medium text-zinc-400">Nome da campanha <span class="text-red-400">*</span></label>
              <input
                v-model="form.name"
                type="text"
                placeholder="Ex: Black Friday 2026"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label class="text-sm font-medium text-zinc-400">Canal (instância) <span class="text-red-400">*</span></label>
              <select v-model="form.instanceId" class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500">
                <option value="" disabled>Selecione...</option>
                <option v-for="inst in instances" :key="inst.id" :value="inst.id">{{ inst.name }}</option>
              </select>
              <p v-if="!instances.length" class="mt-1.5 text-xs text-amber-300">Nenhum canal conectado. Conecte um canal em Canais para criar campanhas.</p>
            </div>

            <!-- Conteúdo: template (WhatsApp oficial) ou mensagem livre (demais canais) -->
            <div v-if="form.instanceId && isMetaInstance">
              <label class="text-sm font-medium text-zinc-400">Template aprovado <span class="text-red-400">*</span></label>
              <select
                v-model="form.templateId"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="" disabled>{{ loadingTemplates ? 'Carregando templates…' : 'Selecione...' }}</option>
                <option v-for="t in approvedTemplates" :key="t.id" :value="t.id">{{ t.name }} · {{ t.language }}</option>
              </select>
              <p class="mt-1.5 text-xs text-zinc-500">O WhatsApp oficial só permite mensagens proativas com template aprovado pela Meta.</p>
              <p v-if="!loadingTemplates && !approvedTemplates.length" class="mt-1 text-xs text-amber-300">
                Nenhum template aprovado neste canal. Sincronize em Templates.
              </p>

              <div v-if="templateVars.length" class="mt-3 space-y-2">
                <p class="text-xs font-medium text-zinc-400">Variáveis do template</p>
                <label v-for="n in templateVars" :key="n" class="flex items-center gap-2">
                  <span class="w-10 shrink-0 text-xs tabular-nums text-zinc-500" v-text="`{{${n}}}`" />
                  <input
                    v-model="form.templateParams[String(n)]"
                    :aria-label="`Valor da variável ${n}`"
                    maxlength="500"
                    placeholder="Texto fixo, ou {{nome}} para o nome do contato"
                    class="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                  />
                </label>
              </div>
            </div>

            <div v-else-if="form.instanceId">
              <label class="text-sm font-medium text-zinc-400">Mensagem <span class="text-red-400">*</span></label>
              <textarea
                v-model="form.messageText"
                rows="4"
                maxlength="4000"
                placeholder="Ex.: Oi, {{nome}}! Temos uma condição especial de energia solar este mês. Quer saber mais?"
                class="mt-1.5 w-full resize-y rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
              />
              <p class="mt-1 text-xs text-zinc-500">Use <code v-pre class="text-zinc-300">{{nome}}</code> para o nome do contato.</p>
            </div>

            <div v-if="previewText" class="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p class="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Prévia para “Maria”</p>
              <p class="whitespace-pre-line rounded-lg bg-emerald-950/60 px-3 py-2 text-sm text-emerald-50">{{ previewText }}</p>
            </div>

            <div>
              <label class="text-sm font-medium text-zinc-400">Audiência</label>
              <div class="mt-2 flex gap-2">
                <button
                  class="flex-1 rounded-xl border py-2.5 text-xs font-medium transition"
                  :class="form.segment === 'opted_in' ? 'border-blue-500/50 bg-blue-500/10 text-blue-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'"
                  @click="form.segment = 'opted_in'; previewAudience()"
                >
                  Opt-in confirmado
                </button>
                <button
                  class="flex-1 rounded-xl border py-2.5 text-xs font-medium transition"
                  :class="form.segment === 'all' ? 'border-blue-500/50 bg-blue-500/10 text-blue-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'"
                  @click="form.segment = 'all'; previewAudience()"
                >
                  Todos os contatos
                </button>
              </div>
              <p v-if="audienceCount !== null" class="mt-2 text-xs text-zinc-500">
                <span class="font-semibold text-white">{{ audienceCount }}</span> contatos elegíveis
                · quem pediu para sair (opt-out) nunca recebe
              </p>
            </div>

            <div>
              <label class="text-sm font-medium text-zinc-400">Agendar para <span class="text-zinc-600">(opcional)</span></label>
              <input
                v-model="form.scheduledAt"
                type="datetime-local"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <p v-if="formError" class="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {{ formError }}
            </p>
          </div>

          <div class="shrink-0 border-t border-zinc-800 px-6 py-4">
            <button
              :disabled="saving || !form.name.trim() || !form.instanceId || !contentReady"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              @click="saveCampaign"
            >
              <LoaderCircle v-if="saving" :size="15" class="animate-spin" />
              Criar campanha
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  Plus, Megaphone, LoaderCircle, X, Trash2, Rocket, Ban, Calendar,
} from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })
useHead({ title: "Campanhas" })

const api = useApi()

// ── Types ─────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string
  name: string
  status: string
  totalCount: number
  sentCount?: number
  deliveredCount?: number
  readCount?: number
  failedCount?: number
  scheduledAt?: string | null
  audienceFilter?: unknown
  template?: { id: string; name: string; language: string } | null
  messageText?: string | null
  instance?: { id: string; name: string } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "",          label: "Todas"     },
  { value: "DRAFT",     label: "Rascunho"  },
  { value: "SCHEDULED", label: "Agendadas" },
  { value: "RUNNING",   label: "Em andamento" },
  { value: "COMPLETED", label: "Concluídas" },
  { value: "CANCELLED", label: "Canceladas" },
]

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     "Rascunho",
  SCHEDULED: "Agendada",
  RUNNING:   "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  PAUSED:    "Pausada",
}

const STATUS_CLASSES: Record<string, string> = {
  DRAFT:     "bg-zinc-800 text-zinc-400",
  SCHEDULED: "bg-blue-500/15 text-blue-400",
  RUNNING:   "bg-amber-500/15 text-amber-400",
  COMPLETED: "bg-emerald-500/15 text-emerald-400",
  CANCELLED: "bg-zinc-800 text-zinc-600",
  PAUSED:    "bg-purple-500/15 text-purple-400",
}

// ── State ─────────────────────────────────────────────────────────────────────

const loading      = ref(true)
const campaigns    = ref<Campaign[]>([])
const statusFilter = ref("")
const launching    = ref<string | null>(null)
const cancelling   = ref<string | null>(null)

// Modal
const showModal    = ref(false)
const saving       = ref(false)
const formError    = ref("")
const audienceCount = ref<number | null>(null)
const instances    = ref<{ id: string; name: string; providerType: string }[]>([])
const templates    = ref<{ id: string; name: string; language: string; status: string; components: any[] }[]>([])
const loadingTemplates = ref(false)

const form = reactive({
  name: "",
  instanceId: "",
  segment: "opted_in" as "opted_in" | "all",
  scheduledAt: "",
  templateId: "",
  templateParams: {} as Record<string, string>,
  messageText: "",
})

const isMetaInstance = computed(() =>
  instances.value.find((i) => i.id === form.instanceId)?.providerType === "META_CLOUD_API"
)
const approvedTemplates = computed(() => templates.value.filter((t) => t.status === "APPROVED"))
const selectedTemplate = computed(() => templates.value.find((t) => t.id === form.templateId) ?? null)
const templateBody = computed(() =>
  (selectedTemplate.value?.components ?? []).find((c: any) => String(c?.type).toUpperCase() === "BODY")?.text ?? ""
)
const templateVars = computed(() =>
  [...new Set([...templateBody.value.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b)
)
const withName = (text: string) => text.replace(/\{\{\s*nome\s*\}\}/gi, "Maria")
const previewText = computed(() => {
  if (isMetaInstance.value) {
    return withName(templateBody.value.replace(/\{\{(\d+)\}\}/g, (m: string, n: string) => form.templateParams[n] || m))
  }
  return withName(form.messageText.trim())
})
const contentReady = computed(() =>
  isMetaInstance.value
    ? !!form.templateId && templateVars.value.every((n) => form.templateParams[String(n)]?.trim())
    : !!form.messageText.trim()
)

async function loadTemplates(instanceId: string) {
  templates.value = []
  form.templateId = ""
  form.templateParams = {}
  if (!instanceId || !isMetaInstance.value) return
  loadingTemplates.value = true
  try {
    templates.value = await api(`/whatsapp/instances/${instanceId}/templates`)
  } catch {
    templates.value = []
  } finally {
    loadingTemplates.value = false
  }
}

watch(() => form.instanceId, (id) => loadTemplates(id))

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function loadCampaigns() {
  loading.value = true
  try {
    const qs = statusFilter.value ? `?status=${statusFilter.value}` : ""
    campaigns.value = await api<Campaign[]>(`/campaigns${qs}`)
  } finally {
    loading.value = false
  }
}

async function loadInstances() {
  try {
    const list = await api<{ id: string; name: string; connectionStatus: string; providerType: string }[]>("/whatsapp/instances")
    instances.value = list.filter((i) => i.connectionStatus === "CONNECTED")
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function audienceLabel(filter: any) {
  if (!filter) return "Todos os opt-ins"
  if (filter.segment === "all") return "Todos os contatos"
  return "Opt-in confirmado"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function launchCampaign(camp: Campaign) {
  if (!confirm(`Disparar a campanha "${camp.name}" para os contatos elegíveis?`)) return
  launching.value = camp.id
  try {
    const res = await api<{ recipients: number }>(`/campaigns/${camp.id}/launch`, { method: "POST" })
    await loadCampaigns()
    alert(`Campanha iniciada! ${res.recipients} destinatários enfileirados.`)
  } catch (err: any) {
    alert(err?.data?.error ?? "Falha ao disparar campanha.")
  } finally {
    launching.value = null
  }
}

async function cancelCampaign(camp: Campaign) {
  if (!confirm(`Cancelar a campanha "${camp.name}"?`)) return
  cancelling.value = camp.id
  try {
    await api(`/campaigns/${camp.id}/cancel`, { method: "POST" })
    await loadCampaigns()
  } catch (err: any) {
    alert(err?.data?.error ?? "Falha ao cancelar.")
  } finally {
    cancelling.value = null
  }
}

async function deleteCampaign(camp: Campaign) {
  if (!confirm(`Excluir a campanha "${camp.name}"? Esta ação não pode ser desfeita.`)) return
  try {
    await api(`/campaigns/${camp.id}`, { method: "DELETE" })
    campaigns.value = campaigns.value.filter((c) => c.id !== camp.id)
  } catch (err: any) {
    alert(err?.data?.error ?? "Falha ao excluir.")
  }
}

function openCreate() {
  form.name        = ""
  form.instanceId  = instances.value[0]?.id ?? ""
  form.segment     = "opted_in"
  form.scheduledAt = ""
  form.messageText = ""
  loadTemplates(form.instanceId)
  formError.value  = ""
  audienceCount.value = null
  showModal.value  = true
  previewAudience()
}

async function previewAudience() {
  try {
    const res = await api<{ count: number }>("/campaigns/audience-preview", {
      method: "POST",
      body: { segment: form.segment },
    })
    audienceCount.value = res.count
  } catch {}
}

async function saveCampaign() {
  if (!form.name.trim() || !form.instanceId || !contentReady.value) return
  saving.value    = true
  formError.value = ""
  try {
    await api("/campaigns", {
      method: "POST",
      body: {
        name: form.name.trim(),
        instanceId: form.instanceId,
        audienceFilter: { segment: form.segment },
        // datetime-local vem sem fuso ("2026-10-02T10:00"); a API exige ISO completo
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        ...(isMetaInstance.value
          ? {
              templateId: form.templateId,
              templateParams: Object.fromEntries(templateVars.value.map((n) => [String(n), form.templateParams[String(n)].trim()])),
            }
          : { messageText: form.messageText.trim() }),
      },
    })
    showModal.value = false
    await loadCampaigns()
  } catch (err: any) {
    formError.value = err?.data?.error ?? err?.data?.message ?? "Não foi possível criar a campanha."
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadCampaigns()
  loadInstances()
})
</script>
