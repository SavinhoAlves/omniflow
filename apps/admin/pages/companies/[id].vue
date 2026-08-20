<template>
  <div>
    <!-- Voltar -->
    <button
      class="mb-6 flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
      @click="$router.push('/companies')"
    >
      <ChevronLeft :size="16" />
      Voltar para empresas
    </button>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="h-10 w-64 animate-pulse rounded-xl bg-zinc-800" />
      <div class="h-4 w-40 animate-pulse rounded-lg bg-zinc-800" />
    </div>

    <template v-else-if="company">
      <!-- Cabeçalho -->
      <div class="mb-8 flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-3xl font-bold text-white">{{ company.name }}</h1>
            <span
              class="rounded-full px-3 py-1 text-sm"
              :class="company.active ? 'bg-green-500/10 text-green-400' : 'bg-zinc-700/50 text-zinc-400'"
            >
              {{ company.active ? "Ativa" : "Inativa" }}
            </span>
          </div>
          <p class="mt-1 text-sm text-zinc-500">
            Slug: <span class="font-mono text-zinc-400">{{ company.slug }}</span>
            <span v-if="company.cnpj"> · CNPJ: {{ company.cnpj }}</span>
            · {{ company._count?.users ?? 0 }} atendente(s)
            · criada em {{ formatDate(company.createdAt) }}
          </p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="mb-6 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition"
          :class="activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'"
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" :size="15" />
          {{ tab.label }}
          <span
            v-if="tab.count > 0"
            class="rounded-full bg-white/10 px-2 py-0.5 text-xs"
          >{{ tab.count }}</span>
        </button>
      </div>

      <!-- ─── CONTRATOS ─── -->
      <div v-if="activeTab === 'contracts'">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">Contratos</h2>
          <button
            class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            @click="openContractModal()"
          >
            <Plus :size="15" />
            Novo contrato
          </button>
        </div>

        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div v-if="company.contracts.length === 0" class="flex flex-col items-center py-10 text-center text-zinc-500">
            <FileText :size="36" class="mb-3" />
            Nenhum contrato cadastrado.
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="c in company.contracts"
              :key="c.id"
              class="rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-3"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="font-semibold text-white">{{ c.plan }}</p>
                    <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="contractStatusClass(c.status)">
                      {{ contractStatusLabel(c.status) }}
                    </span>
                    <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="sigStatusClass(c.signatureStatus)">
                      {{ sigStatusLabel(c.signatureStatus) }}
                    </span>
                  </div>
                  <p class="mt-0.5 text-xs text-zinc-500">
                    {{ contractCycleLabel(c.billingCycle) }}
                    <span v-if="c.value"> · R$ {{ formatMoney(c.value) }}/{{ c.billingCycle === 'MONTHLY' ? 'mês' : 'ano' }}</span>
                    · Início: {{ formatDate(c.startDate) }}
                    <span v-if="c.endDate"> · Fim: {{ formatDate(c.endDate) }}</span>
                  </p>
                  <p v-if="c.signerName" class="mt-0.5 text-xs text-zinc-600">
                    Assinado por {{ c.signerName }} em {{ formatDate(c.signedAt!) }}
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button title="Visualizar / Imprimir contrato"
                    class="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-white"
                    @click="openContractDocument(c)">
                    <Printer :size="14" />
                  </button>
                  <button
                    v-if="c.signatureStatus === 'PENDING'"
                    title="Registrar assinatura"
                    class="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-white"
                    @click="openSignModal(c)">
                    <PenLine :size="14" />
                  </button>
                  <button
                    v-if="c.signatureStatus !== 'PENDING'"
                    title="Revogar assinatura"
                    class="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-orange-400"
                    @click="revokeSignature(c)">
                    <RotateCcw :size="14" />
                  </button>
                  <button class="rounded-lg p-1.5 text-zinc-600 transition hover:bg-zinc-700 hover:text-zinc-300" @click="openContractModal(c)">
                    <Pencil :size="14" />
                  </button>
                  <button class="rounded-lg p-1.5 text-zinc-600 transition hover:bg-zinc-700 hover:text-red-400" @click="deleteContract(c.id)">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── INSTALAÇÕES ─── -->
      <div v-if="activeTab === 'installations'">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">Instalações</h2>
          <button
            class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            @click="openInstallModal()"
          >
            <Plus :size="15" />
            Nova instalação
          </button>
        </div>

        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div v-if="company.installations.length === 0" class="flex flex-col items-center py-10 text-center text-zinc-500">
            <Monitor :size="36" class="mb-3" />
            Nenhuma instalação cadastrada.
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="inst in company.installations"
              :key="inst.id"
              class="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-3"
            >
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-white">{{ inst.name }}</p>
                <p class="mt-0.5 text-xs text-zinc-500">
                  <span v-if="inst.location">{{ inst.location }} · </span>
                  <span v-if="inst.version">v{{ inst.version }} · </span>
                  <span v-if="inst.lastSyncAt">Último sync: {{ formatDateTime(inst.lastSyncAt) }}</span>
                  <span v-else>Sem registro de sync</span>
                </p>
              </div>
              <div class="flex items-center gap-3">
                <span class="rounded-full px-3 py-1 text-xs font-medium" :class="installStatusClass(inst.status)">
                  {{ installStatusLabel(inst.status) }}
                </span>
                <button class="text-zinc-600 transition hover:text-zinc-300" @click="openInstallModal(inst)">
                  <Pencil :size="14" />
                </button>
                <button class="text-zinc-600 transition hover:text-red-400" @click="deleteInstall(inst.id)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── TICKETS ─── -->
      <div v-if="activeTab === 'tickets'">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">Tickets de suporte</h2>
          <button
            class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            @click="openTicketModal()"
          >
            <Plus :size="15" />
            Novo ticket
          </button>
        </div>

        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div v-if="company.tickets.length === 0" class="flex flex-col items-center py-10 text-center text-zinc-500">
            <LifeBuoy :size="36" class="mb-3" />
            Nenhum ticket aberto.
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="t in company.tickets"
              :key="t.id"
              class="rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-white truncate">{{ t.title }}</p>
                    <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="ticketTypeClass(t.type)">
                      {{ ticketTypeLabel(t.type) }}
                    </span>
                  </div>
                  <p class="mt-1 text-xs text-zinc-400 line-clamp-2">{{ t.description }}</p>
                  <p class="mt-1 text-xs text-zinc-600">{{ formatDateTime(t.createdAt) }}</p>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-2">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="ticketPriorityClass(t.priority)">
                    {{ ticketPriorityLabel(t.priority) }}
                  </span>
                  <div class="flex items-center gap-2">
                    <select
                      class="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none"
                      :value="t.status"
                      @change="updateTicketStatus(t.id, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="OPEN">Aberto</option>
                      <option value="IN_PROGRESS">Em andamento</option>
                      <option value="RESOLVED">Resolvido</option>
                      <option value="CLOSED">Fechado</option>
                    </select>
                    <button class="text-zinc-600 transition hover:text-red-400" @click="deleteTicket(t.id)">
                      <Trash2 :size="13" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="flex flex-col items-center py-20 text-zinc-500">
      <Building2 :size="40" class="mb-3" />
      Empresa não encontrada.
    </div>

    <!-- ─── MODAL ASSINATURA ─── -->
    <Teleport to="body">
      <div
        v-if="signModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="signModal = false"
      >
        <div class="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Registrar Assinatura</h2>
            <button class="text-zinc-500 hover:text-zinc-300" @click="signModal = false">
              <X :size="20" />
            </button>
          </div>

          <div class="mb-4 flex gap-2">
            <button
              class="flex-1 rounded-xl py-2 text-sm font-medium transition"
              :class="signMode === 'digital' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'"
              @click="signMode = 'digital'; clearCanvas()"
            >
              <PenLine :size="13" class="inline mr-1" /> Digital (canvas)
            </button>
            <button
              class="flex-1 rounded-xl py-2 text-sm font-medium transition"
              :class="signMode === 'physical' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'"
              @click="signMode = 'physical'"
            >
              <CheckCircle :size="13" class="inline mr-1" /> Física (confirmar)
            </button>
          </div>

          <div class="mb-4">
            <label class="text-sm text-zinc-400">Nome do signatário</label>
            <input v-model="signerName" type="text" placeholder="Nome completo de quem assina"
              class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500" />
          </div>

          <div v-if="signMode === 'digital'" class="mb-4">
            <label class="text-sm text-zinc-400 mb-1.5 block">Assine abaixo</label>
            <div class="relative rounded-xl border border-zinc-700 bg-white overflow-hidden" style="height:140px">
              <canvas
                ref="sigCanvas"
                class="w-full h-full cursor-crosshair touch-none"
                @mousedown="startDraw" @mousemove="draw" @mouseup="stopDraw" @mouseleave="stopDraw"
                @touchstart.prevent="startDrawTouch" @touchmove.prevent="drawTouch" @touchend="stopDraw"
              />
              <p v-if="!canvasDirty" class="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
                Assine aqui
              </p>
            </div>
            <button class="mt-1.5 text-xs text-zinc-500 hover:text-zinc-300 underline" @click="clearCanvas">
              Limpar
            </button>
          </div>

          <div v-else class="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-sm text-zinc-400">
            Confirme que o contrato foi assinado fisicamente pelo cliente. O sistema registrará o nome e a data como confirmação.
          </div>

          <p v-if="signError" class="mb-3 text-sm text-red-400">{{ signError }}</p>

          <button
            :disabled="saving || !signerName.trim() || (signMode === 'digital' && !canvasDirty)"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-40"
            @click="confirmSign"
          >
            <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
            Confirmar assinatura
          </button>
        </div>
      </div>
    </Teleport>

    <!-- ─── MODAL CONTRATO ─── -->
    <Teleport to="body">
      <div
        v-if="contractModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="contractModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">
              {{ editingContract ? "Editar contrato" : "Novo contrato" }}
            </h2>
            <button class="text-zinc-500 hover:text-zinc-300" @click="contractModal = false">
              <X :size="20" />
            </button>
          </div>

          <form class="space-y-4" @submit.prevent="saveContract">
            <div>
              <label class="text-sm text-zinc-400">Plano</label>
              <input v-model="contractForm.plan" type="text" placeholder="ex: Pro, Básico, Enterprise"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-sm text-zinc-400">Status</label>
                <select v-model="contractForm.status"
                  class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500">
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Ativo</option>
                  <option value="SUSPENDED">Suspenso</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
              <div>
                <label class="text-sm text-zinc-400">Ciclo</label>
                <select v-model="contractForm.billingCycle"
                  class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500">
                  <option value="MONTHLY">Mensal</option>
                  <option value="ANNUAL">Anual</option>
                </select>
              </div>
            </div>
            <div>
              <label class="text-sm text-zinc-400">Valor (R$)</label>
              <input v-model="contractForm.value" type="number" step="0.01" min="0" placeholder="0,00"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-sm text-zinc-400">Início</label>
                <input v-model="contractForm.startDate" type="date"
                  class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500" />
              </div>
              <div>
                <label class="text-sm text-zinc-400">Fim (opcional)</label>
                <input v-model="contractForm.endDate" type="date"
                  class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label class="text-sm text-zinc-400">Observações</label>
              <textarea v-model="contractForm.notes" rows="2" placeholder="Notas internas..."
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500 resize-none" />
            </div>
            <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>
            <button type="submit" :disabled="saving"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50">
              <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
              {{ editingContract ? "Salvar alterações" : "Criar contrato" }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- ─── MODAL INSTALAÇÃO ─── -->
    <Teleport to="body">
      <div
        v-if="installModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="installModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">
              {{ editingInstall ? "Editar instalação" : "Nova instalação" }}
            </h2>
            <button class="text-zinc-500 hover:text-zinc-300" @click="installModal = false">
              <X :size="20" />
            </button>
          </div>

          <form class="space-y-4" @submit.prevent="saveInstall">
            <div>
              <label class="text-sm text-zinc-400">Nome / identificador</label>
              <input v-model="installForm.name" type="text" placeholder="ex: PDV Caixa 1"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-sm text-zinc-400">Localização</label>
                <input v-model="installForm.location" type="text" placeholder="ex: Filial Centro"
                  class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500" />
              </div>
              <div>
                <label class="text-sm text-zinc-400">Versão</label>
                <input v-model="installForm.version" type="text" placeholder="ex: 1.4.2"
                  class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label class="text-sm text-zinc-400">Status</label>
              <select v-model="installForm.status"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500">
                <option value="PENDING">Pendente</option>
                <option value="ACTIVE">Ativo</option>
                <option value="MAINTENANCE">Em manutenção</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </div>
            <div>
              <label class="text-sm text-zinc-400">Observações</label>
              <textarea v-model="installForm.notes" rows="2" placeholder="Notas internas..."
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500 resize-none" />
            </div>
            <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>
            <button type="submit" :disabled="saving"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50">
              <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
              {{ editingInstall ? "Salvar alterações" : "Criar instalação" }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- ─── MODAL TICKET ─── -->
    <Teleport to="body">
      <div
        v-if="ticketModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        @click.self="ticketModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Novo ticket de suporte</h2>
            <button class="text-zinc-500 hover:text-zinc-300" @click="ticketModal = false">
              <X :size="20" />
            </button>
          </div>

          <form class="space-y-4" @submit.prevent="saveTicket">
            <div>
              <label class="text-sm text-zinc-400">Título</label>
              <input v-model="ticketForm.title" type="text" placeholder="Resumo do problema"
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-sm text-zinc-400">Tipo</label>
                <select v-model="ticketForm.type"
                  class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500">
                  <option value="SYNC">Sync</option>
                  <option value="INSTALLATION">Instalação</option>
                  <option value="BUG">Bug</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
              <div>
                <label class="text-sm text-zinc-400">Prioridade</label>
                <select v-model="ticketForm.priority"
                  class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500">
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label class="text-sm text-zinc-400">Descrição</label>
              <textarea v-model="ticketForm.description" rows="3" placeholder="Descreva o problema em detalhes..."
                class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500 resize-none" />
            </div>
            <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>
            <button type="submit" :disabled="saving"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50">
              <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
              Abrir ticket
            </button>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, nextTick } from "vue"
import { useRoute } from "vue-router"
import {
  ChevronLeft, Plus, X, Pencil, Trash2, LoaderCircle,
  FileText, Monitor, LifeBuoy, Building2, Printer, PenLine, CheckCircle, RotateCcw,
} from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })

const route = useRoute()
const api = useApi()
const runtimeConfig = useRuntimeConfig()
const companyId = route.params.id as string

interface Contract {
  id: string
  plan: string
  status: string
  value: number | null
  billingCycle: string
  startDate: string
  endDate: string | null
  notes: string | null
  signatureStatus: string
  signerName: string | null
  signedAt: string | null
  signatureData: string | null
  createdAt: string
}

interface Installation {
  id: string
  name: string
  location: string | null
  version: string | null
  status: string
  lastSyncAt: string | null
  notes: string | null
  createdAt: string
}

interface Ticket {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  notes: string | null
  createdAt: string
}

interface Company {
  id: string
  name: string
  slug: string
  cnpj: string | null
  active: boolean
  createdAt: string
  _count: { users: number }
  contracts: Contract[]
  installations: Installation[]
  tickets: Ticket[]
}

const company = ref<Company | null>(null)
const loading = ref(true)
const activeTab = ref("contracts")

const tabs = computed(() => [
  { key: "contracts", label: "Contratos", icon: FileText, count: company.value?.contracts.length ?? 0 },
  { key: "installations", label: "Instalações", icon: Monitor, count: company.value?.installations.length ?? 0 },
  { key: "tickets", label: "Suporte", icon: LifeBuoy, count: company.value?.tickets.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length ?? 0 },
])

