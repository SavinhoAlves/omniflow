<template>
  <div class="space-y-5">
    <!-- Filtros -->
    <div class="flex flex-wrap items-center gap-2.5">
      <div role="group" aria-label="Escopo" class="flex gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        <button
          v-for="s in SCOPES"
          :key="s.value"
          type="button"
          :aria-pressed="scope === s.value"
          class="h-8 rounded-lg px-3.5 text-sm transition"
          :class="scope === s.value ? 'bg-zinc-800 font-medium text-white' : 'text-zinc-400 hover:text-white'"
          @click="scope = s.value"
        >
          {{ s.label }}
        </button>
      </div>
      <div role="group" aria-label="Tipo" class="flex flex-wrap gap-1.5">
        <button
          v-for="t in typeFilters"
          :key="t.value"
          type="button"
          :aria-pressed="typeFilter === t.value"
          class="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition"
          :class="typeFilter === t.value ? 'border-blue-500 bg-zinc-800 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'"
          @click="typeFilter = t.value"
        >
          <component :is="t.icon" v-if="t.icon" :size="13" />
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- Resumo -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p class="text-xs text-zinc-400">Atrasadas</p>
        <p class="mt-0.5 text-xl font-semibold text-red-300">{{ counts.late }}</p>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p class="text-xs text-zinc-400">Para hoje</p>
        <p class="mt-0.5 text-xl font-semibold text-amber-300">{{ counts.today }}</p>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p class="text-xs text-zinc-400">Próximos dias</p>
        <p class="mt-0.5 text-xl font-semibold text-white">{{ counts.upcoming }}</p>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p class="text-xs text-zinc-400">Concluídas hoje</p>
        <p class="mt-0.5 text-xl font-semibold text-emerald-300">{{ counts.done }}</p>
      </div>
    </div>

    <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div class="min-w-0 space-y-4">
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-32 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
        </div>

        <template v-else>
          <section
            v-for="g in groups"
            :key="g.key"
            :aria-label="g.label"
            class="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
          >
            <div class="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
              <span class="h-2 w-2 rounded-full" :class="g.dot" />
              <h2 class="text-sm font-semibold text-white">{{ g.label }}</h2>
              <span class="rounded-full bg-zinc-800 px-1.5 text-[11px] font-semibold text-zinc-300">{{ g.items.filter((t) => !t.doneAt).length }}</span>
            </div>
            <p v-if="!g.items.length" class="px-4 py-5 text-sm text-zinc-500">{{ g.empty }}</p>
            <ul>
              <li
                v-for="t in g.items"
                :key="t.id"
                class="flex items-center gap-3 border-b border-zinc-800/70 px-4 py-3 last:border-b-0 hover:bg-zinc-800/30"
              >
                <input
                  type="checkbox"
                  :aria-label="`Concluir: ${t.title || ACTIVITY_TYPES[t.type]?.label}`"
                  class="h-[18px] w-[18px] shrink-0 accent-blue-600"
                  :checked="!!t.doneAt"
                  @change="toggle(t)"
                >
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" :class="[ACTIVITY_TYPES[t.type]?.bg, ACTIVITY_TYPES[t.type]?.fg]">
                  <component :is="ACTIVITY_TYPES[t.type]?.icon" :size="15" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-[13.5px] font-medium" :class="t.doneAt ? 'text-zinc-500 line-through' : 'text-white'">
                    {{ t.title || ACTIVITY_TYPES[t.type]?.label }}
                  </p>
                  <p class="truncate text-xs text-zinc-400">
                    <NuxtLink :to="`/crm/deals/${t.deal.id}`" class="text-blue-300 hover:text-blue-200">{{ t.deal.title }}</NuxtLink>
                    <template v-if="t.deal.contact"> · {{ t.deal.contact.name || t.deal.contact.phoneNumber }}</template>
                  </p>
                </div>
                <NuxtLink
                  v-if="!t.doneAt && t.deal.conversationId && (t.type === 'WHATSAPP' || t.type === 'CALL')"
                  :to="`/conversations?id=${t.deal.conversationId}`"
                  class="hidden h-8 items-center rounded-lg border border-zinc-700 px-2.5 text-xs text-zinc-200 hover:bg-zinc-800 sm:flex"
                >
                  {{ t.type === 'CALL' ? 'Abrir conversa' : 'Responder' }}
                </NuxtLink>
                <div class="w-32 shrink-0 text-right">
                  <p class="text-xs tabular-nums" :class="!t.doneAt && isOverdue(t.dueAt) ? 'text-red-300' : 'text-zinc-300'">
                    {{ t.doneAt ? 'concluída' : formatDue(t.dueAt) }}
                  </p>
                  <p v-if="scope === 'team'" class="truncate text-[11px] text-zinc-500">{{ t.assignee?.name ?? 'Sem responsável' }}</p>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </div>

      <!-- Semana + agenda -->
      <aside class="space-y-4">
        <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 class="mb-3 text-sm font-semibold text-white">Semana</h2>
          <div class="grid grid-cols-7 gap-1">
            <button
              v-for="d in week"
              :key="d.key"
              type="button"
              :aria-pressed="d.key === agendaDay"
              class="flex flex-col items-center gap-1 rounded-xl border py-2 transition"
              :class="d.key === agendaDay ? 'border-blue-600 bg-blue-950/60' : 'border-zinc-800 hover:border-zinc-700'"
              @click="agendaDay = d.key"
            >
              <span class="text-[11px] text-zinc-400">{{ d.dow }}</span>
              <span class="text-[15px] font-semibold text-white">{{ d.day }}</span>
              <span class="text-[11px]" :class="d.count ? 'text-blue-200' : 'text-zinc-600'">{{ d.count || '—' }}</span>
            </button>
          </div>
        </section>

        <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div class="mb-3 flex items-baseline justify-between">
            <h2 class="text-sm font-semibold text-white">Agenda</h2>
            <span class="text-xs text-zinc-400">{{ agendaLabel }}</span>
          </div>
          <div class="relative ml-11 border-l border-zinc-800" :style="{ height: `${HOURS.length * HOUR_PX}px` }">
            <div v-for="(h, i) in HOURS" :key="h" class="absolute inset-x-0 border-t border-zinc-800/60" :style="{ top: `${i * HOUR_PX}px` }">
              <span class="absolute -left-11 -top-2 w-9 text-right text-[11px] tabular-nums text-zinc-500">{{ h }}h</span>
            </div>
            <NuxtLink
              v-for="a in agenda"
              :key="a.id"
              :to="`/crm/deals/${a.deal.id}`"
              class="absolute left-2 right-1 overflow-hidden rounded-lg px-2.5 py-1 text-white"
              :class="ACTIVITY_TYPES[a.type]?.bg"
              :style="{ top: `${a.top}px`, height: `${a.height}px` }"
            >
              <p class="truncate text-xs font-semibold" :class="a.doneAt ? 'line-through opacity-70' : ''">{{ a.title || ACTIVITY_TYPES[a.type]?.label }}</p>
              <p class="truncate text-[11px] text-zinc-300">{{ a.time }} · {{ a.deal.title }}</p>
            </NuxtLink>
            <div v-if="nowTop !== null" class="pointer-events-none absolute -left-1 right-0 flex items-center" :style="{ top: `${nowTop}px` }">
              <span class="h-2 w-2 rounded-full bg-red-400" />
              <span class="h-0.5 flex-1 bg-red-400" />
            </div>
          </div>
          <p v-if="outsideAgenda" class="mt-3 text-xs text-zinc-500">{{ outsideAgenda }} tarefa{{ outsideAgenda > 1 ? 's' : '' }} fora do horário exibido (8h–18h)</p>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckSquare, MapPin, MessageSquare, Phone, CalendarDays } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"
