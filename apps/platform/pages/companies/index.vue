<template>
  <div>
    <div class="rounded-2xl border border-zinc-800 bg-zinc-900">
      <div class="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h2 class="font-semibold text-white">Lista de empresas</h2>
          <p class="mt-0.5 text-sm text-zinc-500">{{ companies.length }} empresa{{ companies.length === 1 ? "" : "s" }} cadastrada{{ companies.length === 1 ? "" : "s" }}</p>
        </div>
        <button
          class="flex shrink-0 items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500"
          @click="openCreateModal"
        >
          <Plus :size="16" />
          Nova empresa
        </button>
      </div>

      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="n in 3" :key="n" class="h-12 animate-pulse rounded-xl bg-zinc-800/60" />
      </div>

      <div v-else-if="companies.length === 0" class="flex flex-col items-center py-14 text-center">
        <div class="mb-4 rounded-2xl bg-zinc-800 p-4">
          <Building2 :size="28" class="text-zinc-500" />
        </div>
        <p class="font-medium text-zinc-400">Nenhuma empresa cadastrada.</p>
        <p class="mt-1 text-sm text-zinc-600">Crie a primeira empresa clicando em "Nova empresa".</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-zinc-800 text-zinc-500">
              <th class="px-6 py-3 font-medium">Nome</th>
              <th class="px-6 py-3 font-medium">Criada em</th>
              <th class="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="company in companies" :key="company.id" class="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition">
              <td class="px-6 py-4 font-medium text-white">{{ company.name }}</td>
              <td class="px-6 py-4 text-zinc-400">{{ formatDate(company.createdAt) }}</td>
              <td class="px-6 py-4">
                <span
                  class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="company.active ? 'bg-green-500/10 text-green-400' : 'bg-zinc-700/50 text-zinc-400'"
                >
                  {{ company.active ? "Ativa" : "Inativa" }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="showModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Nova empresa</h2>
            <button class="text-zinc-500 hover:text-zinc-300" @click="showModal = false">
              <X :size="20" />
            </button>
          </div>

          <form class="space-y-4" @submit.prevent="createCompany">
            <div>
              <label class="text-sm text-zinc-400">Nome da empresa</label>
              <input
                v-model="form.companyName"
                type="text"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Nome do responsável</label>
              <input
                v-model="form.ownerName"
                type="text"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Email do responsável</label>
              <input
                v-model="form.email"
                type="email"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Senha inicial</label>
              <input
                v-model="form.password"
                type="password"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
              />
            </div>

            <p v-if="createError" class="text-sm text-red-400">{{ createError }}</p>

            <button
              type="submit"
              :disabled="creating"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LoaderCircle v-if="creating" :size="16" class="animate-spin" />
              Criar empresa
            </button>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import { Plus, Building2, X, LoaderCircle } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })

interface Company {
  id: string
  name: string
  createdAt: string
  active: boolean
}

const api = useApi()
const companies = ref<Company[]>([])
const loading = ref(true)

async function loadCompanies() {
  loading.value = true
  try {
    companies.value = await api<Company[]>("/companies")
  } catch {
    companies.value = []
  } finally {
    loading.value = false
  }
}

function formatDate(date: string) {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("pt-BR")
}

const showModal = ref(false)
const creating = ref(false)
const createError = ref("")

function emptyForm() {
  return { companyName: "", ownerName: "", email: "", password: "" }
}

const form = reactive(emptyForm())

function openCreateModal() {
  Object.assign(form, emptyForm())
  createError.value = ""
  showModal.value = true
}

async function createCompany() {
  creating.value = true
  createError.value = ""
  try {
    await api("/companies", { method: "POST", body: form })
    showModal.value = false
    await loadCompanies()
  } catch (err: any) {
    createError.value = err?.data?.error ?? "Não foi possível criar a empresa."
  } finally {
    creating.value = false
  }
}

onMounted(loadCompanies)
</script>
