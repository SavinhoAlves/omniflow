<template>
  <div>
    <div class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-white">Departamentos</h1>
        <p class="text-zinc-400 mt-2">
          Organize sua equipe em setores — atendimentos são direcionados pra cá.
        </p>
      </div>

      <button
        class="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500"
        @click="openCreateModal"
      >
        <Plus :size="18" />
        Novo departamento
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="n in 3" :key="n" class="h-20 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <!-- Vazio -->
    <div
      v-else-if="departments.length === 0"
      class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 py-16 text-center"
    >
      <div class="mb-4 rounded-2xl bg-blue-500/10 p-4 text-blue-400">
        <Network :size="32" />
      </div>
      <h2 class="text-lg font-semibold text-white">Nenhum departamento criado</h2>
      <p class="mt-1.5 max-w-sm text-sm text-zinc-500">
        Crie setores como "Suporte" ou "Vendas" para organizar sua equipe e direcionar
        atendimentos automaticamente.
      </p>
      <button
        class="mt-6 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500"
        @click="openCreateModal"
      >
        <Plus :size="18" />
        Criar departamento
      </button>
    </div>

    <!-- Lista -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="dept in departments"
        :key="dept.id"
        class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="rounded-xl bg-blue-500/10 p-2.5 text-blue-400">
              <Network :size="18" />
            </div>
            <div>
              <h3 class="font-semibold text-white">{{ dept.name }}</h3>
              <p v-if="dept.isDefault" class="text-xs text-blue-400">Departamento padrão</p>
            </div>
          </div>

          <button class="text-zinc-500 hover:text-zinc-300" @click="openEditModal(dept)">
            <Pencil :size="16" />
          </button>
        </div>

        <p class="mt-3 text-sm text-zinc-500">
          {{ dept.description || "Sem descrição." }}
        </p>

        <div class="mt-4 flex items-center gap-1.5 text-sm text-zinc-500">
          <Users :size="15" />
          {{ dept.memberCount ?? 0 }} atendente{{ dept.memberCount === 1 ? "" : "s" }}
        </div>
      </div>
    </div>

    <!-- Modal: criar/editar -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="showModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">
              {{ editingId ? "Editar departamento" : "Novo departamento" }}
            </h2>
            <button class="text-zinc-500 hover:text-zinc-300" @click="showModal = false">
              <X :size="20" />
            </button>
          </div>

          <form class="space-y-4" @submit.prevent="saveDepartment">
            <div>
              <label class="text-sm text-zinc-400">Nome</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="Suporte, Vendas, Financeiro…"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label class="text-sm text-zinc-400">Descrição (opcional)</label>
              <textarea
                v-model="form.description"
                rows="2"
                placeholder="O que esse departamento resolve?"
                class="mt-1.5 w-full resize-none rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <label class="flex items-center gap-2.5 text-sm text-zinc-400">
              <input v-model="form.isDefault" type="checkbox" class="h-4 w-4 rounded border-zinc-700 bg-neutral-900 accent-blue-600" />
              Direcionar aqui quando nenhuma regra do fluxo de atendimento se aplicar
            </label>

            <p v-if="saveError" class="text-sm text-red-400">{{ saveError }}</p>

            <button
              type="submit"
              :disabled="saving || !form.name.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
              {{ editingId ? "Salvar alterações" : "Criar departamento" }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import { Plus, Network, Users, Pencil, X, LoaderCircle } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })

interface Department {
  id: string
  name: string
  description?: string | null
  isDefault: boolean
  memberCount?: number
}

const api = useApi()

const departments = ref<Department[]>([])
const loading = ref(true)

async function loadDepartments() {
  loading.value = true
  try {
    // NOTA: endpoint ainda não existe na API (só o schema/modelo já
    // suporta isso — ver Department em schema.prisma). Assim que
    // `GET /departments` for implementado, a lista passa a vir daqui
    // sem precisar mudar mais nada na tela.
    departments.value = await api<Department[]>("/departments")
  } catch {
    departments.value = []
  } finally {
    loading.value = false
  }
}

const showModal = ref(false)
const saving = ref(false)
const saveError = ref("")
const editingId = ref<string | null>(null)

function emptyForm() {
  return { name: "", description: "", isDefault: false }
}

const form = reactive(emptyForm())

function openCreateModal() {
  editingId.value = null
  Object.assign(form, emptyForm())
  saveError.value = ""
  showModal.value = true
}

function openEditModal(dept: Department) {
  editingId.value = dept.id
  Object.assign(form, { name: dept.name, description: dept.description ?? "", isDefault: dept.isDefault })
  saveError.value = ""
  showModal.value = true
}

async function saveDepartment() {
  saving.value = true
  saveError.value = ""

  try {
    if (editingId.value) {
      const updated = await api<Department>(`/departments/${editingId.value}`, {
        method: "PATCH",
        body: { name: form.name.trim(), description: form.description || undefined, isDefault: form.isDefault },
      })
      const index = departments.value.findIndex((d) => d.id === editingId.value)
      if (index !== -1) departments.value[index] = updated
    } else {
      const created = await api<Department>("/departments", {
        method: "POST",
        body: { name: form.name.trim(), description: form.description || undefined, isDefault: form.isDefault },
      })
      departments.value.push(created)
    }
    showModal.value = false
  } catch (err: any) {
    saveError.value =
      err?.data?.message ?? "A API de departamentos ainda não está disponível neste ambiente."
  } finally {
    saving.value = false
  }
}

onMounted(loadDepartments)
</script>