import { ACTIVITY_TYPES, formatDue, isOverdue, isToday } from "../../composables/useCrm"

definePageMeta({ middleware: "auth" })
useHead({ title: "Tarefas" })

interface TaskItem {
  id: string
  type: string
  title?: string | null
  dueAt: string
  doneAt?: string | null
  assignee?: { id: string; name: string } | null
  deal: {
    id: string
    title: string
    conversationId?: string | null
    contact?: { id: string; name?: string | null; phoneNumber: string } | null
  }
}

const SCOPES = [
  { value: "mine", label: "Minhas" },
  { value: "team", label: "Equipe" },
] as const

const typeFilters = [
  { value: "all",      label: "Todas",    icon: null },
  { value: "CALL",     label: "Ligação",  icon: Phone },
  { value: "WHATSAPP", label: "WhatsApp", icon: MessageSquare },
  { value: "VISIT",    label: "Visita",   icon: MapPin },
  { value: "MEETING",  label: "Reunião",  icon: CalendarDays },
  { value: "TASK",     label: "Tarefa",   icon: CheckSquare },
]

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const HOUR_PX = 48

const api = useApi()
const scope = ref<"mine" | "team">("mine")
const typeFilter = ref("all")
const tasks = ref<TaskItem[]>([])
const loading = ref(true)
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const agendaDay = ref(dayKey(new Date()))

