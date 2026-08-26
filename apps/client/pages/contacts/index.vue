<template>
  <div class="flex h-full overflow-hidden">

    <!-- ── Lista ── -->
    <div class="flex w-80 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      <!-- Search -->
      <div class="border-b border-zinc-800 p-3">
        <div class="relative">
          <Search :size="13" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            v-model="search"
            type="search"
            placeholder="Buscar por nome ou número..."
            class="w-full rounded-lg border border-zinc-800 bg-zinc-800/60 py-2 pl-8 pr-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-blue-500"
          />
        </div>
      </div>

      <!-- Filter tabs -->
      <div class="flex gap-1 border-b border-zinc-800 px-3 py-2">
        <button
          v-for="f in FILTERS"
          :key="f.value"
          class="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors"
          :class="filter === f.value ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'"
          @click="filter = f.value"
        >
          {{ f.label }}
        </button>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="loading" class="space-y-px p-2">
          <div v-for="i in 8" :key="i" class="flex animate-pulse gap-3 rounded-xl p-3">
            <div class="h-9 w-9 shrink-0 rounded-full bg-zinc-800" />
            <div class="flex-1 space-y-2 pt-1">
              <div class="h-3 w-2/3 rounded bg-zinc-800" />
              <div class="h-2.5 w-1/2 rounded bg-zinc-800" />
            </div>
          </div>
        </div>

        <div v-else-if="filteredContacts.length === 0" class="flex flex-col items-center py-16 text-center">
          <p class="text-sm text-zinc-600">Nenhum contato</p>
        </div>

        <div
          v-for="contact in filteredContacts"
          :key="contact.id"
          class="flex cursor-pointer items-center gap-3 px-3 py-3 transition hover:bg-zinc-800/50"
          :class="selected?.id === contact.id ? 'bg-zinc-800' : ''"
          @click="select(contact)"
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            :style="{ background: gradient(contact.name ?? cleanPhone(contact.phoneNumber)) }"
          >
            {{ initials(contact.name ?? cleanPhone(contact.phoneNumber)) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium" :class="contact.anonymizedAt ? 'text-zinc-600 italic' : 'text-zinc-100'">
              {{ contact.anonymizedAt ? '[Anonimizado]' : (contact.name || cleanPhone(contact.phoneNumber)) }}
            </p>
            <p class="truncate text-xs text-zinc-500">{{ cleanPhone(contact.phoneNumber) }}</p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <span
              v-if="contact.optOut || !contact.consentGivenAt"
              class="h-1.5 w-1.5 rounded-full"
              :class="contact.optOut ? 'bg-red-500' : 'bg-zinc-700'"
              :title="contact.optOut ? 'Bloqueado' : 'Sem consentimento'"
            />
            <span
              v-else
              class="h-1.5 w-1.5 rounded-full bg-emerald-400"
              title="Autorizado"
            />
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-zinc-800 px-3 py-2.5 text-[11px] text-zinc-600">
        {{ filteredContacts.length }} contato{{ filteredContacts.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- ── Detalhe ── -->
    <div class="flex flex-1 flex-col overflow-hidden bg-[#0d1117]">
      <!-- Empty state -->
      <div v-if="!selected" class="flex flex-1 flex-col items-center justify-center gap-3">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
          <BookUser :size="24" class="text-zinc-700" />
        </div>
        <p class="text-sm text-zinc-600">Selecione um contato para ver os detalhes</p>
      </div>

      <template v-else>
        <!-- Header do detalhe -->
        <div class="flex items-center gap-4 border-b border-zinc-800/80 bg-zinc-900 px-6 py-4">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold"
            :style="{ background: gradient(selected.name ?? cleanPhone(selected.phoneNumber)) }"
          >
            {{ initials(selected.name ?? cleanPhone(selected.phoneNumber)) }}
          </div>
          <div class="flex-1 min-w-0">
            <div v-if="editingName" class="flex items-center gap-2">
              <input
                v-model="nameInput"
                class="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                @keydown.enter="saveName"
                @keydown.escape="editingName = false"
              />
              <button class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500" @click="saveName">Salvar</button>
              <button class="text-zinc-600 hover:text-zinc-300" @click="editingName = false"><X :size="14" /></button>
            </div>
            <div v-else class="flex items-center gap-2">
              <p class="truncate font-semibold text-white">{{ selected.name || selected.phoneNumber }}</p>
              <button class="text-zinc-700 hover:text-zinc-400 transition" @click="startEditName"><Pencil :size="12" /></button>
            </div>
            <p class="text-xs text-zinc-500">{{ cleanPhone(selected.phoneNumber) }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <!-- Consent badge -->
            <span
              class="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
              :class="selected.optOut
                ? 'border-red-900/40 bg-red-950/20 text-red-500'
                : selected.consentGivenAt
                ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-400'
                : 'border-zinc-700 bg-zinc-800 text-zinc-500'"
            >
              {{ selected.optOut ? 'Bloqueado' : selected.consentGivenAt ? 'Autorizado ✓' : 'Sem consentimento' }}
            </span>
            <!-- Actions -->
            <button
              class="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-800 hover:text-emerald-400"
              title="Exportar dados (LGPD)"
              @click="exportData"
            >
              <Download :size="14" />
            </button>
            <button
              class="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-800 hover:text-red-400"
              title="Apagar dados (LGPD Art. 18)"
              @click="anonymize"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 border-b border-zinc-800/60 bg-zinc-900 px-6">
          <button
            v-for="t in DETAIL_TABS"
            :key="t.value"
            class="border-b-2 px-3 py-3 text-sm font-medium transition"
            :class="detailTab === t.value
              ? 'border-blue-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'"
            @click="detailTab = t.value"
          >
            {{ t.label }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">

          <!-- ── Info ── -->
          <div v-if="detailTab === 'info'" class="space-y-6 p-6">
            <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
              <div>
                <p class="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Telefone</p>
                <p class="mt-1 text-sm text-zinc-200">{{ cleanPhone(selected.phoneNumber) }}</p>
              </div>
              <div>
                <div class="flex items-center justify-between">
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Observações</p>
                  <button v-if="!editingNotes" class="text-[10px] text-zinc-700 hover:text-blue-400 transition" @click="startEditNotes">Editar</button>
                </div>
                <div v-if="editingNotes" class="mt-2">
                  <textarea
                    v-model="notesInput"
                    rows="4"
                    class="w-full resize-none rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
                  />
                  <div class="mt-2 flex gap-2">
                    <button class="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500" @click="saveNotes">Salvar</button>
                    <button class="text-xs text-zinc-600 hover:text-zinc-300 transition" @click="editingNotes = false">Cancelar</button>
                  </div>
                </div>
                <p v-else class="mt-1 text-sm" :class="selected.notes ? 'text-zinc-300' : 'text-zinc-700 italic'">
                  {{ selected.notes || 'Nenhuma observação' }}
                </p>
              </div>
              <div>
                <p class="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Criado em</p>
                <p class="mt-1 text-sm text-zinc-400">{{ formatDate(selected.createdAt) }}</p>
              </div>
            </div>

            <!-- Consent -->
            <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div class="flex items-center justify-between mb-4">
                <p class="text-sm font-semibold text-white">Consentimento LGPD</p>
                <div class="flex gap-2">
                  <button
                    class="rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-950/40"
                    @click="recordConsent('OPT_IN')"
                  >
                    Autorizar envios
                  </button>
                  <button
                    class="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-[11px] font-semibold text-red-500 transition hover:bg-red-950/40"
                    @click="recordConsent('OPT_OUT')"
                  >
                    Bloquear envios
                  </button>
                </div>
              </div>
              <div v-if="loadingConsent" class="space-y-2">
                <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-xl bg-zinc-800" />
              </div>
              <div v-else-if="consentHistory.length === 0" class="py-6 text-center text-sm text-zinc-600">
                Nenhum registro de consentimento
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="log in consentHistory"
                  :key="log.id"
                  class="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-800/30 px-4 py-2.5"
                >
                  <div class="flex items-center gap-2.5">
                    <span
                      class="h-2 w-2 rounded-full"
                      :class="log.event === 'OPT_IN' ? 'bg-emerald-400' : 'bg-red-500'"
                    />
                    <span class="text-sm font-medium" :class="log.event === 'OPT_IN' ? 'text-emerald-400' : 'text-red-400'">
                      {{ log.event === 'OPT_IN' ? 'Autorizado' : 'Bloqueado' }}
                    </span>
                    <span class="text-xs text-zinc-500">via {{ sourceLabel[log.source] ?? log.source }}</span>
                  </div>
                  <span class="text-[11px] text-zinc-600">{{ formatDate(log.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Histórico de conversas ── -->
          <div v-if="detailTab === 'conversations'" class="p-6">
            <div v-if="loadingConvs" class="space-y-3">
              <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
            </div>
            <div v-else-if="contactConvs.length === 0" class="flex flex-col items-center py-16 text-center">
              <p class="text-sm text-zinc-600">Nenhuma conversa registrada</p>
            </div>
            <div v-else class="space-y-3">
              <NuxtLink
                v-for="conv in contactConvs"
                :key="conv.id"
                to="/conversations"
                class="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-zinc-700"
              >
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs"
                  :class="conv.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400'
                    : conv.status === 'LEAD' ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-zinc-800 text-zinc-600'"
                >
                  <MessageSquare :size="14" />
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-zinc-200 truncate">
                    {{ conv.status === 'OPEN' ? 'Em atendimento' : conv.status === 'LEAD' ? 'Lead' : 'Finalizado' }}
                    <span v-if="conv.department" class="text-zinc-500">· {{ conv.department.name }}</span>
                  </p>
                  <p class="text-xs text-zinc-600 truncate">
                    {{ conv.messages?.[0]?.content || 'Sem mensagens' }}
                  </p>
                </div>
                <span class="shrink-0 text-[11px] text-zinc-600">{{ formatDate(conv.lastMessageAt ?? conv.createdAt) }}</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Search, BookUser, Pencil, X, Trash2, Download, MessageSquare,
} from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ layout: "chat", middleware: "auth" })
useHead({ title: "Contatos" })

const api = useApi()

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name?: string | null
  phoneNumber: string
  notes?: string | null
  optOut: boolean
  consentGivenAt?: string | null
  anonymizedAt?: string | null
  createdAt: string
}

interface ConsentLog {
  id: string
  event: "OPT_IN" | "OPT_OUT"
  source: string
  createdAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS = [
  { value: "all",    label: "Todos"       },
  { value: "optin",  label: "Autorizado"  },
  { value: "optout", label: "Bloqueado"   },
]

const DETAIL_TABS = [
  { value: "info",          label: "Informações" },
  { value: "conversations", label: "Histórico"   },
]

const sourceLabel: Record<string, string> = {
  agent:              "atendente",
  whatsapp_keyword:   "palavra-chave WhatsApp",
  form:               "formulário",
  import:             "importação",
  api:                "API",
}

const AVATAR_COLORS = [
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #10b981, #3b82f6)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
]

// ── State ─────────────────────────────────────────────────────────────────────

const loading        = ref(true)
const contacts       = ref<Contact[]>([])
const search         = ref("")
const filter         = ref("all")
const selected       = ref<Contact | null>(null)
const detailTab      = ref("info")

const editingName    = ref(false)
const nameInput      = ref("")
const editingNotes   = ref(false)
const notesInput     = ref("")

const loadingConsent = ref(false)
const consentHistory = ref<ConsentLog[]>([])
const loadingConvs   = ref(false)
const contactConvs   = ref<any[]>([])

const filteredContacts = computed(() => {
  let list = contacts.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (c) => (c.name ?? "").toLowerCase().includes(q) || c.phoneNumber.includes(q)
    )
  }
  if (filter.value === "optin")  list = list.filter((c) => !!c.consentGivenAt && !c.optOut)
  if (filter.value === "optout") list = list.filter((c) => c.optOut)
  return list
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanPhone(raw: string): string {
  return raw.replace(/@[\w.]+$/, "")
}

function gradient(name: string) {
  const idx = [...(name || "?")].reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
}

function formatDate(iso?: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  try { contacts.value = await api<Contact[]>("/contacts") } catch {}
  loading.value = false
}

async function select(contact: Contact) {
  selected.value  = contact
  detailTab.value = "info"
  editingName.value  = false
  editingNotes.value = false
  consentHistory.value = []
  contactConvs.value   = []
  loadConsent()
  loadConvs()
}

async function loadConsent() {
  if (!selected.value) return
  loadingConsent.value = true
  try { consentHistory.value = await api<ConsentLog[]>(`/contacts/${selected.value.id}/consent`) } catch {}
  loadingConsent.value = false
}

async function loadConvs() {
  if (!selected.value) return
  loadingConvs.value = true
  try {
    const result = await api<any>(`/conversations?contactId=${selected.value.id}&limit=30`)
    contactConvs.value = result?.items ?? result ?? []
  } catch {}
  loadingConvs.value = false
}

// ── Edit ──────────────────────────────────────────────────────────────────────

function startEditName() {
  nameInput.value  = selected.value?.name ?? ""
  editingName.value = true
}

async function saveName() {
  if (!selected.value) return
  try {
    await api(`/contacts/${selected.value.id}`, { method: "PUT", body: { name: nameInput.value.trim() } })
    selected.value.name = nameInput.value.trim()
    const idx = contacts.value.findIndex((c) => c.id === selected.value!.id)
    if (idx !== -1) contacts.value[idx].name = nameInput.value.trim()
  } catch {}
  editingName.value = false
}

function startEditNotes() {
  notesInput.value   = selected.value?.notes ?? ""
  editingNotes.value = true
}

async function saveNotes() {
  if (!selected.value) return
  try {
    await api(`/contacts/${selected.value.id}`, { method: "PUT", body: { notes: notesInput.value.trim() } })
    selected.value.notes = notesInput.value.trim()
  } catch {}
  editingNotes.value = false
}

// ── Consent ───────────────────────────────────────────────────────────────────

async function recordConsent(event: "OPT_IN" | "OPT_OUT") {
  if (!selected.value) return
  try {
    await api(`/contacts/${selected.value.id}/consent`, {
      method: "POST",
      body: { event, source: "agent" },
    })
    if (event === "OPT_IN") {
      selected.value.consentGivenAt = new Date().toISOString()
      selected.value.optOut = false
    } else {
      selected.value.optOut = true
    }
    await loadConsent()
  } catch (err: any) {
    alert(err?.data?.error ?? "Falha ao registrar consentimento.")
  }
}

// ── LGPD ──────────────────────────────────────────────────────────────────────

async function exportData() {
  if (!selected.value) return
  try {
    const config = useRuntimeConfig()
    const token  = useCookie("access_token").value
    const url    = `${config.public.apiUrl}/contacts/${selected.value.id}/export`
    const res    = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const blob   = await res.blob()
    const a      = document.createElement("a")
    a.href       = URL.createObjectURL(blob)
    a.download   = `contact-${selected.value.id}-export.json`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch {
    alert("Não foi possível exportar os dados.")
  }
}

async function anonymize() {
  if (!selected.value) return
  const name = selected.value.name || selected.value.phoneNumber
  if (!confirm(`Apagar dados de ${name}?\n\nIsso anonimiza o contato (LGPD Art. 18). Irreversível.`)) return
  try {
    await api(`/contacts/${selected.value.id}`, { method: "DELETE" })
    selected.value.name = null
    selected.value.anonymizedAt = new Date().toISOString()
    const idx = contacts.value.findIndex((c) => c.id === selected.value!.id)
    if (idx !== -1) contacts.value[idx].anonymizedAt = selected.value.anonymizedAt
  } catch (err: any) {
    alert(err?.data?.error ?? "Falha ao apagar dados.")
  }
}

onMounted(load)
</script>
