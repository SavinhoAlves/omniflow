<template>
  <div>
    <div class="mb-6 flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-sm text-yellow-300/80">
      <ShieldAlert :size="16" class="shrink-0" />
      Área de plataforma — lista todas as empresas clientes do OmniFlow, não só a sua.
    </div>

    <div class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-white">Empresas</h1>
        <p class="text-zinc-400 mt-2">Gerencie as empresas clientes cadastradas no SaaS.</p>
      </div>

      <button
        class="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500"
        @click="openCreateModal"
      >
        <Plus :size="18" />
        Nova empresa
      </button>
    </div>

    <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-white">Lista de empresas</h2>
          <p class="mt-1 text-sm text-zinc-500">{{ companies.length }} empresas cadastradas</p>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <div v-for="n in 3" :key="n" class="h-12 animate-pulse rounded-xl bg-zinc-800/60" />
      </div>

      <!-- Vazio -->
      <div v-else-if="companies.length === 0" class="flex flex-col items-center py-10 text-center text-zinc-500">
        <Building2 :size="40" class="mb-3" />
        Nenhuma empresa cadastrada.
      </div>

      <!-- Tabela -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-zinc-800 text-zinc-500">
              <th class="py-3 font-medium">Nome</th>
              <th class="py-3 font-medium">Criada em</th>
              <th class="py-3 font-medium">Status</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="company in companies" :key="company.id" class="border-b border-zinc-800 last:border-0">
              <td class="py-4 font-medium text-white">{{ company.name }}</td>
              <td class="py-4 text-zinc-400">{{ formatDate(company.createdAt) }}</td>
              <td class="py-4">
                <span
                  class="rounded-full px-3 py-1 text-sm"
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

    <!-- Modal: nova empresa -->
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
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Nome do responsável</label>
              <input
                v-model="form.ownerName"
                type="text"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Email do responsável</label>
              <input
                v-model="form.email"
                type="email"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Senha inicial</label>
              <input
                v-model="form.password"
                type="password"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <p v-if="createError" class="text-sm text-red-400">{{ createError }}</p>

            <button
              type="submit"
              :disabled="creating"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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
import { Plus, Building2, ShieldAlert, X, LoaderCircle } from "lucide-vue-next"
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
    // NOTA: `GET /companies` (listagem cross-tenant, uso exclusivo de
    // PlatformUser/SUPER_ADMIN) ainda não existe na API.
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
    // NOTA: precisa ser um endpoint próprio de plataforma (`POST
    // /companies`), NÃO o `/auth/register` — esse último devolve um
    // cookie de sessão para o dono recém-criado, o que substituiria
    // silenciosamente a sessão do admin da plataforma que está
    // criando a empresa.
    await api("/companies", { method: "POST", body: form })
    showModal.value = false
    await loadCompanies()
  } catch (err: any) {
    createError.value = err?.data?.error ?? "A API de criação de empresas ainda não está disponível."
  } finally {
    creating.value = false
  }
}

onMounted(loadCompanies)
</script>
