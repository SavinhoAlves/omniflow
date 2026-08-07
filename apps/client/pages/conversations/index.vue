<template>
  <div class="flex h-full overflow-hidden">
    <!-- ============================================================
         Sidebar — lista
    ============================================================ -->
    <div class="w-72 shrink-0 flex flex-col border-r border-zinc-800/80 bg-zinc-900">
      <!-- Header -->
      <div class="border-b border-zinc-800/80">
        <div class="flex items-center justify-between px-4 pb-2.5 pt-4">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-white">Conversas</h2>
            <span
              v-if="openCount > 0"
              class="min-w-[18px] rounded-full bg-blue-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white tabular-nums"
            >
              {{ openCount }}
            </span>
          </div>
          <button
            class="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-500"
            @click="openNewConvModal"
          >
            <Plus :size="12" />
            Nova
          </button>
        </div>
        <div class="px-3 pb-3">
          <div class="relative">
            <Search :size="13" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              v-model="search"
              type="search"
              placeholder="Buscar..."
              class="w-full rounded-lg border border-zinc-800 bg-zinc-800/60 py-2 pl-8 pr-3 text-sm text-zinc-200 placeholder-zinc-600 transition focus:border-blue-500 focus:outline-none focus:bg-zinc-800"
            />
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 border-b border-zinc-800/80 px-3 py-2">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          class="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors"
          :class="activeTab === tab.value
            ? 'bg-zinc-800 text-white'
            : 'text-zinc-600 hover:text-zinc-400'"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Department filter -->
      <div v-if="allDepts.length > 0" class="border-b border-zinc-800/80 px-3 py-2">
        <div class="relative">
          <Layers :size="12" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <select
            v-model="filterDeptId"
            class="w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-800/60 py-1.5 pl-7 pr-6 text-[11px] text-zinc-400 outline-none transition focus:border-blue-500 focus:text-zinc-200"
          >
            <option value="">Todos os departamentos</option>
            <option v-for="dept in allDepts" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
          </select>
          <ChevronDown :size="11" class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600" />
        </div>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="listLoading && conversations.length === 0" class="space-y-px p-2">
          <div v-for="i in 5" :key="i" class="flex animate-pulse gap-3 rounded-xl p-3">
            <div class="h-10 w-10 shrink-0 rounded-full bg-zinc-800" />
            <div class="flex-1 space-y-2 pt-1">
              <div class="h-3 w-3/4 rounded-md bg-zinc-800" />
              <div class="h-2.5 w-1/2 rounded-md bg-zinc-800" />
            </div>
          </div>
        </div>

        <div v-else-if="conversations.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
          <p class="text-sm text-zinc-600">Nenhuma conversa</p>
          <button
            class="mt-3 flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
            @click="openNewConvModal"
          >
            <Plus :size="12" />
            Iniciar conversa
          </button>
        </div>

        <div v-else class="p-2 space-y-px">
          <button
            v-for="conv in conversations"
            :key="conv.id"
            class="relative w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all"
            :class="[
              activeConversationId === conv.id
                ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/20'
                : 'hover:bg-zinc-800/50',
              conv.status === 'RESOLVED' && activeConversationId !== conv.id ? 'opacity-40' : '',
            ]"
            @click="selectConversation(conv.id)"
          >
            <div
              class="relative h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
              :style="{ background: avatarGradient(conv.contact.name ?? conv.contact.phoneNumber) }"
            >
              {{ initials(conv.contact.name ?? conv.contact.phoneNumber) }}
              <span
                v-if="conv.status === 'OPEN'"
                class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-emerald-400"
              />
            </div>
            <div class="flex-1 min-w-0 pt-0.5">
              <div class="flex items-baseline justify-between gap-1">
                <p
                  class="text-sm font-semibold truncate leading-none"
                  :class="activeConversationId === conv.id ? 'text-white' : 'text-zinc-200'"
                >
                  {{ conv.contact.name || conv.contact.phoneNumber }}
                </p>
                <span class="shrink-0 text-[10px] text-zinc-600">{{ formatTime(conv.lastMessageAt) }}</span>
              </div>
              <div class="mt-1 flex items-center gap-1">
                <CheckCheck
                  v-if="conv.messages?.[0]?.direction === 'OUTBOUND' && conv.status === 'OPEN'"
                  :size="11"
                  class="shrink-0 text-blue-400"
                />
                <p class="truncate text-[11px] leading-none text-zinc-500">
                  {{ conv.messages?.[0]?.content || 'Nova conversa' }}
                </p>
              </div>
              <div v-if="conv.department" class="mt-1.5">
                <span class="inline-block rounded-md bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                  {{ conv.department.name }}
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================================
         Chat
    ============================================================ -->
    <div v-if="activeConversation" class="flex flex-1 flex-col min-w-0">
      <!-- Header -->
      <div class="h-[58px] shrink-0 flex items-center gap-3 px-5 border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm">
        <div
          class="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ring-1 ring-white/10"
          :style="{ background: avatarGradient(activeConversation.contact.name ?? activeConversation.contact.phoneNumber) }"
        >
          {{ initials(activeConversation.contact.name ?? activeConversation.contact.phoneNumber) }}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-semibold text-white truncate">
              {{ activeConversation.contact.name || activeConversation.contact.phoneNumber }}
            </p>
            <span
              class="shrink-0 h-1.5 w-1.5 rounded-full"
              :class="activeConversation.status === 'OPEN' ? 'bg-emerald-400' : 'bg-zinc-600'"
            />
          </div>
          <p class="text-[11px] text-zinc-500 truncate leading-none mt-0.5">
            {{ activeConversation.contact.phoneNumber }}
            <span v-if="activeConversation.department" class="text-zinc-700"> · {{ activeConversation.department.name }}</span>
            <span v-if="activeConversation.assignedTo" class="text-zinc-600"> · {{ activeConversation.assignedTo.name }}</span>
          </p>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            v-if="activeConversation.status === 'OPEN'"
            class="flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-600/20 disabled:opacity-50"
            :disabled="statusChanging"
            @click="changeStatus('RESOLVED')"
          >
            <CheckCircle :size="12" />
            Resolver
          </button>
          <button
            v-else
            class="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-300 disabled:opacity-50"
            :disabled="statusChanging"
            @click="changeStatus('OPEN')"
          >
            <RotateCcw :size="12" />
            Reabrir
          </button>
          <button
            class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-400"
            :class="showInfoPanel ? 'bg-zinc-800 text-zinc-400' : ''"
            @click="showInfoPanel = !showInfoPanel"
          >
            <PanelRight :size="15" />
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesContainerRef" class="flex-1 overflow-y-auto px-6 py-5 space-y-1 bg-[#0d1117]">
        <template v-for="(msg, i) in messages" :key="msg.id">
          <div v-if="showDateSeparator(msg, messages[i - 1])" class="flex items-center gap-3 py-3 my-1">
            <div class="h-px flex-1 bg-zinc-800/60" />
            <span class="text-[10px] font-medium text-zinc-700 tracking-wide">{{ formatDate(msg.createdAt) }}</span>
            <div class="h-px flex-1 bg-zinc-800/60" />
          </div>

          <!-- System event -->
          <div v-if="msg.type === 'SYSTEM'" class="flex justify-center py-0.5">
            <span class="text-[10px] text-zinc-700">{{ msg.content }}</span>
          </div>

          <!-- Inbound -->
          <div v-else-if="msg.direction === 'INBOUND'" class="flex justify-start">
            <div class="max-w-[68%] min-w-0 rounded-2xl rounded-bl-md bg-zinc-800/80 px-4 py-2.5">
              <p class="text-sm text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
              <p class="mt-1 text-right text-[10px] text-zinc-600">{{ formatMessageTime(msg.createdAt) }}</p>
            </div>
          </div>

          <!-- Outbound -->
          <div v-else class="flex justify-end">
            <div class="max-w-[68%] min-w-0 rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5">
              <p class="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
              <div class="mt-1 flex items-center justify-end gap-1">
                <p class="text-[10px] text-blue-300">{{ formatMessageTime(msg.createdAt) }}</p>
                <CheckCheck :size="10" class="shrink-0 text-blue-300" />
              </div>
            </div>
          </div>
        </template>
        <div ref="scrollAnchorRef" />
      </div>

      <!-- Input -->
      <div class="shrink-0 border-t border-zinc-800/80 bg-zinc-900 px-5 py-3.5">
        <div v-if="activeConversation.status === 'RESOLVED'" class="flex items-center justify-center gap-2 py-1.5 text-xs text-zinc-600">
          Conversa encerrada —
          <button class="text-blue-500 transition hover:text-blue-400" @click="changeStatus('OPEN')">Reabrir</button>
        </div>
        <div v-else class="flex items-end gap-3">
          <textarea
            v-model="inputText"
            rows="1"
            placeholder="Mensagem…"
            class="flex-1 min-h-[38px] max-h-32 resize-none overflow-y-auto rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-blue-500/50 focus:outline-none focus:bg-zinc-800"
            @keydown.enter.exact.prevent="sendMessage"
            @input="autoResize"
          />
          <button
            class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-blue-600 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!inputText.trim() || sending"
            @click="sendMessage"
          >
            <Send :size="15" class="text-white" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-1 flex-col items-center justify-center gap-4 bg-[#0d1117]">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-900">
        <MessageSquare :size="24" class="text-zinc-700" />
      </div>
      <div class="space-y-1 text-center">
        <p class="text-sm font-medium text-zinc-500">Nenhuma conversa selecionada</p>
        <p class="text-xs text-zinc-700">Selecione uma conversa ou inicie uma nova</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        @click="openNewConvModal"
      >
        <Plus :size="14" />
        Nova conversa
      </button>
    </div>

    <!-- ============================================================
         Info panel
    ============================================================ -->
    <div
      v-if="activeConversation && showInfoPanel"
      class="w-[232px] shrink-0 flex flex-col border-l border-zinc-800/80 bg-zinc-950"
    >
      <!-- Contact card -->
      <div class="flex flex-col items-center px-5 pb-5 pt-7 text-center">
        <div class="relative mb-3.5">
          <div
            class="flex h-[52px] w-[52px] items-center justify-center rounded-full text-base font-bold ring-[3px] ring-zinc-800/80"
            :style="{ background: avatarGradient(activeConversation.contact.name ?? activeConversation.contact.phoneNumber) }"
          >
            {{ initials(activeConversation.contact.name ?? activeConversation.contact.phoneNumber) }}
          </div>
          <span
            class="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950"
            :class="activeConversation.status === 'OPEN' ? 'bg-emerald-400' : 'bg-zinc-600'"
          />
        </div>
        <p class="text-sm font-semibold text-white leading-snug">
          {{ activeConversation.contact.name || activeConversation.contact.phoneNumber }}
        </p>
        <p class="mt-0.5 text-[11px] text-zinc-600">
          {{ activeConversation.contact.phoneNumber }}
        </p>
        <span
          class="mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium"
          :class="activeConversation.status === 'OPEN'
            ? 'border-emerald-600/20 bg-emerald-500/10 text-emerald-400'
            : 'border-zinc-700/60 bg-zinc-800/40 text-zinc-500'"
        >
          {{ activeConversation.status === 'OPEN' ? 'Em atendimento' : 'Resolvida' }}
        </span>
      </div>

      <div class="mx-4 h-px bg-zinc-800/60" />

      <!-- Assignment -->
      <div class="px-4 py-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Responsável</span>
          <button
            class="text-[10px] font-medium text-zinc-700 transition hover:text-blue-400"
            @click="openTransfer"
          >
            Alterar
          </button>
        </div>

        <!-- Agent -->
        <div class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-zinc-900">
          <div
            v-if="activeConversation.assignedTo"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-300"
          >
            {{ activeConversation.assignedTo.name[0].toUpperCase() }}
          </div>
          <div v-else class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800">
            <User :size="11" class="text-zinc-600" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-[11px] font-medium text-zinc-300">
              {{ activeConversation.assignedTo?.name || 'Não atribuído' }}
            </p>
            <p class="text-[9px] text-zinc-700">Atendente</p>
          </div>
        </div>

        <!-- Department -->
        <div class="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-zinc-900">
          <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-800/80">
            <Layers :size="11" class="text-zinc-600" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-[11px] font-medium text-zinc-300">
              {{ activeConversation.department?.name || 'Sem departamento' }}
            </p>
            <p class="text-[9px] text-zinc-700">Departamento</p>
          </div>
        </div>

        <button
          class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 py-2 text-[11px] font-medium text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
          @click="openTransfer"
        >
          <ArrowRightLeft :size="11" />
          Transferir conversa
        </button>
      </div>

      <div class="mx-4 h-px bg-zinc-800/60" />

      <!-- Channel -->
      <div class="px-4 py-4">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Canal</span>
        <div class="mt-2.5 flex items-center gap-2.5">
          <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <MessageSquare :size="13" class="text-emerald-400" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-[11px] font-medium text-zinc-300">{{ activeConversation.instance?.name || 'WhatsApp' }}</p>
            <p class="text-[9px] text-zinc-700">{{ providerLabel[activeConversation.instance?.providerType] ?? 'Canal' }}</p>
          </div>
        </div>
      </div>

      <div class="flex-1" />

      <!-- Actions -->
      <div class="border-t border-zinc-800/80 p-4">
        <button
          v-if="activeConversation.status === 'OPEN'"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          :disabled="statusChanging"
          @click="changeStatus('RESOLVED')"
        >
          <CheckCircle :size="13" />
          Resolver conversa
        </button>
        <button
          v-else
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-800/60 py-2.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          :disabled="statusChanging"
          @click="changeStatus('OPEN')"
        >
          <RotateCcw :size="13" />
          Reabrir conversa
        </button>
      </div>
    </div>

    <!-- ============================================================
         Modal: Nova conversa (outbound)
    ============================================================ -->
    <Teleport to="body">
      <div
        v-if="showNewConvModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        @click.self="showNewConvModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900 p-6 shadow-2xl">
          <div class="mb-5 flex items-start justify-between">
            <div>
              <h2 class="text-base font-semibold text-white">Nova conversa</h2>
              <p class="mt-0.5 text-xs text-zinc-500">Inicie uma conversa — a mensagem será entregue pelo canal escolhido.</p>
            </div>
            <button class="mt-0.5 text-zinc-600 transition hover:text-zinc-300" @click="showNewConvModal = false">
              <X :size="18" />
            </button>
          </div>

          <div class="space-y-4">
            <!-- Número / ID do contato -->
            <div>
              <label class="text-xs font-medium text-zinc-400">Número do contato</label>
              <input
                v-model="newConvForm.contactPhone"
                type="text"
                placeholder="+5521999999999"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
              />
              <p class="mt-1 text-[11px] text-zinc-600">WhatsApp: inclua o código do país (+55…). Messenger/Instagram: use o PSID/IGSID do contato.</p>
            </div>

            <!-- Canal (instância conectada) -->
            <div>
              <label class="text-xs font-medium text-zinc-400">Canal</label>
              <select
                v-model="newConvForm.instanceId"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="" disabled>Selecione um canal...</option>
                <option v-for="inst in connectedInstances" :key="inst.id" :value="inst.id">
                  {{ inst.name }} · {{ providerLabel[inst.providerType] ?? inst.providerType }}
                </option>
              </select>
              <p v-if="connectedInstances.length === 0" class="mt-1 text-[11px] text-yellow-500">
                Nenhum canal conectado. Conecte um canal em <NuxtLink to="/whatsapp" class="underline">Canais</NuxtLink>.
              </p>
            </div>

            <!-- Departamento -->
            <div>
              <label class="text-xs font-medium text-zinc-400">Departamento <span class="text-zinc-600">(opcional)</span></label>
              <select
                v-model="newConvForm.departmentId"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="">Sem departamento</option>
                <option v-for="dept in allDepts" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
              </select>
            </div>

            <!-- Atendente -->
            <div>
              <label class="text-xs font-medium text-zinc-400">Atendente <span class="text-zinc-600">(opcional)</span></label>
              <select
                v-model="newConvForm.assignedToId"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="">Não atribuído</option>
                <option v-for="user in transferUsers" :key="user.id" :value="user.id">{{ user.name }}</option>
              </select>
            </div>

            <!-- Mensagem inicial -->
            <div>
              <label class="text-xs font-medium text-zinc-400">Mensagem inicial</label>
              <textarea
                v-model="newConvForm.message"
                rows="3"
                placeholder="Olá! Como posso ajudar?"
                class="mt-1.5 w-full resize-none rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
              />
            </div>

            <p v-if="newConvError" class="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {{ newConvError }}
            </p>

            <button
              :disabled="startingConv || !newConvForm.contactPhone.trim() || !newConvForm.instanceId || !newConvForm.message.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              @click="doStartConversation"
            >
              <LoaderCircle v-if="startingConv" :size="15" class="animate-spin" />
              <Send v-else :size="14" />
              {{ startingConv ? 'Enviando…' : 'Iniciar conversa' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ============================================================
         Modal: Transferir conversa
    ============================================================ -->
    <Teleport to="body">
      <div
        v-if="showTransferModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        @click.self="showTransferModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl border border-zinc-800/80 bg-zinc-900 p-6 shadow-2xl">
          <div class="mb-5 flex items-start justify-between">
            <div>
              <h2 class="text-base font-semibold text-white">Transferir conversa</h2>
              <p class="mt-0.5 text-xs text-zinc-500">Altere o departamento e/ou o atendente responsável.</p>
            </div>
            <button class="mt-0.5 text-zinc-600 transition hover:text-zinc-300" @click="showTransferModal = false">
              <X :size="18" />
            </button>
          </div>

          <div class="space-y-4">
            <!-- Departamento primeiro — filtra atendentes -->
            <div>
              <label class="text-xs font-medium text-zinc-400">Departamento</label>
              <select
                v-model="transferForm.departmentId"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="">Sem departamento</option>
                <option v-for="dept in allDepts" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
              </select>
            </div>

            <div>
              <label class="text-xs font-medium text-zinc-400">
                Atendente
                <span v-if="transferForm.departmentId" class="ml-1 text-zinc-600">(do departamento)</span>
              </label>
              <select
                v-model="transferForm.assignedToId"
                class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="">Sem atribuição</option>
                <option
                  v-for="user in filteredTransferUsers"
                  :key="user.id"
                  :value="user.id"
                >
                  {{ user.name }}
                </option>
              </select>
            </div>

            <p v-if="transferError" class="text-xs text-red-400">{{ transferError }}</p>

            <button
              :disabled="transferring"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              @click="confirmTransfer"
            >
              <LoaderCircle v-if="transferring" :size="15" class="animate-spin" />
              Confirmar transferência
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed, reactive } from "vue"
import {
  Search, CheckCheck, CheckCircle, RotateCcw, Send, MessageSquare,
  ArrowRightLeft, PanelRight, X, LoaderCircle, User, Layers,
  Plus, ChevronDown,
} from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ layout: "chat", middleware: "auth" })

// ── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name?: string | null
  phoneNumber: string
  avatarUrl?: string | null
}