const visible = computed(() => tasks.value.filter((t) => typeFilter.value === "all" || t.type === typeFilter.value))

const groups = computed(() => {
  const late: TaskItem[] = []
  const today: TaskItem[] = []
  const upcoming: TaskItem[] = []
  for (const t of visible.value) {
    if (isToday(t.dueAt) && (t.doneAt || !isOverdue(t.dueAt))) today.push(t)
    else if (!t.doneAt && isOverdue(t.dueAt)) late.push(t)
    else if (new Date(t.dueAt).getTime() > Date.now()) upcoming.push(t)
    else today.push(t) // concluída hoje com prazo antigo
  }
  return [
    { key: "late",     label: "Atrasadas", dot: "bg-red-400",   items: late,     empty: "Nenhuma tarefa atrasada. Bom trabalho!" },
    { key: "today",    label: "Hoje",      dot: "bg-amber-400", items: today,    empty: "Nada agendado para hoje." },
    { key: "upcoming", label: "Próximas",  dot: "bg-blue-400",  items: upcoming, empty: "Nenhuma tarefa nos próximos dias." },
  ]
})

const counts = computed(() => ({
  late: groups.value[0].items.filter((t) => !t.doneAt).length,
  today: groups.value[1].items.filter((t) => !t.doneAt).length,
  upcoming: groups.value[2].items.length,
  done: visible.value.filter((t) => t.doneAt && isToday(t.doneAt)).length,
}))

const week = computed(() => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // segunda-feira
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = dayKey(d)
    return {
      key,
      dow: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      day: d.getDate(),
      count: visible.value.filter((t) => dayKey(new Date(t.dueAt)) === key).length,
      date: d,
    }
  })
})

const agendaLabel = computed(() => {
  const d = week.value.find((w) => w.key === agendaDay.value)?.date ?? new Date()
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
})

const dayTasks = computed(() => visible.value.filter((t) => dayKey(new Date(t.dueAt)) === agendaDay.value))

const agenda = computed(() =>
  dayTasks.value
    .map((t) => {
      const d = new Date(t.dueAt)
      const hours = d.getHours() + d.getMinutes() / 60
      return {
        ...t,
        hours,
        time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        top: Math.round((hours - HOURS[0]) * HOUR_PX),
        height: HOUR_PX / 2 + 8,
      }
    })
    .filter((a) => a.hours >= HOURS[0] && a.hours < HOURS[HOURS.length - 1] + 1)
)
const outsideAgenda = computed(() => dayTasks.value.length - agenda.value.length)

const nowTop = computed(() => {
  if (agendaDay.value !== dayKey(new Date())) return null
  const n = new Date()
  const hours = n.getHours() + n.getMinutes() / 60
  if (hours < HOURS[0] || hours > HOURS[HOURS.length - 1] + 1) return null
  return Math.round((hours - HOURS[0]) * HOUR_PX)
})

async function load() {
  loading.value = true
  try {
    tasks.value = await api<TaskItem[]>(`/crm/tasks?scope=${scope.value}`)
  } catch {
    tasks.value = []
  } finally {
    loading.value = false
  }
}

async function toggle(t: TaskItem) {
  const done = !t.doneAt
  t.doneAt = done ? new Date().toISOString() : null
  try {
    await api(`/crm/activities/${t.id}`, { method: "PATCH", body: { done } })
  } catch {
    t.doneAt = done ? null : new Date().toISOString()
  }
}

watch(scope, load)
onMounted(load)
</script>
