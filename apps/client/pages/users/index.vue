<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <p class="text-sm text-zinc-500">
        {{ !loading && users.length > 0 ? `${users.length} atendente${users.length !== 1 ? 's' : ''}` : '' }}
      </p>
      <button
        class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500"
        @click="openCreateModal"
      >
        <UserPlus :size="18" />
        Novo atendente
      </button>
    </div>

    <div class="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <!-- Loading -->
      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="n in 3" :key="n" class="h-14 animate-pulse rounded-xl bg-zinc-800/60" />
      </div>

      <!-- Vazio -->
      <div v-else-if="users.length === 0" class="flex flex-col items-center px-6 py-10 text-center text-zinc-500">
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
            <tr class="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
              <th class="px-4 py-3 font-medium text-left">Nome</th>
              <th class="px-4 py-3 font-medium text-left">Email</th>
              <th class="px-4 py-3 font-medium text-left">Papel</th>
              <th class="px-4 py-3 font-medium text-left">Departamentos</th>
              <th class="px-4 py-3 font-medium text-left">Status</th>
              <th class="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="user in users"
              :key="user.id"
              class="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
            >
              <td class="px-4 py-3.5 text-sm font-medium text-white">{{ user.name }}</td>
              <td class="px-4 py-3.5 text-sm text-zinc-400">{{ user.email }}</td>
              <td class="px-4 py-3.5">
                <span class="rounded-full px-2.5 py-1 text-xs font-medium" :class="roleBadge[user.role]">
                  {{ roleLabel[user.role] }}
                </span>
              </td>
              <td class="px-4 py-3.5">
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
              <td class="px-4 py-3.5">
                <span class="flex items-center gap-1.5 text-sm" :class="user.active ? 'text-green-400' : 'text-zinc-500'">
                  <span class="h-1.5 w-1.5 rounded-full" :class="user.active ? 'bg-green-400' : 'bg-zinc-600'" />
                  {{ user.active ? "Ativo" : "Inativo" }}
                </span>
              </td>
              <td class="px-4 py-3.5">
                <div v-if="user.role !== 'OWNER'" class="flex items-center justify-end gap-1">
                  <button
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                    title="Editar"
                    @click="openEditModal(user)"
                  >
                    <Pencil :size="14" />
                  </button>
                  <button
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800"
                    :class="user.active ? 'hover:text-yellow-400' : 'hover:text-green-400'"
                    :title="user.active ? 'Desativar' : 'Ativar'"
                    @click="toggleActive(user)"
                  >
                    <UserX v-if="user.active" :size="14" />
                    <UserCheck v-else :size="14" />
                  </button>
                  <button
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
                    title="Excluir"
                    @click="confirmDeleteUser(user)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
                <span v-else class="block text-right text-xs text-zinc-700">—</span>
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

    <!-- Modal: editar atendente -->
    <Teleport to="body">
      <div
        v-if="editModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="editModal = null"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Editar atendente</h2>
            <button class="text-zinc-500 hover:text-zinc-300" @click="editModal = null"><X :size="20" /></button>
          </div>
          <form class="space-y-4" @submit.prevent="saveEdit">
            <div>
              <label class="text-sm text-zinc-400">Nome</label>
              <input v-model="editModal.name" type="text" class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label class="text-sm text-zinc-400">Email</label>
              <input v-model="editModal.email" type="email" class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label class="text-sm text-zinc-400">Papel</label>
              <div class="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  v-for="option in roleOptions"
                  :key="option.value"
                  type="button"
                  class="rounded-xl border px-3 py-2.5 text-sm font-medium transition"
                  :class="editModal.role === option.value
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'"
                  @click="editModal.role = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <div>
              <label class="text-sm text-zinc-400">Departamentos</label>
              <div class="mt-1.5 flex flex-wrap gap-2">
                <button
                  v-for="dept in departments"
                  :key="dept.id"
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-sm transition"
                  :class="editModal.departmentIds.includes(dept.id)
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'"
                  @click="toggleEditDept(dept.id)"
                >
                  {{ dept.name }}
                </button>
                <span v-if="departments.length === 0" class="text-sm text-zinc-600">Nenhum departamento criado.</span>
              </div>
            </div>
            <p v-if="editError" class="text-sm text-red-400">{{ editError }}</p>
            <button
              type="submit"
              :disabled="editSaving || !editModal.name.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              <LoaderCircle v-if="editSaving" :size="16" class="animate-spin" />
              Salvar alterações
            </button>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Modal: confirmar exclusão de atendente -->
    <Teleport to="body">
      <div
        v-if="deleteTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="deleteTarget = null"
      >
        <div class="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-1 flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <Trash2 :size="20" class="text-red-400" />
            </div>
            <h2 class="text-base font-semibold text-white">Excluir atendente</h2>
          </div>
          <p class="mt-3 text-sm text-zinc-400">
            Tem certeza que deseja excluir <span class="font-semibold text-white">{{ deleteTarget.name }}</span>? Esta ação não pode ser desfeita.
          </p>
          <div class="mt-5 flex gap-3">
            <button
              class="flex-1 rounded-xl border border-zinc-700 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800"
              @click="deleteTarget = null"
            >Cancelar</button>
            <button
              class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
              :disabled="deleting"
              @click="doDeleteUser"
            >
              <LoaderCircle v-if="deleting" :size="14" class="animate-spin" />
              {{ deleting ? 'Excluindo…' : 'Excluir' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal: senha temporária gerada -->
    <Teleport to="body">
      <div
        v-if="createdPassword"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-2 flex items-center gap-2.5 text-green-400">
            <CheckCircle2 :size="20" />
            <h2 class="text-lg font-semibold text-white">Atendente criado</h2>
          </div>
          <p class="text-sm text-zinc-400">
            O sistema ainda não envia convite por e-mail — repasse esta senha temporária pra
            <span class="font-medium text-zinc-300">{{ createdName }}</span> pessoalmente. Ela só
            aparece agora; depois de fechar, não é possível recuperá-la (só redefinir uma nova).
          </p>

          <div class="mt-4 flex items-center gap-2 rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-3">
            <code class="flex-1 select-all font-mono text-base tracking-wide text-white">{{ createdPassword }}</code>
            <button
              type="button"
              class="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              :aria-label="copied ? 'Copiado' : 'Copiar senha'"
              @click="copyPassword"
            >
              <Check v-if="copied" :size="16" class="text-green-400" />
              <Copy v-else :size="16" />
            </button>
          </div>
          <p v-if="copied" class="mt-1.5 text-xs text-green-400">Copiado pra área de transferência.</p>

          <button
            type="button"
            class="mt-5 w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500"
            @click="closePasswordModal"
          >
            Entendi, fechar
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import { UserPlus, Users, X, LoaderCircle, CheckCircle2, Copy, Check, Pencil, UserX, UserCheck, Trash2 } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })
useHead({ title: "Usuários" })