interface ConvSummary {
  id: string
  status: "OPEN" | "RESOLVED"
  lastMessageAt?: string | null
  contact: Contact
  assignedTo?: { id: string; name: string } | null
  department?: { id: string; name: string } | null
  messages?: { content?: string | null; direction: string; type: string; createdAt: string }[]
}

interface FullConversation extends ConvSummary {
  instance: { id: string; name: string; providerType: string; phoneNumber?: string }
}

interface Message {
  id: string
  conversationId: string
  direction: "INBOUND" | "OUTBOUND"
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "SYSTEM"
  content?: string | null
  createdAt: string
  author?: { id: string; name: string } | null
}

interface ChannelInstance {
  id: string
  name: string
  providerType: string
  connectionStatus: string
  phoneNumber?: string | null
}

// ── State ────────────────────────────────────────────────────────────────────

const api = useApi()

const search = ref("")
const filterDeptId = ref("")
const activeTab = ref<"ALL" | "MINE" | "RESOLVED">("ALL")
const conversations = ref<ConvSummary[]>([])
const listLoading = ref(true)
const activeConversationId = ref<string | null>(null)
const activeConversation = ref<FullConversation | null>(null)
const messages = ref<Message[]>([])
const inputText = ref("")
const sending = ref(false)
const statusChanging = ref(false)
const showInfoPanel = ref(true)
const messagesContainerRef = ref<HTMLElement | null>(null)
const scrollAnchorRef = ref<HTMLElement | null>(null)

