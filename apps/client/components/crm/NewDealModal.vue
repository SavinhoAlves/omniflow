<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-deal-title"
        class="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        @submit.prevent="submit"
      >
        <div class="flex items-start gap-3 border-b border-zinc-800 px-6 pb-4 pt-5">
          <div class="flex-1">
            <h2 id="new-deal-title" class="text-lg font-semibold text-white">Novo negócio</h2>
            <p v-if="contactLabel" class="mt-1 text-sm text-zinc-400">
              {{ conversationId ? 'Criado a partir da conversa com' : 'Para' }} {{ contactLabel }}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-4 px-6 py-5">
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-zinc-200">Título do negócio</span>
            <input
              ref="titleRef"
              v-model="form.title"
              required
              maxlength="200"
              placeholder="Ex.: Sistema residencial 5 kWp"
              class="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
            >
          </label>

          <!-- Contato (quando não vem de uma conversa/ficha) -->
          <div v-if="!contactId && !conversationId">
            <span class="mb-1.5 block text-sm font-medium text-zinc-200">Contato</span>
            <div v-if="pickedContact" class="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2">
              <span class="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold" :class="personTone(pickedContact.id)">
                {{ personInitials(pickedContact.name ?? pickedContact.phoneNumber) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-white">{{ pickedContact.name || pickedContact.phoneNumber }}</p>
                <p class="truncate text-xs text-zinc-400">{{ pickedContact.phoneNumber }}</p>
              </div>
              <button type="button" class="rounded-lg px-2 py-1 text-xs text-blue-300 hover:bg-zinc-800" @click="pickedContact = null">Trocar</button>
            </div>
            <div v-else class="relative">
              <input
                v-model="contactSearch"
                type="search"
                placeholder="Buscar contato por nome ou número…"
                class="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                @input="searchContacts"
              >
              <ul
                v-if="contactResults.length"
                class="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
              >
                <li v-for="c in contactResults" :key="c.id">
                  <button type="button" class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-800" @click="pickContact(c)">
                    <span class="text-sm text-white">{{ c.name || c.phoneNumber }}</span>
                    <span class="text-xs text-zinc-500">{{ c.phoneNumber }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-zinc-200">Valor estimado</span>
              <span class="relative flex items-center">
                <span class="pointer-events-none absolute left-3 text-sm text-zinc-500">R$</span>
                <input
                  v-model.number="form.value"
                  type="number"
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                  :placeholder="productsTotal ? String(productsTotal) : '0'"
                  class="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-sm tabular-nums text-white outline-none focus:border-blue-500"
                >
              </span>
            </label>
            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-zinc-200">Previsão de fechamento</span>
              <input
                v-model="form.expectedCloseDate"
                type="date"
                class="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-blue-500"
              >
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-zinc-200">Funil</span>
              <select
                v-model="form.pipelineId"
                class="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-blue-500"
                @change="form.stageId = currentPipeline?.stages[0]?.id ?? ''"
              >
                <option v-for="p in pipelines" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-zinc-200">Responsável</span>
              <select
                v-model="form.ownerId"
                class="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-blue-500"
              >
                <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </label>
          </div>

          <fieldset>
            <legend class="mb-1.5 text-sm font-medium text-zinc-200">Etapa inicial</legend>
            <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <button
                v-for="s in openStages"
                :key="s.id"
                type="button"
                role="radio"
                :aria-checked="form.stageId === s.id"
                class="flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition"
                :class="form.stageId === s.id ? 'border-blue-500 bg-zinc-800' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'"
                @click="form.stageId = s.id"
              >
                <span class="flex items-center gap-1.5 text-xs font-medium text-white">
                  <span class="h-2 w-2 rounded-full" :style="{ background: s.color }" />
                  {{ s.name }}
                </span>
                <span class="text-[11px] text-zinc-400">{{ s.probability }}%</span>
              </button>
            </div>
          </fieldset>

          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-zinc-200">Origem</span>
            <input
              v-model="form.source"
              maxlength="200"
              placeholder="Ex.: Indicação, Campanha de setembro…"
              class="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
            >
          </label>

          <!-- Produtos -->
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-sm font-medium text-zinc-200">Produtos</span>
              <span class="text-xs text-zinc-500">Opcional — a soma vira o valor se ele ficar vazio</span>
            </div>
            <div class="overflow-hidden rounded-xl border border-zinc-800">
              <div v-for="(p, i) in form.products" :key="i" class="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-2 py-1.5">
                <input v-model="p.name" aria-label="Produto" placeholder="Produto ou serviço" class="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:bg-zinc-900">
                <input v-model.number="p.qty" aria-label="Quantidade" type="number" min="1" class="h-9 w-16 rounded-lg bg-transparent px-2 text-right text-sm tabular-nums text-white outline-none focus:bg-zinc-900">
                <input v-model.number="p.price" aria-label="Preço unitário" type="number" min="0" step="0.01" class="h-9 w-28 rounded-lg bg-transparent px-2 text-right text-sm tabular-nums text-white outline-none focus:bg-zinc-900">
                <button type="button" :aria-label="`Remover ${p.name || 'produto'}`" class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white" @click="form.products.splice(i, 1)">
                  <X :size="14" />
                </button>
              </div>
              <button type="button" class="flex h-10 w-full items-center gap-2 px-3 text-sm text-blue-300 hover:bg-zinc-800/60" @click="form.products.push({ name: '', qty: 1, price: 0 })">
                <Plus :size="14" /> Adicionar produto
              </button>
            </div>
            <p v-if="productsTotal" class="mt-1.5 text-right text-xs text-zinc-400">
              Soma dos produtos: <strong class="text-white tabular-nums">{{ formatBRL(productsTotal) }}</strong>
            </p>
          </div>

          <label class="flex cursor-pointer items-start gap-3 rounded-xl bg-zinc-950 p-3">
            <input v-model="form.followUp" type="checkbox" class="mt-0.5 h-4 w-4 accent-blue-600">
            <span>
              <span class="block text-sm font-medium text-white">Criar tarefa de follow-up</span>
              <span class="block text-xs text-zinc-400">“Responder orçamento” para amanhã às 9h</span>
            </span>
          </label>

          <p v-if="error" class="rounded-xl border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{{ error }}</p>
        </div>

        <div class="flex justify-end gap-2 border-t border-zinc-800 px-6 py-4">
          <button type="button" class="h-10 rounded-xl border border-zinc-700 px-4 text-sm text-white transition hover:bg-zinc-800" @click="emit('close')">
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="saving || !form.title.trim()"
            class="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {{ saving ? 'Criando…' : 'Criar negócio' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Plus, X } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"
import {
  formatBRL, personInitials, personTone, apiErrorMessage,
  type Deal, type Member, type Pipeline,
} from "../../composables/useCrm"

const props = defineProps<{
  open: boolean
  contactId?: string | null
  contactName?: string | null
  conversationId?: string | null
  pipelineId?: string | null
  stageId?: string | null
  defaultSource?: string | null
}>()

const emit = defineEmits<{
  close: []
  created: [deal: Deal]
}>()

const api = useApi()
const authStore = useAuthStore()

const pipelines = ref<Pipeline[]>([])
const members = ref<Member[]>([])
const saving = ref(false)
const error = ref("")
const titleRef = ref<HTMLInputElement | null>(null)

const contactSearch = ref("")
const contactResults = ref<{ id: string; name?: string | null; phoneNumber: string }[]>([])
const pickedContact = ref<{ id: string; name?: string | null; phoneNumber: string } | null>(null)

function emptyForm() {
  return {
    title: "",
    value: null as number | null,
    expectedCloseDate: "",
    pipelineId: "",
    stageId: "",
    ownerId: authStore.user?.id ?? "",
    source: "",
    products: [] as { name: string; qty: number; price: number }[],
    followUp: true,
  }
}

const form = reactive(emptyForm())

const currentPipeline = computed(() => pipelines.value.find((p) => p.id === form.pipelineId))
const openStages = computed(() => currentPipeline.value?.stages.filter((s) => !s.isWon) ?? [])
const productsTotal = computed(() =>
  form.products.reduce((sum, p) => sum + (Number(p.qty) || 0) * (Number(p.price) || 0), 0)
)
const contactLabel = computed(() => props.contactName ?? null)

async function loadOptions() {
  try {
    const [p, m] = await Promise.all([
      api<Pipeline[]>("/crm/pipelines"),
      api<Member[]>("/crm/members"),
      // O layout "chat" (caixa de entrada, contatos) não carrega o usuário no store
      authStore.user ? Promise.resolve() : authStore.fetchMe(),
    ])
    pipelines.value = p
    members.value = m
    const me = authStore.user?.id
    form.ownerId = me && m.some((x) => x.id === me) ? me : m[0]?.id ?? ""
    const pipeline = p.find((x) => x.id === props.pipelineId) ?? p.find((x) => x.isDefault) ?? p[0]
    form.pipelineId = pipeline?.id ?? ""
    form.stageId = props.stageId && pipeline?.stages.some((s) => s.id === props.stageId)
      ? props.stageId
      : pipeline?.stages[0]?.id ?? ""
  } catch (err) {
    error.value = apiErrorMessage(err, "Não foi possível carregar os funis.")
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function searchContacts() {
  if (searchTimer) clearTimeout(searchTimer)
  const q = contactSearch.value.trim()
  if (q.length < 2) { contactResults.value = []; return }
  searchTimer = setTimeout(async () => {
    try {
      contactResults.value = (await api<any[]>(`/contacts?search=${encodeURIComponent(q)}`)).slice(0, 8)
    } catch {}
  }, 250)
}

function pickContact(c: { id: string; name?: string | null; phoneNumber: string }) {
  pickedContact.value = c
  contactResults.value = []
  contactSearch.value = ""
}

watch(() => props.open, async (open) => {
  if (!open) return
  Object.assign(form, emptyForm())
  form.source = props.defaultSource ?? ""
  error.value = ""
  pickedContact.value = null
  await loadOptions()
  nextTick(() => titleRef.value?.focus())
}, { immediate: true })

async function submit() {
  if (!form.title.trim()) return
  saving.value = true
  error.value = ""
  try {
    const tomorrow9 = new Date()
    tomorrow9.setDate(tomorrow9.getDate() + 1)
    tomorrow9.setHours(9, 0, 0, 0)
    const products = form.products
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), qty: Number(p.qty) || 1, price: Number(p.price) || 0 }))
    const deal = await api<Deal>("/crm/deals", {
      method: "POST",
      body: {
        title: form.title.trim(),
        value: form.value != null && form.value !== ("" as any) ? Number(form.value) : undefined,
        pipelineId: form.pipelineId || undefined,
        stageId: form.stageId || undefined,
        contactId: props.contactId ?? pickedContact.value?.id ?? null,
        conversationId: props.conversationId ?? null,
        ownerId: form.ownerId || null,
        expectedCloseDate: form.expectedCloseDate ? new Date(`${form.expectedCloseDate}T12:00:00`).toISOString() : null,
        source: form.source.trim() || null,
        products,
        followUpAt: form.followUp ? tomorrow9.toISOString() : null,
      },
    })
    emit("created", deal)
  } catch (err) {
    error.value = apiErrorMessage(err, "Não foi possível criar o negócio.")
  } finally {
    saving.value = false
  }
}
</script>