async function load() {
  loading.value = true
  try {
    company.value = await api<Company>(`/companies/${companyId}`)
  } catch {
    company.value = null
  } finally {
    loading.value = false
  }
}

// ─── Formatadores ───────────────────────────────────────────

function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "-"
}

function formatDateTime(d: string) {
  return d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"
}

function formatMoney(v: number | null) {
  if (v == null) return "-"
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
}

function contractStatusLabel(s: string) {
  return { TRIAL: "Trial", ACTIVE: "Ativo", SUSPENDED: "Suspenso", CANCELLED: "Cancelado" }[s] ?? s
}

function contractStatusClass(s: string) {
  return {
    TRIAL: "bg-yellow-500/10 text-yellow-400",
    ACTIVE: "bg-green-500/10 text-green-400",
    SUSPENDED: "bg-orange-500/10 text-orange-400",
    CANCELLED: "bg-zinc-700/50 text-zinc-400",
  }[s] ?? "bg-zinc-700/50 text-zinc-400"
}

function contractCycleLabel(c: string) {
  return c === "ANNUAL" ? "Anual" : "Mensal"
}

function installStatusLabel(s: string) {
  return { PENDING: "Pendente", ACTIVE: "Ativo", MAINTENANCE: "Manutenção", OFFLINE: "Offline" }[s] ?? s
}