// Transfer
const showTransferModal = ref(false)
const transferring = ref(false)
const transferError = ref("")
const transferUsers = ref<{ id: string; name: string; departmentIds?: string[] }[]>([])
const allDepts = ref<{ id: string; name: string }[]>([])
const transferForm = reactive({ assignedToId: "", departmentId: "" })

// Nova conversa
const showNewConvModal = ref(false)
const startingConv = ref(false)
const newConvError = ref("")
const newConvForm = reactive({
  contactPhone: "",
  instanceId: "",
  departmentId: "",
  assignedToId: "",
  message: "",
})
const instances = ref<ChannelInstance[]>([])
const connectedInstances = computed(() =>
  instances.value.filter((i) => i.connectionStatus === "CONNECTED")
)

const TABS = [
  { label: "Todas", value: "ALL" as const },
  { label: "Minhas", value: "MINE" as const },
  { label: "Resolvidas", value: "RESOLVED" as const },
]

// ── Provider labels ───────────────────────────────────────────────────────────

const providerLabel: Record<string, string> = {
  BAILEYS:            "WhatsApp QR",
  META_CLOUD_API:     "WhatsApp API",
  EVOLUTION_API:      "Evolution",
  FACEBOOK_MESSENGER: "Messenger",
  INSTAGRAM:          "Instagram",
}

