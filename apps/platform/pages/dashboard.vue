<template>
  <div>
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <template v-if="loading">
        <div v-for="n in 3" :key="n" class="h-36 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
      </template>

      <template v-else>
        <MetricCard
          title="Empresas ativas"
          :value="stats.activeCompanies"
          :icon="Building2"
          color="amber"
        />
        <MetricCard
          title="Total de empresas"
          :value="stats.totalCompanies"
          :icon="Layers"
          color="zinc"
        />
        <MetricCard
          title="Status da API"
          :value="apiHealthy === null ? 'Verificando…' : apiHealthy ? 'Operacional' : 'Instável'"
          :icon="Activity"
          :color="apiHealthy === false ? 'red' : 'green'"
        />
      </template>
    </div>

    <div class="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900">
      <div class="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h2 class="font-semibold text-white">Empresas recentes</h2>
          <p class="mt-0.5 text-sm text-zinc-500">Últimas empresas cadastradas na plataforma.</p>
        </div>
        <NuxtLink
          to="/companies"
          class="flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300 transition"
        >
          Ver todas
          <ArrowRight :size="14" />
        </NuxtLink>
      </div>

      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="n in 4" :key="n" class="h-12 animate-pulse rounded-xl bg-zinc-800/60" />
      </div>

      <div
        v-else-if="companies.length === 0"
        class="flex flex-col items-center py-14 text-center"
      >
        <div class="mb-4 rounded-2xl bg-zinc-800 p-4">
          <Building2 :size="28" class="text-zinc-500" />
        </div>
        <p class="font-medium text-zinc-400">Nenhuma empresa cadastrada.</p>
        <p class="mt-1 text-sm text-zinc-600">Empresas criadas aparecerão aqui.</p>
        <NuxtLink
          to="/companies"
          class="mt-5 flex items-center gap-1.5 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
        >
          <Building2 :size="15" />
          Gerenciar empresas
        </NuxtLink>
      </div>

      <ul v-else class="divide-y divide-zinc-800 px-6">
        <li
          v-for="company in companies"
          :key="company.id"
          class="flex items-center justify-between py-3.5"
        >
          <div class="flex items-center gap-3">
            <div class="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-xs font-semibold text-amber-400 shrink-0">
              {{ company.name[0].toUpperCase() }}
            </div>
            <span class="text-sm font-medium text-zinc-200">{{ company.name }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full"
              :class="company.active ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'"
            >
              {{ company.active ? "Ativa" : "Inativa" }}
            </span>
            <span class="text-xs text-zinc-500">{{ formatDate(company.createdAt) }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from "vue"
import { Building2, Layers, Activity, ArrowRight } from "lucide-vue-next"
import { useApi } from "../composables/useApi"

definePageMeta({ middleware: "auth" })

const api = useApi()

const loading = ref(true)
const stats = reactive({ activeCompanies: 0, totalCompanies: 0 })
const companies = ref<{ id: string; name: string; createdAt: string; active: boolean }[]>([])
const apiHealthy = ref<boolean | null>(null)

function formatDate(date: string) {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("pt-BR")
}

onMounted(async () => {
  loading.value = true
  try {
    const config = useRuntimeConfig()
    await $fetch(`${config.public.apiUrl}/health`)
    apiHealthy.value = true
  } catch {
    apiHealthy.value = false
  }

  try {
    companies.value = await api<typeof companies.value>("/companies")
    stats.totalCompanies = companies.value.length
    stats.activeCompanies = companies.value.filter((c) => c.active).length
  } catch {
    companies.value = []
  } finally {
    loading.value = false
  }
})
</script>
