<template>
  <div class="space-y-6">

    <!-- Toolbar -->
    <div class="flex items-center gap-3">
      <div class="relative flex-1 max-w-sm">
        <Search :size="14" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          v-model="search"
          type="search"
          placeholder="Buscar por título ou conteúdo..."
          class="w-full rounded-xl border border-zinc-700/60 bg-zinc-900 py-2.5 pl-9 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
        />
      </div>
      <button
        class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
        @click="openForm()"
      >
        <Plus :size="16" />
        Nova resposta
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="i in 6" :key="i" class="h-36 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="flex flex-col items-center py-20 text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
        <MessageCircleDashed :size="24" class="text-zinc-700" />
      </div>
      <p class="text-sm font-medium text-zinc-500">
        {{ search ? 'Nenhum resultado para "' + search + '"' : 'Nenhuma resposta rápida cadastrada' }}
      </p>
      <p class="mt-1 text-xs text-zinc-700">Crie atalhos de texto para agilizar respostas frequentes.</p>
      <button
        v-if="!search"
        class="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
        @click="openForm()"
      >
        <Plus :size="14" />
        Criar primeira resposta
      </button>
    </div>

    <!-- Grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="reply in filtered"
        :key="reply.id"
        class="group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700"
      >
        <div class="flex items-start justify-between gap-3">
          <p class="font-semibold text-white leading-snug">{{ reply.title }}</p>
          <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button
              class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
              title="Editar"
              @click="openForm(reply)"
            >
              <Pencil :size="13" />
            </button>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-800 hover:text-red-400"
              title="Excluir"
              @click="deleteReply(reply)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
        </div>

        <p class="mt-2.5 flex-1 text-sm text-zinc-400 leading-relaxed line-clamp-4">{{ reply.content }}</p>

        <div v-if="reply.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="tag in reply.tags"
            :key="tag"
            class="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium text-blue-400"
          >
            {{ tag }}
          </span>
        </div>

        <!-- Copy button -->
        <button
          class="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700/60 py-2 text-xs font-medium text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-200"
          @click="copy(reply.content)"
        >
          <Check v-if="copiedId === reply.id" :size="12" class="text-emerald-400" />
          <Copy v-else :size="12" />
          {{ copiedId === reply.id ? 'Copiado!' : 'Copiar texto' }}
        </button>
      </div>
    </div>

    <!-- ── Modal ── -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        @click.self="showModal = false"
      >
        <div class="flex w-full max-w-lg flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 shadow-2xl" style="max-height: 90vh;">
          <div class="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
            <div>
              <h2 class="text-base font-semibold text-white">{{ editing ? 'Editar resposta' : 'Nova resposta rápida' }}</h2>
              <p class="mt-0.5 text-xs text-zinc-500">Aparece no ⚡ do compositor de mensagens.</p>
            </div>
            <button class="text-zinc-600 transition hover:text-zinc-300" @click="showModal = false">
              <X :size="18" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            <div>
              <label class="text-sm font-medium text-zinc-400">Título <span class="text-red-400">*</span></label>
              <input
                v-model="form.title"
                type="text"
                placeholder="Ex: Saudação inicial"
                maxlength="100"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              />
              <p class="mt-1 text-right text-[10px] text-zinc-700">{{ form.title.length }}/100</p>
            </div>

            <div>
              <label class="text-sm font-medium text-zinc-400">Conteúdo <span class="text-red-400">*</span></label>
              <textarea
                v-model="form.content"
                rows="6"
                placeholder="Olá, seja bem-vindo! Meu nome é {{nome}} e estou aqui para ajudar..."
                maxlength="4096"
                class="mt-1.5 w-full resize-none rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              />
              <p class="mt-1 text-right text-[10px] text-zinc-700">{{ form.content.length }}/4096</p>
            </div>

            <div>
              <label class="text-sm font-medium text-zinc-400">Tags <span class="text-zinc-600">(opcional)</span></label>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <span
                  v-for="tag in form.tags"
                  :key="tag"
                  class="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] text-blue-400"
                >
                  {{ tag }}
                  <button class="hover:text-red-400 transition" @click="removeTag(tag)"><X :size="9" /></button>
                </span>
                <input
                  v-model="tagInput"
                  type="text"
                  placeholder="+ tag"
                  class="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-0.5 text-[11px] text-zinc-300 outline-none focus:border-blue-500"
                  @keydown.enter.prevent="addTag"
                  @keydown.comma.prevent="addTag"
                />
              </div>
              <p class="mt-1 text-[10px] text-zinc-700">Enter ou vírgula para adicionar</p>
            </div>

            <p v-if="formError" class="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {{ formError }}
            </p>
          </div>

          <div class="shrink-0 border-t border-zinc-800 px-6 py-4">
            <button
              :disabled="saving || !form.title.trim() || !form.content.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              @click="save"
            >
              <LoaderCircle v-if="saving" :size="15" class="animate-spin" />
              {{ editing ? 'Salvar alterações' : 'Criar resposta' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Search, Plus, Pencil, Trash2, X, LoaderCircle, MessageCircleDashed, Copy, Check } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })
useHead({ title: "Respostas Rápidas" })

const api = useApi()

interface SavedReply {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
}

// ── State ─────────────────────────────────────────────────────────────────────

const loading   = ref(true)
const replies   = ref<SavedReply[]>([])
const search    = ref("")
const showModal = ref(false)
const saving    = ref(false)
const formError = ref("")
const editing   = ref<SavedReply | null>(null)
const tagInput  = ref("")
const copiedId  = ref<string | null>(null)

const form = reactive({ title: "", content: "", tags: [] as string[] })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return replies.value
  return replies.value.filter(
    (r) => r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
  )
})

// ── Load ──────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  try { replies.value = await api<SavedReply[]>("/saved-replies") } catch {}
  loading.value = false
}

// ── Form ──────────────────────────────────────────────────────────────────────

function openForm(reply?: SavedReply) {
  editing.value   = reply ?? null
  formError.value = ""
  tagInput.value  = ""
  form.title      = reply?.title   ?? ""
  form.content    = reply?.content ?? ""
  form.tags       = reply?.tags ? [...reply.tags] : []
  showModal.value = true
}

function addTag() {
  const t = tagInput.value.trim().replace(/,/g, "").toLowerCase()
  if (t && !form.tags.includes(t)) form.tags.push(t)
  tagInput.value = ""
}

function removeTag(t: string) {
  form.tags = form.tags.filter((x) => x !== t)
}

async function save() {
  if (!form.title.trim() || !form.content.trim()) return
  saving.value    = true
  formError.value = ""
  try {
    const body = { title: form.title.trim(), content: form.content.trim(), tags: form.tags }
    if (editing.value) {
      await api(`/saved-replies/${editing.value.id}`, { method: "PUT", body })
      const idx = replies.value.findIndex((r) => r.id === editing.value!.id)
      if (idx !== -1) replies.value[idx] = { ...replies.value[idx], ...body }
    } else {
      const created = await api<SavedReply>("/saved-replies", { method: "POST", body })
      replies.value.unshift(created)
    }
    showModal.value = false
  } catch (err: any) {
    formError.value = err?.data?.error ?? err?.data?.message ?? "Não foi possível salvar."
  } finally {
    saving.value = false
  }
}

async function deleteReply(reply: SavedReply) {
  if (!confirm(`Excluir a resposta "${reply.title}"?`)) return
  try {
    await api(`/saved-replies/${reply.id}`, { method: "DELETE" })
    replies.value = replies.value.filter((r) => r.id !== reply.id)
  } catch (err: any) {
    alert(err?.data?.error ?? "Falha ao excluir.")
  }
}

function copy(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
  const reply = filtered.value.find((r) => r.content === text)
  if (reply) {
    copiedId.value = reply.id
    setTimeout(() => { copiedId.value = null }, 2000)
  }
}

onMounted(load)
</script>