function installStatusClass(s: string) {
  return {
    PENDING: "bg-yellow-500/10 text-yellow-400",
    ACTIVE: "bg-green-500/10 text-green-400",
    MAINTENANCE: "bg-orange-500/10 text-orange-400",
    OFFLINE: "bg-red-500/10 text-red-400",
  }[s] ?? "bg-zinc-700/50 text-zinc-400"
}

function ticketTypeLabel(t: string) {
  return { SYNC: "Sync", INSTALLATION: "Instalação", BUG: "Bug", OTHER: "Outro" }[t] ?? t
}

function ticketTypeClass(t: string) {
  return {
    SYNC: "bg-blue-500/10 text-blue-400",
    INSTALLATION: "bg-purple-500/10 text-purple-400",
    BUG: "bg-red-500/10 text-red-400",
    OTHER: "bg-zinc-700/50 text-zinc-400",
  }[t] ?? "bg-zinc-700/50 text-zinc-400"
}

function ticketPriorityLabel(p: string) {
  return { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente" }[p] ?? p
}

function ticketPriorityClass(p: string) {
  return {
    LOW: "bg-zinc-700/50 text-zinc-400",
    MEDIUM: "bg-blue-500/10 text-blue-400",
    HIGH: "bg-orange-500/10 text-orange-400",
    URGENT: "bg-red-500/10 text-red-400",
  }[p] ?? "bg-zinc-700/50 text-zinc-400"
}

// ─── Helpers assinatura ─────────────────────────────────────

function sigStatusLabel(s: string) {
  return { PENDING: "Pendente", SIGNED_DIGITAL: "Assinado Digital", SIGNED_PHYSICAL: "Assinado Físico" }[s] ?? s
}

function sigStatusClass(s: string) {
  return {
    PENDING: "bg-zinc-700/50 text-zinc-400",
    SIGNED_DIGITAL: "bg-blue-500/10 text-blue-400",
    SIGNED_PHYSICAL: "bg-green-500/10 text-green-400",
  }[s] ?? "bg-zinc-700/50 text-zinc-400"
}

// ─── Visualizar / Imprimir contrato ─────────────────────────

async function openContractDocument(c: Contract) {
  const baseUrl = runtimeConfig.public.apiUrl as string ?? "http://localhost:3333"
  const token = useCookie("access_token").value ?? ""
  const url = `${baseUrl}/platform/contracts/${c.id}/document`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
  if (!res.ok) { alert("Erro ao carregar documento."); return }
  const html = await res.text()
  const w = window.open("", "_blank", "width=900,height=720,scrollbars=yes")
  if (!w) { alert("Permita popups para este site e tente novamente."); return }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

// ─── Modal de assinatura ─────────────────────────────────────

const signModal = ref(false)
const signMode = ref<"digital" | "physical">("digital")
const signerName = ref("")
const signError = ref("")
const sigCanvas = ref<HTMLCanvasElement | null>(null)
const canvasDirty = ref(false)
let isDrawing = false
let signingContract = ref<Contract | null>(null)

function openSignModal(c: Contract) {
  signingContract.value = c
  signMode.value = "digital"
  signerName.value = ""
  signError.value = ""
  canvasDirty.value = false
  signModal.value = true
  nextTick(() => initCanvas())
}

function initCanvas() {
  const canvas = sigCanvas.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext("2d")!
  ctx.scale(dpr, dpr)
  ctx.strokeStyle = "#1a1a1a"
  ctx.lineWidth = 2
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
}

function getPos(e: MouseEvent) {
  const canvas = sigCanvas.value!
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function startDraw(e: MouseEvent) {
  isDrawing = true
  const ctx = sigCanvas.value!.getContext("2d")!
  const { x, y } = getPos(e)
  ctx.beginPath(); ctx.moveTo(x, y)
}

function draw(e: MouseEvent) {
  if (!isDrawing) return
  const ctx = sigCanvas.value!.getContext("2d")!
  const { x, y } = getPos(e)
  ctx.lineTo(x, y); ctx.stroke()
  canvasDirty.value = true
}

function stopDraw() { isDrawing = false }

function startDrawTouch(e: TouchEvent) {
  const touch = e.touches[0]
  const canvas = sigCanvas.value!
  const rect = canvas.getBoundingClientRect()
  const ctx = canvas.getContext("2d")!
  ctx.beginPath(); ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top)
  isDrawing = true
}

function drawTouch(e: TouchEvent) {
  if (!isDrawing) return
  const touch = e.touches[0]
  const canvas = sigCanvas.value!
  const rect = canvas.getBoundingClientRect()
  const ctx = canvas.getContext("2d")!
  ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top); ctx.stroke()
  canvasDirty.value = true
}

function clearCanvas() {
  const canvas = sigCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  canvasDirty.value = false
}

async function confirmSign() {
  if (!signerName.value.trim() || !signingContract.value) return
  saving.value = true
  signError.value = ""
  try {
    const id = signingContract.value.id
    if (signMode.value === "digital") {
      const canvas = sigCanvas.value!
      const signatureData = canvas.toDataURL("image/png")
      await api(`/platform/contracts/${id}/sign-digital`, {
        method: "POST",
        body: { signerName: signerName.value.trim(), signatureData },
      })
    } else {
      await api(`/platform/contracts/${id}/sign-physical`, {
        method: "POST",
        body: { signerName: signerName.value.trim() },
      })
    }
    signModal.value = false
    await load()
  } catch (err: any) {
    signError.value = err?.data?.error ?? "Erro ao registrar assinatura."
  } finally {
    saving.value = false
  }
}

async function revokeSignature(c: Contract) {
  if (!confirm(`Revogar assinatura de "${c.plan}"? O contrato voltará para "Pendente".`)) return
  await api(`/platform/contracts/${c.id}/signature`, { method: "DELETE" })
  await load()
}

// ─── Contratos ──────────────────────────────────────────────

const contractModal = ref(false)
const editingContract = ref<Contract | null>(null)
const contractForm = reactive({ plan: "", status: "TRIAL", value: "", billingCycle: "MONTHLY", startDate: "", endDate: "", notes: "" })
const saving = ref(false)
const formError = ref("")

function openContractModal(c?: Contract) {
  editingContract.value = c ?? null
  formError.value = ""
  if (c) {
    contractForm.plan = c.plan
    contractForm.status = c.status
    contractForm.value = c.value != null ? String(c.value) : ""
    contractForm.billingCycle = c.billingCycle
    contractForm.startDate = c.startDate ? c.startDate.slice(0, 10) : ""
    contractForm.endDate = c.endDate ? c.endDate.slice(0, 10) : ""
    contractForm.notes = c.notes ?? ""
  } else {
    Object.assign(contractForm, { plan: "", status: "TRIAL", value: "", billingCycle: "MONTHLY", startDate: new Date().toISOString().slice(0, 10), endDate: "", notes: "" })
  }
  contractModal.value = true
}

async function saveContract() {
  saving.value = true
  formError.value = ""
  try {
    const payload: any = {
      plan: contractForm.plan,
      status: contractForm.status,
      billingCycle: contractForm.billingCycle,
      startDate: new Date(contractForm.startDate + "T00:00:00").toISOString(),
      notes: contractForm.notes || undefined,
    }
    if (contractForm.value) payload.value = Number(contractForm.value)
    if (contractForm.endDate) payload.endDate = new Date(contractForm.endDate + "T00:00:00").toISOString()

    if (editingContract.value) {
      await api(`/platform/contracts/${editingContract.value.id}`, { method: "PATCH", body: payload })
    } else {
      await api("/platform/contracts", { method: "POST", body: { ...payload, companyId } })
    }
    contractModal.value = false
    await load()
  } catch (err: any) {
    formError.value = err?.data?.error ?? "Erro ao salvar contrato."
  } finally {
    saving.value = false
  }
}

async function deleteContract(id: string) {
  if (!confirm("Excluir este contrato?")) return
  await api(`/platform/contracts/${id}`, { method: "DELETE" })
  await load()
}

// ─── Instalações ────────────────────────────────────────────

const installModal = ref(false)
const editingInstall = ref<Installation | null>(null)
const installForm = reactive({ name: "", location: "", version: "", status: "PENDING", notes: "" })

function openInstallModal(i?: Installation) {
  editingInstall.value = i ?? null
  formError.value = ""
  if (i) {
    installForm.name = i.name
    installForm.location = i.location ?? ""
    installForm.version = i.version ?? ""
    installForm.status = i.status
    installForm.notes = i.notes ?? ""
  } else {
    Object.assign(installForm, { name: "", location: "", version: "", status: "PENDING", notes: "" })
  }
  installModal.value = true
}

async function saveInstall() {
  saving.value = true
  formError.value = ""
  try {
    const payload: any = {
      name: installForm.name,
      status: installForm.status,
      location: installForm.location || undefined,
      version: installForm.version || undefined,
      notes: installForm.notes || undefined,
    }
    if (editingInstall.value) {
      await api(`/platform/installations/${editingInstall.value.id}`, { method: "PATCH", body: payload })
    } else {
      await api("/platform/installations", { method: "POST", body: { ...payload, companyId } })
    }
    installModal.value = false
    await load()
  } catch (err: any) {
    formError.value = err?.data?.error ?? "Erro ao salvar instalação."
  } finally {
    saving.value = false
  }
}

async function deleteInstall(id: string) {
  if (!confirm("Excluir esta instalação?")) return
  await api(`/platform/installations/${id}`, { method: "DELETE" })
  await load()
}

// ─── Tickets ────────────────────────────────────────────────

const ticketModal = ref(false)
const ticketForm = reactive({ title: "", description: "", type: "OTHER", priority: "MEDIUM" })

function openTicketModal() {
  formError.value = ""
  Object.assign(ticketForm, { title: "", description: "", type: "OTHER", priority: "MEDIUM" })
  ticketModal.value = true
}

async function saveTicket() {
  saving.value = true
  formError.value = ""
  try {
    await api("/platform/tickets", {
      method: "POST",
      body: { companyId, ...ticketForm },
    })
    ticketModal.value = false
    await load()
  } catch (err: any) {
    formError.value = err?.data?.error ?? "Erro ao abrir ticket."
  } finally {
    saving.value = false
  }
}

async function updateTicketStatus(id: string, status: string) {
  await api(`/platform/tickets/${id}`, { method: "PATCH", body: { status } })
  await load()
}

async function deleteTicket(id: string) {
  if (!confirm("Excluir este ticket?")) return
  await api(`/platform/tickets/${id}`, { method: "DELETE" })
  await load()
}

onMounted(load)
</script>
