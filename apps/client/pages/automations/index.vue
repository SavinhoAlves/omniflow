<template>
  <div class="space-y-6">

    <!-- Tabs -->
    <div class="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1 w-fit">
      <button
        class="rounded-lg px-4 py-2 text-sm font-medium transition-all"
        :class="tab === 'rules' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'"
        @click="tab = 'rules'"
      >
        Regras de automação
      </button>
      <button
        class="rounded-lg px-4 py-2 text-sm font-medium transition-all"
        :class="tab === 'sla' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'"
        @click="tab = 'sla'"
      >
        Políticas de SLA
      </button>
    </div>

    <!-- ══════════════ REGRAS ══════════════ -->
    <template v-if="tab === 'rules'">
      <div class="flex items-center justify-between">
        <p class="text-sm text-zinc-500">
          Regras são avaliadas na ordem de prioridade quando um evento ocorre.
        </p>
        <button
          class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          @click="openRuleForm()"
        >
          <Plus :size="16" />
          Nova regra
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loadingRules" class="space-y-3">
        <div v-for="i in 4" :key="i" class="h-20 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
      </div>

      <!-- Empty -->
      <div v-else-if="rules.length === 0" class="flex flex-col items-center py-20 text-center">
        <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
          <Zap :size="24" class="text-zinc-700" />
        </div>
        <p class="text-sm font-medium text-zinc-500">Nenhuma regra configurada</p>
        <p class="mt-1 text-xs text-zinc-700">Crie regras para atribuir, fechar ou tagear conversas automaticamente.</p>
      </div>

      <!-- Rules list -->
      <div v-else class="space-y-3">
        <div
          v-for="rule in rules"
          :key="rule.id"
          class="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-zinc-700"
        >
          <!-- Enable toggle -->
          <button
            class="mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200"
            :class="rule.enabled ? 'bg-blue-600' : 'bg-zinc-700'"
            @click="toggleRule(rule)"
          >
            <span
              class="mx-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
              :class="rule.enabled ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-semibold text-white">{{ rule.name }}</p>
              <span class="rounded-full border border-zinc-700/60 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                {{ TRIGGER_LABELS[rule.trigger] ?? rule.trigger }}
              </span>
              <span class="text-[10px] text-zinc-700">prioridade {{ rule.priority }}</span>
            </div>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <span
                v-for="action in (rule.actions as any[])"
                :key="action.type"
                class="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400"
              >
                {{ ACTION_LABELS[action.type] ?? action.type }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex shrink-0 items-center gap-1">
            <button
              class="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
              @click="openRuleForm(rule)"
            >
              <Pencil :size="14" />
            </button>
            <button
              class="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-800 hover:text-red-400"
              @click="deleteRule(rule)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════ SLA ══════════════ -->
    <template v-else>
      <p class="text-sm text-zinc-500">
        Define os tempos máximos de primeira resposta e resolução por prioridade de conversa.
      </p>

      <div v-if="loadingSla" class="space-y-3">
        <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="priority in SLA_PRIORITIES"
          :key="priority.value"
          class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                :class="priority.iconClass"
              >
                <Flag :size="14" />
              </span>
              <div>
                <p class="font-semibold text-white">{{ priority.label }}</p>
                <p class="text-xs text-zinc-500">Prioridade {{ priority.label.toLowerCase() }}</p>
              </div>
            </div>

            <div class="flex items-center gap-6">
              <div class="text-right">
                <label class="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">1ª Resposta</label>
                <div class="flex items-center gap-1.5">
                  <input
                    v-model.number="slaForm[priority.value].firstResponseMin"
                    type="number"
                    min="1"
                    class="w-20 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-sm text-white outline-none transition focus:border-blue-500 text-center"
                  />
                  <span class="text-xs text-zinc-500">min</span>
                </div>
              </div>
              <div class="text-right">
                <label class="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Resolução</label>
                <div class="flex items-center gap-1.5">
                  <input
                    v-model.number="slaForm[priority.value].resolutionMin"
                    type="number"
                    min="1"
                    class="w-20 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-sm text-white outline-none transition focus:border-blue-500 text-center"
                  />
                  <span class="text-xs text-zinc-500">min</span>
                </div>
              </div>
              <button
                class="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
                :disabled="savingSla === priority.value"
                @click="saveSla(priority.value)"
              >
                <LoaderCircle v-if="savingSla === priority.value" :size="12" class="animate-spin" />
                <span v-else>Salvar</span>
              </button>
            </div>
          </div>

          <!-- Current saved values -->
          <div v-if="slaData[priority.value]" class="mt-3 flex gap-4 border-t border-zinc-800/60 pt-3 text-[11px] text-zinc-600">
            <span>Atual: 1ª resposta {{ slaData[priority.value]?.firstResponseMin }}min</span>
            <span>·</span>
            <span>Resolução {{ slaData[priority.value]?.resolutionMin }}min</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Rule modal ── -->
    <Teleport to="body">
      <div
        v-if="showRuleModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        @click.self="showRuleModal = false"
      >
        <div class="flex w-full max-w-lg flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 shadow-2xl" style="max-height: 90vh;">
          <div class="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
            <div>
              <h2 class="text-base font-semibold text-white">{{ editingRule ? 'Editar regra' : 'Nova regra' }}</h2>
              <p class="mt-0.5 text-xs text-zinc-500">Configure o gatilho e as ações automáticas.</p>
            </div>
            <button class="text-zinc-600 transition hover:text-zinc-300" @click="showRuleModal = false">
              <X :size="18" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            <div>
              <label class="text-sm font-medium text-zinc-400">Nome da regra <span class="text-red-400">*</span></label>
              <input
                v-model="ruleForm.name"
                type="text"
                placeholder="Ex: Auto-assign vendas"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label class="text-sm font-medium text-zinc-400">Gatilho <span class="text-red-400">*</span></label>
              <select v-model="ruleForm.trigger" class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500">
                <option v-for="(label, val) in TRIGGER_LABELS" :key="val" :value="val">{{ label }}</option>
              </select>
            </div>

            <div>
              <label class="text-sm font-medium text-zinc-400">Prioridade <span class="text-zinc-600">(ordem de avaliação)</span></label>
              <input
                v-model.number="ruleForm.priority"
                type="number"
                min="0"
                class="mt-1.5 w-32 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-medium text-zinc-400">Ações <span class="text-red-400">*</span></label>
                <button class="text-xs text-blue-400 hover:text-blue-300 transition" @click="addAction">
                  + Adicionar ação
                </button>
              </div>
              <div class="space-y-2">
                <div
                  v-for="(action, idx) in ruleForm.actions"
                  :key="idx"
                  class="flex items-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-800/30 px-3 py-2.5"
                >
                  <select
                    v-model="action.type"
                    class="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none transition focus:border-blue-500"
                  >
                    <option v-for="(label, val) in ACTION_LABELS" :key="val" :value="val">{{ label }}</option>
                  </select>
                  <button class="text-zinc-600 hover:text-red-400 transition" @click="removeAction(idx)">
                    <X :size="14" />
                  </button>
                </div>
                <p v-if="ruleForm.actions.length === 0" class="text-xs text-zinc-700 py-2 text-center">
                  Nenhuma ação adicionada
                </p>
              </div>
            </div>

            <p v-if="ruleFormError" class="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {{ ruleFormError }}
            </p>
          </div>

          <div class="shrink-0 border-t border-zinc-800 px-6 py-4">
            <button
              :disabled="savingRule || !ruleForm.name.trim() || ruleForm.actions.length === 0"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              @click="saveRule"
            >
              <LoaderCircle v-if="savingRule" :size="15" class="animate-spin" />
              {{ editingRule ? 'Salvar alterações' : 'Criar regra' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Plus, Zap, Pencil, Trash2, X, LoaderCircle, Flag } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })
useHead({ title: "Automações" })

const api = useApi()

// ── Types ─────────────────────────────────────────────────────────────────────

interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  trigger: string
  conditions: unknown[]
  actions: unknown[]
}

interface SlaPolicy {
  priority: string
  firstResponseMin: number
  resolutionMin: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  conversation_created: "Nova conversa criada",
  message_received:     "Mensagem recebida",
  idle:                 "Conversa ociosa",
}

const ACTION_LABELS: Record<string, string> = {
  assign_department: "Atribuir departamento",
  assign_agent:      "Atribuir atendente",
  set_priority:      "Definir prioridade",
  add_tag:           "Adicionar tag",
  close:             "Fechar conversa",
  send_message:      "Enviar mensagem",
}

const SLA_PRIORITIES = [
  { value: "LOW",    label: "Baixa",   iconClass: "bg-blue-500/10 text-blue-400" },
  { value: "MEDIUM", label: "Média",   iconClass: "bg-zinc-800 text-zinc-400" },
  { value: "HIGH",   label: "Alta",    iconClass: "bg-orange-500/10 text-orange-400" },
  { value: "URGENT", label: "Urgente", iconClass: "bg-red-500/10 text-red-400" },
]

// ── State ─────────────────────────────────────────────────────────────────────

const tab = ref<"rules" | "sla">("rules")