// ── Computed ─────────────────────────────────────────────────────────────────

const openCount = computed(() => conversations.value.filter((c) => c.status === "OPEN").length)

// Filtra atendentes pelo departamento selecionado no modal de transferência
const filteredTransferUsers = computed(() => {
  if (!transferForm.departmentId) return transferUsers.value
  return transferUsers.value.filter(
    (u) => !u.departmentIds?.length || u.departmentIds.includes(transferForm.departmentId)
  )
})

// ── Search debounce ───────────────────────────────────────────────────────────

const debouncedSearch = ref("")
let searchTimer: ReturnType<typeof setTimeout>
watch(search, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = val }, 300)
})

// ── Polling ───────────────────────────────────────────────────────────────────

let listInterval: ReturnType<typeof setInterval> | null = null
let messagesInterval: ReturnType<typeof setInterval> | null = null

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #10b981, #3b82f6)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
]

function avatarGradient(name: string) {
  const idx = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function formatTime(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 1) return "Ontem"
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" })
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return "Hoje"
  if (diffDays === 1) return "Ontem"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}

function showDateSeparator(msg: Message, prev?: Message) {
  if (!prev) return true
  return new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString()
}

// ── Load data ─────────────────────────────────────────────────────────────────

let currentLoadId = 0

async function loadConversations() {
  const loadId = ++currentLoadId
  try {
    const params = new URLSearchParams()
    if (activeTab.value === "MINE") params.set("mine", "true")
    params.set("status", activeTab.value === "RESOLVED" ? "RESOLVED" : "OPEN")
    if (debouncedSearch.value) params.set("search", debouncedSearch.value)
    if (filterDeptId.value) params.set("departmentId", filterDeptId.value)

    const result = await api<ConvSummary[]>(`/conversations?${params}`)
    if (loadId === currentLoadId) conversations.value = result
  } catch {
    // polling silent
  } finally {
    if (loadId === currentLoadId) listLoading.value = false
  }
}

