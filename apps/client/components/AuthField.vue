<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-[13px] font-medium text-zinc-200">{{ label }}</label>

    <div class="relative">
      <input
        :id="id"
        ref="inputRef"
        v-bind="$attrs"
        :value="modelValue"
        :type="type"
        :disabled="disabled"
        :aria-invalid="!!error || invalid || undefined"
        :aria-describedby="message ? `${id}-msg` : undefined"
        class="h-12 w-full rounded-xl border bg-surface-input px-3.5 text-base text-zinc-50 outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-zinc-600 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/25 disabled:opacity-60 motion-reduce:transition-none lg:h-[46px] lg:text-[15px]"
        :class="[error || invalid ? 'border-red-500' : 'border-zinc-800', $slots.trailing ? 'pr-[52px]' : '']"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
      <div v-if="$slots.trailing" class="absolute right-0.5 top-0.5 lg:right-1 lg:top-1">
        <slot name="trailing" />
      </div>
    </div>

    <!-- Uma linha de mensagem: erro > aviso > dica. aria-live para o aviso de Caps Lock -->
    <Transition
      enter-from-class="opacity-0 -translate-y-1"
      enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
      leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
      leave-to-class="opacity-0"
      mode="out-in"
    >
      <span
        v-if="message"
        :id="`${id}-msg`"
        :key="message"
        aria-live="polite"
        class="text-xs"
        :class="error ? 'text-red-400' : warning ? 'text-amber-300' : 'text-ink-muted'"
      >
        {{ message }}
      </span>
    </Transition>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  id: string
  label: string
  modelValue: string
  type?: string
  disabled?: boolean
  /** Mensagem de erro do campo (borda vermelha + texto) */
  error?: string
  /** Borda vermelha sem mensagem — ex.: credenciais recusadas pela API */
  invalid?: boolean
  /** Aviso não bloqueante, ex.: Caps Lock */
  warning?: string
  /** Dica fixa, mostrada quando não há erro nem aviso */
  hint?: string
}>()

const emit = defineEmits<{ "update:modelValue": [value: string] }>()

const inputRef = ref<HTMLInputElement | null>(null)
const message = computed(() => props.error || props.warning || props.hint || "")

defineExpose({ focus: () => inputRef.value?.focus() })
</script>