type Role = "ADMIN" | "MEMBER"

interface ApiUser {
  id: string
  name: string
  email: string
  role: "OWNER" | Role
  active: boolean
  departmentNames: string[]
}

interface CreatedUser extends ApiUser {
  // Só vem preenchido na resposta de criação — o backend nunca
  // devolve isso de novo depois (só existe o hash a partir daí).
  temporaryPassword?: string
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

// Estado do modal de senha temporária, separado do modal de
// criação — assim que o atendente é criado, um modal fecha e o
// outro abre, sem os dois competirem pelo mesmo `showModal`.
const createdPassword = ref("")
const createdName = ref("")
const copied = ref(false)

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
    const created = await api<CreatedUser>("/users", {
      method: "POST",
      body: {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        departmentIds: form.departmentIds,
      },
    })
    const { temporaryPassword, ...user } = created
    users.value.push(user)
    showModal.value = false

    if (temporaryPassword) {
      createdName.value = user.name
      createdPassword.value = temporaryPassword
      copied.value = false
    }
  } catch (err: any) {
    createError.value =
      err?.data?.error ?? err?.data?.message ?? "Não foi possível criar o atendente."
  } finally {
    creating.value = false
  }
}

// ── Edit user ─────────────────────────────────────────────────────────────────

interface EditModal { id: string; name: string; email: string; role: "ADMIN" | "MEMBER"; departmentIds: string[] }
const editModal = ref<EditModal | null>(null)
const editSaving = ref(false)
const editError = ref("")

function openEditModal(user: ApiUser) {
  const deptIds = departments.value
    .filter((d) => user.departmentNames.includes(d.name))
    .map((d) => d.id)
  editModal.value = { id: user.id, name: user.name, email: user.email, role: user.role === "OWNER" ? "ADMIN" : user.role, departmentIds: deptIds }
  editError.value = ""
}

function toggleEditDept(id: string) {
  if (!editModal.value) return
  const idx = editModal.value.departmentIds.indexOf(id)
  if (idx === -1) editModal.value.departmentIds.push(id)
  else editModal.value.departmentIds.splice(idx, 1)
}

async function saveEdit() {
  if (!editModal.value) return
  editSaving.value = true
  editError.value = ""
  try {
    const updated = await api<ApiUser>(`/users/${editModal.value.id}`, {
      method: "PATCH",
      body: { name: editModal.value.name, email: editModal.value.email, role: editModal.value.role, departmentIds: editModal.value.departmentIds },
    })
    const idx = users.value.findIndex((u) => u.id === updated.id)
    if (idx !== -1) users.value[idx] = updated
    editModal.value = null
  } catch (err: any) {
    editError.value = err?.data?.error ?? err?.data?.message ?? "Não foi possível salvar."
  } finally {
    editSaving.value = false
  }
}

// ── Toggle active ─────────────────────────────────────────────────────────────

async function toggleActive(user: ApiUser) {
  try {
    const updated = await api<ApiUser>(`/users/${user.id}`, {
      method: "PATCH",
      body: { active: !user.active },
    })
    const idx = users.value.findIndex((u) => u.id === user.id)
    if (idx !== -1) users.value[idx] = updated
  } catch {}
}

// ── Delete user ───────────────────────────────────────────────────────────────

const deleteTarget = ref<ApiUser | null>(null)
const deleting = ref(false)

function confirmDeleteUser(user: ApiUser) { deleteTarget.value = user }

async function doDeleteUser() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api(`/users/${deleteTarget.value.id}`, { method: "DELETE" })
    users.value = users.value.filter((u) => u.id !== deleteTarget.value!.id)
    deleteTarget.value = null
  } catch {} finally {
    deleting.value = false
  }
}

function closePasswordModal() {
  createdPassword.value = ""
  createdName.value = ""
  copied.value = false
}

async function copyPassword() {
  try {
    await navigator.clipboard.writeText(createdPassword.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard API pode falhar (ex: contexto não-seguro/http) — a
    // senha continua selecionável manualmente (`select-all` no
    // <code>), então não é um caminho sem saída pro usuário.
  }
}

onMounted(loadData)
</script>