async function loadSidebarData() {
  const [usersRes, deptsRes, instancesRes] = await Promise.allSettled([
    api<{ id: string; name: string; email: string }[]>("/users"),
    api<{ id: string; name: string }[]>("/departments"),
    api<ChannelInstance[]>("/whatsapp/instances"),
  ])
  transferUsers.value = usersRes.status === "fulfilled" ? usersRes.value : []
  allDepts.value = deptsRes.status === "fulfilled" ? deptsRes.value : []
  instances.value = instancesRes.status === "fulfilled" ? instancesRes.value : []
}

// ── Conversation select ───────────────────────────────────────────────────────

async function selectConversation(id: string) {
  if (activeConversationId.value === id) return
  activeConversationId.value = id
  messages.value = []
  clearInterval(messagesInterval!)

  try {
    activeConversation.value = await api<FullConversation>(`/conversations/${id}`)
    messages.value = activeConversation.value.messages as unknown as Message[]
    scrollToBottom()
  } catch {
    activeConversation.value = null
  }

  messagesInterval = setInterval(pollMessages, 3000)
}

async function pollMessages() {
  if (!activeConversationId.value) return
  try {
    const fresh = await api<Message[]>(`/conversations/${activeConversationId.value}/messages`)
    if (fresh.length !== messages.value.length) {
      messages.value = fresh
      scrollToBottom()
    }
  } catch {}
}

