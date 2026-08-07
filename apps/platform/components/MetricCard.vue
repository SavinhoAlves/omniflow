<template>
  <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-zinc-700">
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <p class="text-sm text-zinc-400">{{ title }}</p>
        <h2
          class="mt-2 font-bold text-white leading-tight"
          :class="String(value).length > 6 ? 'text-xl' : 'text-3xl'"
        >{{ value }}</h2>
        <p v-if="subtitle" class="mt-1 text-xs text-zinc-500">{{ subtitle }}</p>
      </div>

      <div class="rounded-xl p-3 shrink-0" :class="iconBg">
        <component :is="icon" :size="22" :class="iconColor" />
      </div>
    </div>

    <p v-if="description" class="mt-4 text-sm" :class="descriptionColor">
      {{ description }}
    </p>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  value: string | number
  icon: any
  subtitle?: string
  description?: string
  color?: "amber" | "green" | "blue" | "red" | "zinc"
}>(), { color: "amber" })

const themes = {
  amber: { iconBg: "bg-amber-500/10",  iconColor: "text-amber-400",  desc: "text-amber-400" },
  green: { iconBg: "bg-green-500/10",  iconColor: "text-green-400",  desc: "text-green-400" },
  blue:  { iconBg: "bg-blue-500/10",   iconColor: "text-blue-400",   desc: "text-blue-400" },
  red:   { iconBg: "bg-red-500/10",    iconColor: "text-red-400",    desc: "text-red-400" },
  zinc:  { iconBg: "bg-zinc-800",      iconColor: "text-zinc-400",   desc: "text-zinc-400" },
}

const theme = computed(() => themes[props.color ?? "amber"])
const iconBg = computed(() => theme.value.iconBg)
const iconColor = computed(() => theme.value.iconColor)
const descriptionColor = computed(() => theme.value.desc)
</script>
