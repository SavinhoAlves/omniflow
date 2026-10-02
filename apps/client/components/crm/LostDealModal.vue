<template>
  <Teleport to="body">
    <div
      v-if="deal"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-16 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="lost-deal-title"
        class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        @submit.prevent="submit"
      >
        <div class="flex items-center gap-3 border-b border-zinc-800 px-6 pb-4 pt-5">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-950 text-red-300">
            <X :size="18" />
          </span>
          <div class="min-w-0">
            <h2 id="lost-deal-title" class="text-base font-semibold text-white">Marcar como perdido</h2>
            <p class="truncate text-sm text-zinc-400">{{ deal.title }} · {{ formatBRL(deal.value) }}</p>
          </div>
        </div>

        <div class="space-y-4 px-6 py-5">
          <fieldset class="space-y-1.5">
            <legend class="mb-2 text-sm font-medium text-zinc-200">Motivo da perda <span class="text-red-300">*</span></legend>
            <label
              v-for="r in reasons"
              :key="r.id"
              class="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 transition"
              :class="reason === r.name ? 'border-red-500 bg-red-950/40' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'"
            >
              <input v-model="reason" type="radio" name="lost-reason" :value="r.name" class="h-4 w-4 accent-red-500">
              <span class="text-sm text-white">{{ r.name }}</span>
            </label>
          </fieldset>

          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-zinc-200">Observação</span>
            <textarea
              v-model="note"
              rows="3"
              maxlength="2000"
              placeholder="O que aprendemos com esta negociação?"
              class="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
            />
          </label>

          <p v-if="error" class="rounded-xl border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{{ error }}</p>
        </div>

        <div class="flex justify-end gap-2 border-t border-zinc-800 px-6 py-4">
          <button type="button" class="h-10 rounded-xl border border-zinc-700 px-4 text-sm text-white transition hover:bg-zinc-800" @click="emit('close')">
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="saving || !reason"
            class="h-10 rounded-xl bg-red-700 px-5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {{ saving ? 'Salvando…' : 'Marcar como perdido' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"
import { formatBRL, apiErrorMessage, type Deal } from "../../composables/useCrm"

const props = defineProps<{ deal: Pick<Deal, "id" | "title" | "value"> | null }>()
const emit = defineEmits<{ close: []; lost: [deal: Deal] }>()

const api = useApi()
const reasons = ref<{ id: string; name: string }[]>([])
const reason = ref("")
const note = ref("")
const saving = ref(false)
const error = ref("")

watch(() => props.deal, async (deal) => {
  if (!deal) return
  reason.value = ""
  note.value = ""
  error.value = ""
  try {
    reasons.value = await api("/crm/lost-reasons")
  } catch {}
}, { immediate: true })

async function submit() {
  if (!props.deal || !reason.value) return
  saving.value = true
  try {
    const updated = await api<Deal>(`/crm/deals/${props.deal.id}/lost`, {
      method: "POST",
      body: { reason: reason.value, note: note.value.trim() || undefined },
    })
    emit("lost", updated)
  } catch (err) {
    error.value = apiErrorMessage(err, "Não foi possível marcar como perdido.")
  } finally {
    saving.value = false
  }
}
</script>