function scrollToBottom(smooth = true) {
  nextTick(() => scrollAnchorRef.value?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" }))
}

// ── Send ──────────────────────────────────────────────────────────────────────

async function sendMessage() {
  const content = inputText.value.trim()
  if (!content || sending.value || !activeConversationId.value) return
  sending.value = true
  inputText.value = ""

  const optimistic: Message = {
    id: `opt-${Date.now()}`,
    conversationId: activeConversationId.value,
    direction: "OUTBOUND",
    type: "TEXT",
    content,
    createdAt: new Date().toISOString(),
  }
  messages.value.push(optimistic)
  scrollToBottom()

  try {
    const created = await api<Message>(`/conversations/${activeConversationId.value}/messages`, {
      method: "POST",
      body: { content },
    })
    const idx = messages.value.findIndex((m) => m.id === optimistic.id)
    if (idx !== -1) messages.value.splice(idx, 1, created)
    await loadConversations()
  } catch {
    messages.value = messages.value.filter((m) => m.id !== optimistic.id)
    inputText.value = content
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

async function changeStatus(status: "OPEN" | "RESOLVED") {
  if (!activeConversationId.value) return
  statusChanging.value = true
  try {
    await api(`/conversations/${activeConversationId.value}/status`, {
      method: "PATCH",
      body: { status },
    })
    if (activeConversation.value) activeConversation.value.status = status
    await Promise.all([loadConversations(), pollMessages()])
  } catch {
  } finally {
    statusChanging.value = false
  }
}

// ── Transfer ──────────────────────────────────────────────────────────────────

function openTransfer() {
  transferForm.assignedToId = activeConversation.value?.assignedTo?.id ?? ""
  transferForm.departmentId = activeConversation.value?.department?.id ?? ""
  transferError.value = ""
  showTransferModal.value = true
}

async function confirmTransfer() {
  if (!activeConversationId.value) return
  transferring.value = true
  transferError.value = ""
  try {
    await api(`/conversations/${activeConversationId.value}/assign`, {
      method: "PATCH",
      body: {
        assignedToId: transferForm.assignedToId || null,
        departmentId: transferForm.departmentId || null,
      },
    })
    activeConversation.value = await api<FullConversation>(`/conversations/${activeConversationId.value}`)
    messages.value = activeConversation.value.messages as unknown as Message[]
    showTransferModal.value = false
    await loadConversations()
  } catch (err: any) {
    transferError.value = err?.data?.error ?? err?.data?.message ?? "Não foi possível transferir."
  } finally {
    transferring.value = false
  }
}

// ── Nova conversa outbound ────────────────────────────────────────────────────

function openNewConvModal() {
  newConvForm.contactPhone = ""
  newConvForm.instanceId = connectedInstances.value[0]?.id ?? ""
  newConvForm.departmentId = ""
  newConvForm.assignedToId = ""
  newConvForm.message = ""
  newConvError.value = ""
  showNewConvModal.value = true
}

async function doStartConversation() {
  if (!newConvForm.contactPhone.trim() || !newConvForm.instanceId || !newConvForm.message.trim()) return
  startingConv.value = true
  newConvError.value = ""
  try {
    const conversation = await api<{ id: string }>("/conversations/start", {
      method: "POST",
      body: {
        contactPhone: newConvForm.contactPhone.trim(),
        instanceId: newConvForm.instanceId,
        departmentId: newConvForm.departmentId || null,
        assignedToId: newConvForm.assignedToId || null,
        message: newConvForm.message.trim(),
      },
    })
    showNewConvModal.value = false
    await loadConversations()
    await selectConversation(conversation.id)
  } catch (err: any) {
    newConvError.value = err?.data?.message ?? "Não foi possível iniciar a conversa."
  } finally {
    startingConv.value = false
  }
}

// ── Textarea resize ───────────────────────────────────────────────────────────

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = "auto"
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`
}

// ── Watchers & lifecycle ──────────────────────────────────────────────────────

watch(activeTab, () => {
  conversations.value = []
  listLoading.value = true
  loadConversations()
})

watch(debouncedSearch, () => {
  listLoading.value = true
  loadConversations()
})

watch(filterDeptId, () => {
  listLoading.value = true
  loadConversations()
})

onMounted(() => {
  loadConversations()
  loadSidebarData()
  listInterval = setInterval(loadConversations, 5000)
})

onUnmounted(() => {
  clearInterval(listInterval!)
  clearInterval(messagesInterval!)
})
</script>
