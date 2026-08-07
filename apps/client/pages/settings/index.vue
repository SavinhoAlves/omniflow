<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white">Configurações</h1>
      <p class="text-zinc-400 mt-2">Dados da empresa e preferências gerais.</p>
    </div>

    <div class="space-y-6">
      <!-- Perfil da empresa -->
      <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div class="flex items-center gap-4">
          <div class="rounded-xl bg-blue-500/10 p-3 text-blue-400">
            <Building2 :size="22" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">Perfil da empresa</h2>
            <p class="mt-0.5 text-sm text-zinc-500">Como sua empresa aparece no sistema.</p>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="text-sm text-zinc-400">Nome da empresa</label>
            <input
              v-model="profile.name"
              type="text"
              class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label class="text-sm text-zinc-400">Identificador (URL de login)</label>
            <input
              :value="profile.slug"
              type="text"
              disabled
              class="mt-1.5 w-full cursor-not-allowed rounded-xl border border-zinc-800 bg-neutral-900/40 px-4 py-2.5 text-zinc-500"
            />
          </div>
        </div>

        <button
          type="button"
          :disabled="savingProfile"
          class="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          @click="saveProfile"
        >
          <LoaderCircle v-if="savingProfile" :size="16" class="animate-spin" />
          Salvar alterações
        </button>
        <p v-if="profileError" class="mt-2 text-sm text-red-400">{{ profileError }}</p>
      </section>

      <!-- Horário de atendimento -->
      <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div class="flex items-center gap-4">
          <div class="rounded-xl bg-purple-500/10 p-3 text-purple-400">
            <Clock :size="22" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">Horário de atendimento</h2>
            <p class="mt-0.5 text-sm text-zinc-500">
              Usado pelo fluxo de atendimento pra avisar o cliente fora do horário.
            </p>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-center gap-3">
          <div v-for="day in businessHours" :key="day.key" class="flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2">
            <span class="w-9 text-sm text-zinc-400">{{ day.label }}</span>
            <input
              v-model="day.active"
              type="checkbox"
              class="h-4 w-4 rounded border-zinc-700 bg-neutral-900 accent-blue-600"
            />
          </div>
        </div>

        <div class="mt-4 flex items-center gap-3 text-sm">
          <input
            v-model="hoursStart"
            type="time"
            class="rounded-lg border border-zinc-700 bg-neutral-900/80 px-3 py-1.5 text-white outline-none focus:border-blue-500"
          />
          <span class="text-zinc-500">até</span>
          <input
            v-model="hoursEnd"
            type="time"
            class="rounded-lg border border-zinc-700 bg-neutral-900/80 px-3 py-1.5 text-white outline-none focus:border-blue-500"
          />
        </div>
      </section>

      <!-- Atalhos -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NuxtLink
          to="/whatsapp"
          class="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-zinc-700"
        >
          <div class="rounded-xl bg-green-500/10 p-3 text-green-400">
            <MessageCircle :size="22" />
          </div>
          <div class="flex-1">
            <h2 class="font-semibold text-white">Canais conectados</h2>
            <p class="mt-0.5 text-sm text-zinc-500">Gerencie WhatsApp e outras integrações.</p>
          </div>
          <ChevronRight :size="18" class="text-zinc-600" />
        </NuxtLink>

        <NuxtLink
          to="/workflows"
          class="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-zinc-700"
        >
          <div class="rounded-xl bg-yellow-500/10 p-3 text-yellow-400">
            <Workflow :size="22" />
          </div>
          <div class="flex-1">
            <h2 class="font-semibold text-white">Fluxo de atendimento</h2>
            <p class="mt-0.5 text-sm text-zinc-500">Configure o bot e as regras de direcionamento.</p>
          </div>
          <ChevronRight :size="18" class="text-zinc-600" />
        </NuxtLink>
      </section>

      <!-- Diagnóstico técnico -->
      <details class="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <summary class="cursor-pointer text-sm font-medium text-zinc-400">
          Diagnóstico técnico
        </summary>

        <div class="mt-4 flex items-center justify-between gap-4">
          <p class="text-sm text-zinc-500">Testa a comunicação entre a API e o PostgreSQL.</p>

          <button
            type="button"
            :disabled="testingDb"
            class="flex shrink-0 items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
            @click="testDatabase"
          >
            <LoaderCircle v-if="testingDb" :size="15" class="animate-spin" />
            <Database v-else :size="15" />
            {{ testingDb ? "Testando…" : "Testar conexão" }}
          </button>
        </div>

        <div
          v-if="databaseStatus"
          class="mt-3 flex items-center gap-2 text-sm"
          :class="databaseStatus.success ? 'text-green-400' : 'text-red-400'"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="databaseStatus.success ? 'bg-green-400' : 'bg-red-400'" />
          {{ databaseStatus.message }}
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import {
  Building2,
  Clock,
  MessageCircle,
  Workflow,
  ChevronRight,
  Database,
  LoaderCircle,
} from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })

const api = useApi()

// --- Perfil ---
const profile = reactive({ name: "", slug: "" })
const savingProfile = ref(false)
const profileError = ref("")

async function loadProfile() {
  try {
    const company = await api<{ id: string; name: string; slug: string; cnpj?: string }>("/companies/me")
    profile.name = company.name
    profile.slug = company.slug
  } catch (err: any) {
    profileError.value = err?.data?.error ?? "Não foi possível carregar os dados da empresa."
  }
}

async function saveProfile() {
  savingProfile.value = true
  profileError.value = ""
  try {
    await api("/companies/me", { method: "PATCH", body: { name: profile.name } })
  } catch (err: any) {
    profileError.value = err?.data?.error ?? err?.data?.message ?? "Não foi possível salvar as alterações."
  } finally {
    savingProfile.value = false
  }
}

// --- Horário de atendimento (local por enquanto — sem endpoint ainda) ---
const businessHours = reactive([
  { key: "mon", label: "Seg", active: true },
  { key: "tue", label: "Ter", active: true },
  { key: "wed", label: "Qua", active: true },
  { key: "thu", label: "Qui", active: true },
  { key: "fri", label: "Sex", active: true },
  { key: "sat", label: "Sáb", active: false },
  { key: "sun", label: "Dom", active: false },
])
const hoursStart = ref("09:00")
const hoursEnd = ref("18:00")

// --- Diagnóstico técnico ---
const testingDb = ref(false)
const databaseStatus = ref<{ success: boolean; message: string } | null>(null)

async function testDatabase() {
  testingDb.value = true
  databaseStatus.value = null
  try {
    const config = useRuntimeConfig()
    await $fetch(`${config.public.apiUrl}/health/database`)
    databaseStatus.value = { success: true, message: "Banco conectado" }
  } catch {
    databaseStatus.value = { success: false, message: "Falha na conexão" }
  } finally {
    testingDb.value = false
  }
}

onMounted(loadProfile)
</script>
