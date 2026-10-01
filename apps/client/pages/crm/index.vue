<template>
  <div class="space-y-5">
    <!-- Filtros -->
    <div class="flex flex-wrap items-center gap-2.5">
      <label class="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white">
        <CalendarDays :size="15" class="text-zinc-400" />
        <span class="sr-only">Mês</span>
        <input v-model="month" type="month" class="bg-transparent outline-none [color-scheme:dark]">
      </label>
      <label class="relative flex items-center">
        <span class="sr-only">Funil</span>
        <select
          v-model="pipelineId"
          class="h-10 appearance-none rounded-xl border border-zinc-800 bg-zinc-900 pl-3 pr-9 text-sm text-white outline-none [color-scheme:dark] focus:border-blue-500"
        >
          <option v-for="p in pipelines" :key="p.id" :value="p.id">Funil: {{ p.name }}</option>
        </select>
        <ChevronDown :size="14" class="pointer-events-none absolute right-3 text-zinc-400" />
      </label>
      <div class="flex-1" />
      <button
        type="button"
        :disabled="!data"
        class="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 px-4 text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-50"
        @click="exportCsv"
      >
        <Download :size="15" /> Exportar CSV
      </button>
    </div>

    <div v-if="loading && !data" class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <div v-for="i in 6" :key="i" class="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <p v-else-if="error" class="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">{{ error }}</p>

    <template v-else-if="data">
      <!-- KPIs -->
      <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div v-for="k in kpis" :key="k.label" class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs text-zinc-400">{{ k.label }}</p>
          <p class="mt-1.5 text-2xl font-semibold tracking-tight text-white">{{ k.value }}</p>
          <p class="mt-0.5 flex items-center gap-1 text-xs" :class="k.tone">
            <ArrowUp v-if="k.trend === 'up'" :size="12" />
            <ArrowDown v-else-if="k.trend === 'down'" :size="12" />
            {{ k.hint }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <!-- Receita e previsão -->
        <section aria-labelledby="fc-title" class="flex flex-col gap-3.5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="fc-title" class="text-sm font-semibold text-white">Receita ganha e previsão</h2>
              <p class="text-xs text-zinc-400">Por mês de fechamento · previsão = valor × probabilidade, pela data prevista</p>
            </div>
            <div class="flex gap-3.5 text-xs text-zinc-300">
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-[3px]" style="background: #3987e5" />Ganho</span>
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-[3px]" style="background: #d95926" />Previsão ponderada</span>
            </div>
          </div>
          <div aria-live="polite" class="flex flex-wrap gap-4 rounded-xl bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
            <span class="font-semibold text-white">{{ hovered.label }}</span>
            <span>Ganho <strong class="tabular-nums text-white">{{ formatBRL(hovered.won) }}</strong></span>
            <span>Previsão <strong class="tabular-nums text-white">{{ formatBRL(hovered.forecast) }}</strong></span>
            <span>Total <strong class="tabular-nums text-white">{{ formatBRL(hovered.won + hovered.forecast) }}</strong></span>
          </div>
          <div class="relative h-[230px] pl-12">
            <div
              v-for="g in gridLines"
              :key="g.value"
              class="absolute inset-x-0 flex items-center gap-2"
              :style="{ bottom: `${24 + g.offset}px` }"
            >
              <span class="w-10 text-right text-[11px] tabular-nums text-zinc-500">{{ formatBRLCompact(g.value).replace('R$', '').trim() }}</span>
              <span class="h-px flex-1" :class="g.value === 0 ? 'bg-zinc-700' : 'bg-zinc-800/70'" />
            </div>
            <div class="absolute bottom-6 left-12 right-0 top-0 grid gap-3 px-2" :style="{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }">
              <div
                v-for="(b, i) in bars"
                :key="b.key"
                tabindex="0"
                :aria-label="`${b.label}: ganho ${formatBRL(b.won)}, previsão ${formatBRL(b.forecast)}`"
                class="relative flex h-full cursor-default flex-col items-center justify-end outline-none transition-opacity"
                :class="hoverIndex === i ? 'opacity-100' : 'opacity-60'"
                @mouseenter="hoverIndex = i"
                @focus="hoverIndex = i"
              >
                <div class="flex w-full max-w-[44px] flex-col gap-[2px]">
                  <div v-if="b.forecast > 0" class="rounded-t" :style="{ height: `${b.forecastH}px`, background: '#d95926' }" />
                  <div v-if="b.won > 0" :class="b.forecast > 0 ? '' : 'rounded-t'" :style="{ height: `${b.wonH}px`, background: '#3987e5' }" />
                </div>
                <span class="absolute -bottom-6 text-xs" :class="hoverIndex === i ? 'text-white' : 'text-zinc-400'">{{ b.short }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Distribuição por etapa -->
        <section aria-labelledby="st-title" class="flex flex-col gap-3.5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div>
            <h2 id="st-title" class="text-sm font-semibold text-white">Negócios por etapa</h2>
            <p class="text-xs text-zinc-400">Em aberto hoje · a última barra mostra os ganhos do mês</p>
          </div>
          <ol class="space-y-3">
            <li v-for="s in data.stages" :key="s.id" class="space-y-1.5">
              <div class="flex justify-between gap-2 text-sm">
                <span class="flex items-center gap-2 text-zinc-200"><span class="h-2 w-2 rounded-full" :style="{ background: s.color }" />{{ s.name }}</span>
                <span class="tabular-nums text-zinc-400"><strong class="text-white">{{ s.count }}</strong> · {{ formatBRLCompact(s.value) }}</span>
              </div>
              <div class="h-2.5 rounded bg-zinc-950">
                <div class="h-2.5 rounded" :style="{ width: `${Math.max(s.count ? 2 : 0, (s.count / maxStageCount) * 100)}%`, background: '#3987e5' }" />
              </div>
            </li>
          </ol>
          <NuxtLink :to="`/crm/pipeline?pipeline=${pipelineId}`" class="mt-auto border-t border-zinc-800 pt-3 text-xs text-blue-300 hover:text-blue-200">
            Abrir funil →
          </NuxtLink>
        </section>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <!-- Vendedores -->
        <section aria-labelledby="rk-title" class="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 id="rk-title" class="mb-3 text-sm font-semibold text-white">Desempenho por vendedor</h2>
          <p v-if="!data.owners.length" class="py-6 text-center text-sm text-zinc-500">Nenhum negócio atribuído neste período.</p>
          <table v-else class="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr class="text-left text-xs text-zinc-400">
                <th scope="col" class="border-b border-zinc-800 py-2 pr-2 font-medium">Vendedor</th>
                <th scope="col" class="border-b border-zinc-800 px-2 py-2 text-right font-medium">Ganhos</th>
                <th scope="col" class="border-b border-zinc-800 px-2 py-2 text-right font-medium">Receita</th>
                <th scope="col" class="border-b border-zinc-800 px-2 py-2 text-right font-medium">Taxa de ganho</th>
                <th scope="col" class="border-b border-zinc-800 py-2 pl-2 text-right font-medium">Em aberto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in data.owners" :key="o.id">
                <td class="border-b border-zinc-800/70 py-2.5 pr-2">
                  <span class="flex items-center gap-2.5">
                    <span class="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold" :class="personTone(o.id)">{{ personInitials(o.name) }}</span>
                    <span class="font-medium text-white">{{ o.name }}</span>
                  </span>
                </td>
                <td class="border-b border-zinc-800/70 px-2 py-2.5 text-right tabular-nums text-zinc-200">{{ o.wonCount }}</td>
                <td class="border-b border-zinc-800/70 px-2 py-2.5 text-right tabular-nums text-zinc-200">{{ formatBRL(o.wonValue) }}</td>
                <td class="border-b border-zinc-800/70 px-2 py-2.5 text-right tabular-nums text-zinc-200">{{ o.winRate == null ? '—' : percent(o.winRate) }}</td>
                <td class="border-b border-zinc-800/70 py-2.5 pl-2 text-right tabular-nums text-zinc-200">{{ o.openCount }} · {{ formatBRLCompact(o.openValue) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div class="space-y-4">
          <!-- Origem -->
          <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 class="text-sm font-semibold text-white">Origem dos negócios</h2>
            <p class="mb-3 text-xs text-zinc-400">{{ totalSources }} criado{{ totalSources === 1 ? '' : 's' }} no mês</p>
            <p v-if="!data.sources.length" class="text-sm text-zinc-500">Nenhum negócio criado neste mês.</p>
            <ul class="space-y-2.5">
              <li v-for="s in data.sources" :key="s.name" class="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_64px] items-center gap-2.5 text-sm">
                <span class="truncate text-zinc-200" :title="s.name">{{ s.name }}</span>
                <span class="h-2 rounded bg-zinc-950"><span class="block h-2 rounded" :style="{ width: `${(s.count / data.sources[0].count) * 100}%`, background: '#3987e5' }" /></span>
                <span class="text-right tabular-nums text-zinc-400"><strong class="text-white">{{ s.count }}</strong> · {{ percent(s.count / totalSources) }}</span>
              </li>
            </ul>
          </section>

          <!-- Atenção -->
          <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div class="mb-2 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-white">Precisam de atenção</h2>
              <NuxtLink to="/crm/tasks" class="text-xs text-blue-300 hover:text-blue-200">Ver tarefas</NuxtLink>
            </div>
            <p v-if="!data.overdue.length && !data.idle.length" class="py-3 text-sm text-zinc-500">Tudo em dia por aqui.</p>
            <ul>
              <li v-for="t in data.overdue" :key="t.id" class="flex items-start gap-2.5 border-b border-zinc-800/70 py-2.5 last:border-b-0">
                <AlertCircle :size="15" class="mt-0.5 shrink-0 text-red-300" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-white">{{ t.title || ACTIVITY_TYPES[t.type]?.label }}</p>
                  <NuxtLink :to="`/crm/deals/${t.deal.id}`" class="block truncate text-xs text-zinc-400 hover:text-blue-200">
                    {{ t.deal.title }}<template v-if="t.assignee"> · {{ t.assignee.name }}</template>
                  </NuxtLink>
                </div>
                <span class="shrink-0 text-xs text-red-300">{{ formatDue(t.dueAt).replace('atrasada ', '') }}</span>
              </li>
              <li v-for="d in data.idle" :key="d.id" class="flex items-start gap-2.5 border-b border-zinc-800/70 py-2.5 last:border-b-0">
                <AlertCircle :size="15" class="mt-0.5 shrink-0 text-amber-300" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-white">Sem próxima atividade</p>
                  <NuxtLink :to="`/crm/deals/${d.id}`" class="block truncate text-xs text-zinc-400 hover:text-blue-200">
                    {{ d.title }}<template v-if="d.owner"> · {{ d.owner }}</template>
                  </NuxtLink>
                </div>
                <span class="shrink-0 text-xs tabular-nums text-zinc-300">{{ formatBRLCompact(d.value) }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, ArrowDown, ArrowUp, CalendarDays, ChevronDown, Download } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"
import {
  ACTIVITY_TYPES, formatBRL, formatBRLCompact, formatDue, personInitials, personTone, apiErrorMessage,
  type Pipeline,
} from "../../composables/useCrm"

definePageMeta({ middleware: "auth" })
useHead({ title: "Visão comercial" })

interface Overview {
  month: string
  kpis: {
    wonValue: number
    prevWonValue: number
    wonCount: number
    openValue: number
    openCount: number
    weighted: number
    winRate: number | null
    avgTicket: number | null
    cycleDays: number | null
    firstResponseMin: number | null
  }
  series: { key: string; won: number; forecast: number }[]
  stages: { id: string; name: string; color: string; isWon: boolean; count: number; value: number }[]
  sources: { name: string; count: number }[]
  owners: { id: string; name: string; wonCount: number; wonValue: number; openCount: number; openValue: number; winRate: number | null }[]
  overdue: { id: string; title?: string | null; type: string; dueAt: string; assignee?: { name: string } | null; deal: { id: string; title: string } }[]
  idle: { id: string; title: string; value: number; owner: string | null }[]
}

const api = useApi()
const now = new Date()
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
const pipelines = ref<Pipeline[]>([])
const pipelineId = ref("")
const data = ref<Overview | null>(null)
const loading = ref(true)
const error = ref("")
const hoverIndex = ref(5)

const percent = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`

const kpis = computed(() => {
  const k = data.value!.kpis
  const delta = k.prevWonValue ? (k.wonValue - k.prevWonValue) / k.prevWonValue : null
  return [
    {
      label: "Receita ganha",
      value: formatBRLCompact(k.wonValue),
      hint: delta == null ? `${k.wonCount} negócio${k.wonCount === 1 ? '' : 's'}` : `${percent(Math.abs(delta))} vs. mês anterior`,
      trend: delta == null ? null : delta >= 0 ? "up" : "down",
      tone: delta == null ? "text-zinc-400" : delta >= 0 ? "text-emerald-400" : "text-red-300",
    },
    { label: "Pipeline em aberto", value: formatBRLCompact(k.openValue), hint: `${k.openCount} negócio${k.openCount === 1 ? '' : 's'} · ponderado ${formatBRLCompact(k.weighted)}`, trend: null, tone: "text-zinc-400" },
    { label: "Taxa de ganho", value: k.winRate == null ? "—" : percent(k.winRate), hint: "ganhos ÷ fechados no mês", trend: null, tone: "text-zinc-400" },
    { label: "Ticket médio", value: k.avgTicket == null ? "—" : formatBRLCompact(k.avgTicket), hint: `${k.wonCount} ganho${k.wonCount === 1 ? '' : 's'} no mês`, trend: null, tone: "text-zinc-400" },
    { label: "Ciclo de venda", value: k.cycleDays == null ? "—" : `${Math.round(k.cycleDays)} dias`, hint: "da criação ao ganho", trend: null, tone: "text-zinc-400" },
    {
      label: "1ª resposta no atendimento",
      value: k.firstResponseMin == null ? "—" : k.firstResponseMin < 60 ? `${Math.round(k.firstResponseMin)} min` : `${(k.firstResponseMin / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`,
      hint: "média das conversas do mês",
      trend: null,
      tone: "text-zinc-400",
    },
  ]
})

const CHART_H = 206
const maxSeries = computed(() => {
  const max = Math.max(1, ...(data.value?.series ?? []).map((s) => s.won + s.forecast))
  // arredonda o topo da escala para um número "redondo"
  const magnitude = 10 ** Math.floor(Math.log10(max))
  return Math.ceil(max / magnitude) * magnitude
})
const bars = computed(() =>
  (data.value?.series ?? []).map((s) => {
    const [y, m] = s.key.split("-").map(Number)
    const date = new Date(y, m - 1, 1)
    return {
      ...s,
      short: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      wonH: Math.round((s.won / maxSeries.value) * CHART_H),
      forecastH: Math.round((s.forecast / maxSeries.value) * CHART_H),
    }
  })
)
const gridLines = computed(() =>
  [0, 0.5, 1].map((f) => ({ value: maxSeries.value * f, offset: Math.round(f * CHART_H) }))
)
const hovered = computed(() => bars.value[hoverIndex.value] ?? { label: "", won: 0, forecast: 0 })
const maxStageCount = computed(() => Math.max(1, ...(data.value?.stages ?? []).map((s) => s.count)))
const totalSources = computed(() => (data.value?.sources ?? []).reduce((a, s) => a + s.count, 0))

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({ month: month.value })
    if (pipelineId.value) params.set("pipelineId", pipelineId.value)
    data.value = await api<Overview>(`/crm/overview?${params}`)
    // destaca o mês selecionado (sexto item da série)
    hoverIndex.value = Math.max(0, data.value.series.findIndex((s) => s.key === data.value!.month))
    error.value = ""
  } catch (err) {
    error.value = apiErrorMessage(err, "Não foi possível carregar a visão comercial.")
  } finally {
    loading.value = false
  }
}

function exportCsv() {
  if (!data.value) return
  const k = data.value.kpis
  const rows: (string | number)[][] = [
    ["Seção", "Item", "Valor"],
    ["Indicadores", "Receita ganha", k.wonValue],
    ["Indicadores", "Pipeline em aberto", k.openValue],
    ["Indicadores", "Previsão ponderada", Math.round(k.weighted)],
    ["Indicadores", "Taxa de ganho", k.winRate == null ? "" : k.winRate.toFixed(3)],
    ["Indicadores", "Ticket médio", k.avgTicket == null ? "" : Math.round(k.avgTicket)],
    ...data.value.series.map((s) => ["Mensal", s.key, `${s.won};${Math.round(s.forecast)}`]),
    ...data.value.stages.map((s) => ["Etapas", s.name, `${s.count};${s.value}`]),
    ...data.value.owners.map((o) => ["Vendedores", o.name, `${o.wonCount};${o.wonValue}`]),
    ...data.value.sources.map((s) => ["Origem", s.name, s.count]),
  ]
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }))
  a.download = `visao-comercial-${data.value.month}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

watch([month, pipelineId], load)

onMounted(async () => {
  try {
    pipelines.value = await api<Pipeline[]>("/crm/pipelines")
    pipelineId.value = pipelines.value.find((p) => p.isDefault)?.id ?? pipelines.value[0]?.id ?? ""
  } catch {
    load()
  }
})
</script>
