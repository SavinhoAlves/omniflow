<template>
  <div class="space-y-2.5">
    <p v-if="!actions.length" class="text-xs text-zinc-500">
      Nenhuma ação. Quando um negócio entrar em “{{ stageName }}”, nada acontece automaticamente.
    </p>

    <div
      v-for="(a, i) in actions"
      :key="i"
      class="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
          <component :is="a.type === 'create_task' ? CheckSquare : MessageSquare" :size="13" />
          {{ a.type === 'create_task' ? 'Criar tarefa' : 'Enviar mensagem na conversa' }}
        </span>
        <button
          type="button"
          :aria-label="`Remover ação ${i + 1}`"
          class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-white"
          @click="remove(i)"
        >
          <X :size="14" />
        </button>
      </div>

      <div v-if="a.type === 'create_task'" class="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_150px]">
        <label>
          <span class="sr-only">Tipo de tarefa</span>
          <select v-model="a.taskType" class="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-sm text-white outline-none [color-scheme:dark]">
            <option v-for="t in TASK_TYPES" :key="t" :value="t">{{ ACTIVITY_TYPES[t].label }}</option>
          </select>
        </label>
        <label>
          <span class="sr-only">Título da tarefa</span>
          <input v-model="a.title" maxlength="200" placeholder="Ex.: Agendar visita técnica" class="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500">
        </label>
        <label class="flex items-center gap-1.5 text-xs text-zinc-400">
          prazo
          <input v-model.number="a.dueInHours" type="number" min="0" max="2160" aria-label="Prazo em horas" class="h-9 w-16 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-sm tabular-nums text-white outline-none focus:border-blue-500">
          horas
        </label>
      </div>

      <div v-else class="space-y-2">
        <label class="block">
          <span class="sr-only">Texto da mensagem</span>
          <textarea
            v-model="a.text"
            rows="2"
            maxlength="1000"
            placeholder="Ex.: Oi, {{nome}}! Sua proposta já está pronta. Posso te enviar agora?"
            class="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
          />
        </label>
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <label class="flex items-center gap-1.5">
            enviar após
            <input v-model.number="a.delayMinutes" type="number" min="0" max="43200" aria-label="Atraso em minutos" class="h-8 w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-sm tabular-nums text-white outline-none focus:border-blue-500">
            minutos
          </label>
          <span>Variáveis: <code v-pre class="text-zinc-300">{{nome}}</code> e <code v-pre class="text-zinc-300">{{negocio}}</code></span>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :disabled="actions.length >= 10"
        class="flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 px-2.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        @click="add({ type: 'create_task', taskType: 'TASK', title: '', dueInHours: 24 })"
      >
        <Plus :size="13" /> Criar tarefa
      </button>
      <button
        type="button"
        :disabled="actions.length >= 10"
        class="flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 px-2.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        @click="add({ type: 'send_message', text: '', delayMinutes: 0 })"
      >
        <Plus :size="13" /> Enviar mensagem
      </button>
    </div>
    <p v-if="actions.some((x) => x.type === 'send_message')" class="text-[11px] text-zinc-500">
      Mensagens só saem para negócios ligados a uma conversa, nunca para contatos com opt-out, e respeitam a janela de 24h do WhatsApp oficial.
    </p>
  </div>
</template>

<script setup lang="ts">
import { CheckSquare, MessageSquare, Plus, X } from "lucide-vue-next"
import { ACTIVITY_TYPES, type StageAction } from "../../composables/useCrm"

const props = defineProps<{ modelValue: StageAction[]; stageName: string }>()
const emit = defineEmits<{ "update:modelValue": [value: StageAction[]] }>()

const TASK_TYPES = ["TASK", "CALL", "WHATSAPP", "MEETING", "VISIT"]

// O array é editado no lugar (v-model nos campos); add/remove emitem uma cópia
const actions = computed(() => props.modelValue)

function add(action: StageAction) {
  emit("update:modelValue", [...props.modelValue, action])
}

function remove(i: number) {
  emit("update:modelValue", props.modelValue.filter((_, idx) => idx !== i))
}
</script>
