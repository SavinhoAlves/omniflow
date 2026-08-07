<template>
  <div>
    <div class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-white">Atendentes</h1>
        <p class="text-zinc-400 mt-2">
          Gerencie sua equipe e o departamento de cada pessoa.
        </p>
      </div>

      <button
        class="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500"
        @click="openCreateModal"
      >
        <UserPlus :size="18" />
        Novo atendente
      </button>
    </div>

    <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <div v-for="n in 3" :key="n" class="h-14 animate-pulse rounded-xl bg-zinc-800/60" />
      </div>

      <!-- Vazio -->
      <div v-else-if="users.length === 0" class="flex flex-col items-center py-10 text-center text-zinc-500">
        <Users :size="40" class="mb-3" />
        Nenhum atendente cadastrado ainda.
        <button class="mt-4 text-sm font-medium text-blue-400 hover:text-blue-300" @click="openCreateModal">
          Cadastrar o primeiro atendente
        </button>
      </div>

      <!-- Tabela -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-zinc-800 text-zinc-500">
              <th class="py-3 font-medium">Nome</th>
              <th class="py-3 font-medium">Email</th>
              <th class="py-3 font-medium">Papel</th>
              <th class="py-3 font-medium">Departamentos</th>
              <th class="py-3 font-medium">Status</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="user in users" :key="user.id" class="border-b border-zinc-800 last:border-0">
              <td class="py-4 font-medium text-white">{{ user.name }}</td>
              <td class="py-4 text-zinc-400">{{ user.email }}</td>
              <td class="py-4">
                <span class="rounded-full px-2.5 py-1 text-xs font-medium" :class="roleBadge[user.role]">
                  {{ roleLabel[user.role] }}
                </span>
              </td>
              <td class="py-4">
                <div v-if="user.departmentNames.length" class="flex flex-wrap gap-1.5">
                  <span
                    v-for="name in user.departmentNames"
                    :key="name"
                    class="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {{ name }}
                  </span>
                </div>
                <span v-else class="text-sm text-zinc-600">—</span>
              </td>
              <td class="py-4">
                <span class="flex items-center gap-1.5 text-sm" :class="user.active ? 'text-green-400' : 'text-zinc-500'">
                  <span class="h-1.5 w-1.5 rounded-full" :class="user.active ? 'bg-green-400' : 'bg-zinc-600'" />
                  {{ user.active ? "Ativo" : "Inativo" }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: novo atendente -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="showModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Novo atendente</h2>
            <button class="text-zinc-500 hover:text-zinc-300" @click="showModal = false">
              <X :size="20" />
            </button>
          </div>

          <form class="space-y-4" @submit.prevent="createUser">
            <div>
              <label class="text-sm text-zinc-400">Nome</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="Nome completo"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Email</label>
              <input
                v-model="form.email"
                type="email"
                placeholder="pessoa@empresa.com"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Papel</label>
              <div class="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  v-for="option in roleOptions"
                  :key="option.value"
                  type="button"
                  class="rounded-xl border px-3 py-2.5 text-sm font-medium transition"
                  :class="form.role === option.value
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'"
                  @click="form.role = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div>
              <label class="text-sm text-zinc-400">Departamentos</label>

              <div v-if="departments.length === 0" class="mt-1.5 text-sm text-zinc-600">
                Nenhum departamento criado ainda —
                <NuxtLink to="/departments" class="text-blue-400 hover:underline">crie um primeiro</NuxtLink>.
              </div>

              <div v-else class="mt-1.5 flex flex-wrap gap-2">
                <button
                  v-for="dept in departments"
                  :key="dept.id"
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-sm transition"
                  :class="form.departmentIds.includes(dept.id)
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'"
                  @click="toggleDepartment(dept.id)"
                >
                  {{ dept.name }}
                </button>
              </div>
            </div>

            <p v-if="createError" class="text-sm text-red-400">{{ createError }}</p>

            <button
              type="submit"
              :disabled="creating || !form.name.trim() || !form.email.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LoaderCircle v-if="creating" :size="16" class="animate-spin" />
              Convidar atendente
            </button>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import { UserPlus, Users, X, LoaderCircle } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })

type Role = "ADMIN" | "MEMBER"

interface ApiUser {
  id: string
  name: string
  email: string
  role: "OWNER" | Role
  active: boolean
  departmentNames: string[]
}

interface Department {
  id: string
  name: string
}

const api = useApi()

const users = ref<ApiUser[]>([])
const departments = ref<Department[]>([])
const loading = ref(true)

const roleLabel: Record<ApiUser["role"], string> = {
  OWNER: "Dono",
  ADMIN: "Administrador",
  MEMBER: "Atendente",
}

const roleBadge: Record<ApiUser["role"], string> = {
  OWNER: "bg-blue-500/10 text-blue-400",
  ADMIN: "bg-purple-500/10 text-purple-400",
  MEMBER: "bg-zinc-700/50 text-zinc-300",
}

const roleOptions: { value: Role; label: string }[] = [
  { value: "MEMBER", label: "Atendente" },
  { value: "ADMIN", label: "Administrador" },
]

async function loadData() {
  loading.value = true
  try {
    // NOTA: `GET /users` e `GET /departments` ainda não existem na
    // API — os modelos já existem no banco (ver schema.prisma), só
    // faltam as rotas. Assim que existirem, a tela já consome sem
    // precisar de outra mudança.
    const [usersResult, departmentsResult] = await Promise.allSettled([
      api<ApiUser[]>("/users"),
      api<Department[]>("/departments"),
    ])
    users.value = usersResult.status === "fulfilled" ? usersResult.value : []
    departments.value = departmentsResult.status === "fulfilled" ? departmentsResult.value : []
  } finally {
    loading.value = false
  }
}

const showModal = ref(false)
const creating = ref(false)
const createError = ref("")

function emptyForm() {
  return { name: "", email: "", role: "MEMBER" as Role, departmentIds: [] as string[] }
}

const form = reactive(emptyForm())

function openCreateModal() {
  Object.assign(form, emptyForm())
  createError.value = ""
  showModal.value = true
}

function toggleDepartment(id: string) {
  const index = form.departmentIds.indexOf(id)
  if (index === -1) form.departmentIds.push(id)
  else form.departmentIds.splice(index, 1)
}

async function createUser() {
  creating.value = true
  createError.value = ""

  try {
    const created = await api<ApiUser>("/users", {
      method: "POST",
      body: {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        departmentIds: form.departmentIds,
      },
    })
    users.value.push(created)
    showModal.value = false
  } catch (err: any) {
    createError.value =
      err?.data?.message ?? "A API de atendentes ainda não está disponível neste ambiente."
  } finally {
    creating.value = false
  }
}

onMounted(loadData)
</script>