// Rules
const loadingRules  = ref(true)
const rules         = ref<AutomationRule[]>([])
const showRuleModal = ref(false)
const savingRule    = ref(false)
const ruleFormError = ref("")
const editingRule   = ref<AutomationRule | null>(null)

const ruleForm = reactive({
  name:     "",
  trigger:  "conversation_created" as string,
  priority: 0,
  actions:  [] as { type: string }[],
})

// SLA
const loadingSla = ref(true)
const slaData    = ref<Record<string, SlaPolicy>>({})
const slaForm    = reactive<Record<string, { firstResponseMin: number; resolutionMin: number }>>({
  LOW:    { firstResponseMin: 60,  resolutionMin: 480  },
  MEDIUM: { firstResponseMin: 30,  resolutionMin: 240  },
  HIGH:   { firstResponseMin: 15,  resolutionMin: 120  },
  URGENT: { firstResponseMin: 5,   resolutionMin: 60   },
})
const savingSla = ref<string | null>(null)

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function loadRules() {
  loadingRules.value = true
  try { rules.value = await api<AutomationRule[]>("/automations/rules") } catch {}
  loadingRules.value = false
}

async function loadSla() {
  loadingSla.value = true
  try {
    const policies = await api<SlaPolicy[]>("/automations/sla")
    for (const p of policies) {
      slaData.value[p.priority] = p
      slaForm[p.priority] = { firstResponseMin: p.firstResponseMin, resolutionMin: p.resolutionMin }
    }
  } catch {}
  loadingSla.value = false
}

// ── Rule actions ──────────────────────────────────────────────────────────────

function openRuleForm(rule?: AutomationRule) {
  editingRule.value   = rule ?? null
  ruleFormError.value = ""
  if (rule) {
    ruleForm.name     = rule.name
    ruleForm.trigger  = rule.trigger
    ruleForm.priority = rule.priority
    ruleForm.actions  = (rule.actions as any[]).map((a) => ({ type: a.type }))
  } else {
    ruleForm.name     = ""
    ruleForm.trigger  = "conversation_created"
    ruleForm.priority = 0
    ruleForm.actions  = []
  }
  showRuleModal.value = true
}

function addAction() {
  ruleForm.actions.push({ type: "assign_department" })
}

function removeAction(idx: number) {
  ruleForm.actions.splice(idx, 1)
}

async function saveRule() {
  if (!ruleForm.name.trim() || ruleForm.actions.length === 0) return
  savingRule.value    = true
  ruleFormError.value = ""
  try {
    const body = {
      name:       ruleForm.name.trim(),
      trigger:    ruleForm.trigger,
      priority:   ruleForm.priority,
      conditions: [],
      actions:    ruleForm.actions.map((a) => ({ type: a.type, params: {} })),
    }
    if (editingRule.value) {
      await api(`/automations/rules/${editingRule.value.id}`, { method: "PUT", body })
    } else {
      await api("/automations/rules", { method: "POST", body })
    }
    showRuleModal.value = false
    await loadRules()
  } catch (err: any) {
    ruleFormError.value = err?.data?.error ?? err?.data?.message ?? "Erro ao salvar regra."
  } finally {
    savingRule.value = false
  }
}

async function toggleRule(rule: AutomationRule) {
  try {
    await api(`/automations/rules/${rule.id}`, { method: "PUT", body: { enabled: !rule.enabled } })
    rule.enabled = !rule.enabled
  } catch {}
}

async function deleteRule(rule: AutomationRule) {
  if (!confirm(`Excluir a regra "${rule.name}"?`)) return
  try {
    await api(`/automations/rules/${rule.id}`, { method: "DELETE" })
    rules.value = rules.value.filter((r) => r.id !== rule.id)
  } catch (err: any) {
    alert(err?.data?.error ?? "Falha ao excluir.")
  }
}

// ── SLA ───────────────────────────────────────────────────────────────────────

async function saveSla(priority: string) {
  savingSla.value = priority
  try {
    const policy = await api<SlaPolicy>("/automations/sla", {
      method: "PUT",
      body: {
        priority,
        firstResponseMin: slaForm[priority].firstResponseMin,
        resolutionMin:    slaForm[priority].resolutionMin,
      },
    })
    slaData.value[priority] = policy
  } catch (err: any) {
    alert(err?.data?.error ?? "Falha ao salvar SLA.")
  } finally {
    savingSla.value = null
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  loadRules()
  loadSla()
})
</script>
