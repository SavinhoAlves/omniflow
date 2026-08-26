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
              v-if="leadCount > 0"
              class="min-w-[18px] rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white tabular-nums"
            >
              {{ leadCount }}
            </span>
            <span
              v-else-if="openCount > 0"
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
            <option value="">Todos departamentos</option>
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
          <div
            v-for="conv in conversations"
            :key="conv.id"
            class="relative group"
          >
            <!-- Dropdown trigger -->
            <div
              role="button"
              class="absolute right-2 inset-y-0 my-auto z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 transition-all"
              @click.stop="toggleConvMenu(conv.id)"
            >
              <ChevronDown :size="14" />
            </div>

            <!-- Dropdown menu -->
            <div
              v-if="convMenuOpen === conv.id"
              class="absolute right-2 top-8 z-20 min-w-[160px] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
              @click.stop
            >
              <button
                v-if="conv.status === 'LEAD'"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-amber-300 hover:bg-zinc-800"
                @click="selectConversation(conv.id); convMenuOpen = null; beginConversation()"
              >
                <Play :size="13" class="text-amber-400" />
                Iniciar Atendimento
              </button>
              <button
                v-if="conv.status === 'OPEN'"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                @click="quickFinish(conv); convMenuOpen = null"
              >
                <CheckCircle :size="13" class="text-emerald-400" />
                Finalizar Atendimento
              </button>
              <button
                class="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-zinc-800"
                @click="deleteConv(conv); convMenuOpen = null"
              >
                <Trash2 :size="13" />
                Apagar conversa
              </button>
            </div>

            <button
              class="relative w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all"
              :class="[
                activeConversationId === conv.id
                  ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/20'
                  : 'hover:bg-zinc-800/50',
                conv.status === 'RESOLVED' && activeConversationId !== conv.id ? 'opacity-40' : '',
              ]"
              @click="selectConversation(conv.id)"
            >
              <!-- Priority strip on left edge -->
              <div
                v-if="conv.priority && conv.priority !== 'MEDIUM'"
                class="absolute left-0 inset-y-1 w-0.5 rounded-r-full"
                :class="priorityStripClass[conv.priority]"
              />

              <div
                class="relative h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                :style="{ background: avatarGradient(conv.contact.name ?? conv.contact.phoneNumber) }"
              >
                {{ initials(conv.contact.name ?? conv.contact.phoneNumber) }}
                <span
                  v-if="conv.status === 'LEAD'"
                  class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-amber-400"
                />
                <span
                  v-else-if="conv.status === 'OPEN'"
                  class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-emerald-400"
                />
              </div>
              <div class="flex-1 min-w-0 pt-0.5">
                <div class="flex items-baseline justify-between gap-1">
                  <p
                    class="text-sm truncate leading-none"
                    :class="[
                      activeConversationId === conv.id ? 'text-white' : 'text-zinc-200',
                      (conv.unreadCount ?? 0) > 0 ? 'font-bold' : 'font-semibold',
                    ]"
                  >
                    {{ conv.contact.name || conv.contact.phoneNumber }}
                  </p>
                  <div class="flex items-center gap-1 shrink-0">
                    <!-- Unread badge -->
                    <span
                      v-if="(conv.unreadCount ?? 0) > 0"
                      class="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white"
                    >
                      {{ conv.unreadCount }}
                    </span>
                    <span class="text-[10px] text-zinc-600">{{ formatTime(conv.lastMessageAt) }}</span>
                  </div>
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
                <div class="mt-1.5 flex flex-wrap items-center gap-1">
                  <span v-if="conv.department" class="inline-block rounded-md bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                    {{ conv.department.name }}
                  </span>
                  <!-- SLA breached badge -->
                  <span
                    v-if="conv.slaBreachedAt"
                    class="inline-flex items-center gap-0.5 rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-red-400"
                    title="SLA vencido"
                  >
                    <AlertTriangle :size="8" />
                    SLA
                  </span>
                  <!-- Priority badge (not MEDIUM) -->
                  <span
                    v-if="conv.priority && conv.priority !== 'MEDIUM'"
                    class="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                    :class="priorityBadgeClass[conv.priority]"
                  >
                    <Flag :size="8" />
                    {{ priorityLabel[conv.priority] }}
                  </span>
                  <!-- Tags (first 2) -->
                  <span
                    v-for="tag in (conv.tags ?? []).slice(0, 2)"
                    :key="tag"
                    class="inline-block rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-400"
                  >
                    {{ tag }}
                  </span>
                  <span v-if="(conv.tags ?? []).length > 2" class="text-[9px] text-zinc-600">
                    +{{ (conv.tags ?? []).length - 2 }}
                  </span>
                </div>
              </div>
            </button>
          </div>
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
              :class="activeConversation.status === 'OPEN' ? 'bg-emerald-400' : activeConversation.status === 'LEAD' ? 'bg-amber-400' : 'bg-zinc-600'"
            />
          </div>
          <p class="text-[11px] text-zinc-500 truncate leading-none mt-0.5">
            {{ activeConversation.contact.phoneNumber }}
            <span v-if="activeConversation.department" class="text-zinc-700"> · {{ activeConversation.department.name }}</span>
            <span v-if="activeConversation.assignedTo" class="text-zinc-600"> · {{ activeConversation.assignedTo.name }}</span>
          </p>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Priority selector -->
          <div class="relative" @click.stop>
            <button
              class="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition"
              :class="priorityHeaderClass[activeConversation.priority || 'MEDIUM']"
              @click="showPriorityMenu = !showPriorityMenu"
            >
              <Flag :size="10" />
              {{ priorityLabel[activeConversation.priority || 'MEDIUM'] }}
              <ChevronDown :size="9" />
            </button>
            <div
              v-if="showPriorityMenu"
              class="absolute right-0 top-full mt-1 z-30 min-w-[120px] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
            >
              <button
                v-for="p in PRIORITIES"
                :key="p.value"
                class="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-medium hover:bg-zinc-800 transition"
                :class="p.textClass"
                @click="setPriority(p.value); showPriorityMenu = false"
              >
                <Flag :size="10" />
                {{ p.label }}
              </button>
            </div>
          </div>

          <button
            v-if="activeConversation.status === 'OPEN'"
            class="flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-600/20 disabled:opacity-50"
            :disabled="statusChanging"
            @click="changeStatus('RESOLVED')"
          >
            <CheckCircle :size="12" />
            Finalizar
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

          <!-- Internal note -->
          <div v-else-if="msg.isInternal" class="flex justify-center py-0.5">
            <div class="w-full max-w-[72%] rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
              <div class="mb-1 flex items-center gap-1.5">
                <StickyNote :size="10" class="text-amber-400" />
                <span class="text-[9px] font-semibold uppercase tracking-wider text-amber-500">Nota interna</span>
                <span v-if="msg.author" class="text-[9px] text-amber-700/80">· {{ msg.author.name }}</span>
              </div>
              <p class="text-sm text-amber-200/90 whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
              <p class="mt-1 text-right text-[10px] text-amber-700/60">{{ formatMessageTime(msg.createdAt) }}</p>
            </div>
          </div>

          <!-- Inbound -->
          <div v-else-if="msg.direction === 'INBOUND'" class="flex justify-start">
            <div class="max-w-[68%] min-w-0 rounded-2xl rounded-bl-md bg-zinc-800/80 px-4 py-2.5">
              <template v-if="msg.type === 'IMAGE' && msg.mediaUrl">
                <img :src="msg.mediaUrl" class="max-w-full rounded-lg" loading="lazy" />
              </template>
              <template v-else-if="msg.type === 'AUDIO' && msg.mediaUrl">
                <audio :ref="(el) => registerAudio(msg.id, el as HTMLAudioElement | null)" :src="msg.mediaUrl" preload="metadata" class="hidden" />
                <div class="flex w-64 flex-col gap-1 py-0.5">
                  <div class="flex items-center gap-2">
                    <button
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 transition hover:bg-zinc-600 active:scale-95"
                      @click="toggleAudio(msg.id)"
                    >
                      <Pause v-if="getAudioState(msg.id).playing" :size="13" class="text-white" />
                      <Play v-else :size="13" class="translate-x-px text-white" />
                    </button>
                    <div
                      class="relative h-1.5 flex-1 cursor-pointer rounded-full bg-zinc-700"
                      @click="seekAudio(msg.id, $event)"
                    >
                      <div
                        class="h-full rounded-full bg-emerald-500 transition-all duration-100"
                        :style="{ width: `${audioProgress(msg.id)}%` }"
                      />
                      <div
                        class="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow"
                        :style="{ left: `calc(${audioProgress(msg.id)}% - 6px)` }"
                      />
                    </div>
                    <button
                      class="shrink-0 rounded px-1 py-0.5 text-[10px] font-bold tabular-nums transition"
                      :class="getAudioState(msg.id).speed > 1
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'"
                      @click="cycleSpeed(msg.id)"
                    >{{ speedLabel(msg.id) }}</button>
                  </div>
                  <div class="flex justify-between pl-10 text-[9px] text-zinc-600 tabular-nums">
                    <span>{{ fmtAudioTime(getAudioState(msg.id).currentTime) }}</span>
                    <span>{{ fmtAudioTime(getAudioState(msg.id).duration) }}</span>
                  </div>
                </div>
              </template>
              <template v-else-if="msg.type === 'VIDEO' && msg.mediaUrl">
                <video :src="msg.mediaUrl" controls class="max-w-full rounded-lg" />
              </template>
              <template v-else-if="msg.mediaUrl">
                <a :href="msg.mediaUrl" target="_blank" class="flex items-center gap-2 text-sm text-blue-300 underline">
                  <Paperclip :size="13" />{{ msg.content || 'Arquivo' }}
                </a>
              </template>
              <template v-else>
                <p class="text-sm text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
              </template>
              <p class="mt-1 text-right text-[10px] text-zinc-600">{{ formatMessageTime(msg.createdAt) }}</p>
            </div>
          </div>

          <!-- Outbound -->
          <div v-else class="flex justify-end">
            <div class="max-w-[68%] min-w-0 rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5">
              <template v-if="msg.type === 'IMAGE' && msg.mediaUrl">
                <img :src="msg.mediaUrl" class="max-w-full rounded-lg" loading="lazy" />
              </template>
              <template v-else-if="msg.type === 'AUDIO' && msg.mediaUrl">
                <audio :ref="(el) => registerAudio(msg.id, el as HTMLAudioElement | null)" :src="msg.mediaUrl" preload="metadata" class="hidden" />
                <div class="flex w-64 flex-col gap-1 py-0.5">
                  <div class="flex items-center gap-2">
                    <button
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30 active:scale-95"
                      @click="toggleAudio(msg.id)"
                    >
                      <Pause v-if="getAudioState(msg.id).playing" :size="13" class="text-white" />
                      <Play v-else :size="13" class="translate-x-px text-white" />
                    </button>
                    <div
                      class="relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/25"
                      @click="seekAudio(msg.id, $event)"
                    >
                      <div
                        class="h-full rounded-full bg-white transition-all duration-100"
                        :style="{ width: `${audioProgress(msg.id)}%` }"
                      />
                      <div
                        class="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow"
                        :style="{ left: `calc(${audioProgress(msg.id)}% - 6px)` }"
                      />
                    </div>
                    <button
                      class="shrink-0 rounded px-1 py-0.5 text-[10px] font-bold tabular-nums transition"
                      :class="getAudioState(msg.id).speed > 1
                        ? 'bg-white/20 text-white'
                        : 'text-blue-200/70 hover:bg-white/10 hover:text-white'"
                      @click="cycleSpeed(msg.id)"
                    >{{ speedLabel(msg.id) }}</button>
                  </div>
                  <div class="flex justify-between pl-10 text-[9px] text-blue-200/70 tabular-nums">
                    <span>{{ fmtAudioTime(getAudioState(msg.id).currentTime) }}</span>
                    <span>{{ fmtAudioTime(getAudioState(msg.id).duration) }}</span>
                  </div>
                </div>
              </template>
              <template v-else-if="msg.type === 'VIDEO' && msg.mediaUrl">
                <video :src="msg.mediaUrl" controls class="max-w-full rounded-lg" />
              </template>
              <template v-else-if="msg.mediaUrl">
                <a :href="msg.mediaUrl" target="_blank" class="flex items-center gap-2 text-sm text-white/80 underline">
                  <Paperclip :size="13" />{{ msg.content || 'Arquivo' }}
                </a>
              </template>
              <template v-else>
                <p class="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
              </template>
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
        <div v-if="activeConversation.status === 'LEAD'" class="flex flex-col items-center gap-3 py-2">
          <p class="text-xs text-zinc-500">Este lead ainda não foi iniciado.</p>
          <button
            class="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
            :disabled="beginningConv"
            @click="beginConversation"
          >
            <LoaderCircle v-if="beginningConv" :size="14" class="animate-spin" />
            <Play v-else :size="14" />
            {{ beginningConv ? 'Iniciando…' : 'Iniciar Atendimento' }}
          </button>
        </div>
        <div v-else-if="activeConversation.status === 'RESOLVED'" class="flex items-center justify-center gap-2 py-1.5 text-xs text-zinc-600">
          Atendimento finalizado —
          <button class="text-blue-500 transition hover:text-blue-400" @click="changeStatus('OPEN')">Reabrir</button>
        </div>
        <div v-else class="space-y-2.5">
          <!-- Internal note mode banner -->
          <div
            v-if="isInternalNote"
            class="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-1.5"
          >
            <StickyNote :size="12" class="text-amber-400 shrink-0" />
            <p class="text-[11px] text-amber-400">Nota interna — visível apenas para agentes</p>
            <button class="ml-auto text-amber-600 hover:text-amber-400" @click="isInternalNote = false">
              <X :size="12" />
            </button>
          </div>

          <!-- Aviso: janela de 24h encerrada (Meta Cloud API) -->
          <div v-if="windowClosed && !isInternalNote" class="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5">
            <Clock :size="13" class="mt-0.5 shrink-0 text-amber-400" />
            <div class="min-w-0">
              <p class="text-xs font-semibold text-amber-300">Janela de 24 horas encerrada</p>
              <p class="mt-0.5 text-[11px] leading-relaxed text-amber-500/90">
                O WhatsApp Business só permite responder dentro de 24h após a última mensagem do contato.
                Aguarde o contato escrever ou utilize um template aprovado.
              </p>
            </div>
          </div>

          <!-- Erro de envio -->
          <div v-if="sendError" class="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-3.5 py-2">
            <p class="text-[11px] text-red-300">{{ sendError }}</p>
            <button class="ml-auto shrink-0 text-red-500 hover:text-red-300" @click="sendError = ''">
              <X :size="12" />
            </button>
          </div>

          <div class="flex items-end gap-2">
            <!-- File input (hidden) -->
            <input ref="fileInputRef" type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" class="hidden" @change="onFileSelected" />

            <!-- Attach button -->
            <button
              class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="(windowClosed && !isInternalNote) || uploadingMedia || isInternalNote"
              title="Enviar arquivo"
              @click="fileInputRef?.click()"
            >
              <Paperclip :size="16" />
            </button>

            <!-- Saved replies button -->
            <div class="relative shrink-0">
              <button
                class="flex h-[38px] w-[38px] items-center justify-center rounded-xl transition"
                :class="showRepliesPicker
                  ? 'bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-500/30'
                  : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'"
                title="Respostas rápidas"
                @click.stop="openRepliesPicker"
              >
                <Zap :size="15" />
              </button>

              <!-- Picker popup -->
              <div
                v-if="showRepliesPicker"
                class="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-900 shadow-2xl"
                @click.stop
              >
                <div class="border-b border-zinc-800 p-2">
                  <input
                    v-model="repliesSearch"
                    type="text"
                    placeholder="Buscar resposta rápida..."
                    class="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-sm text-white outline-none transition focus:border-blue-500"
                  />
                </div>
                <div class="max-h-56 overflow-y-auto p-1">
                  <div v-if="loadingReplies" class="py-8 text-center text-sm text-zinc-600">
                    Carregando...
                  </div>
                  <div v-else-if="filteredReplies.length === 0" class="py-8 text-center text-sm text-zinc-600">
                    Nenhuma resposta encontrada
                  </div>
                  <button
                    v-for="reply in filteredReplies"
                    :key="reply.id"
                    class="flex w-full flex-col rounded-lg px-3 py-2.5 text-left transition hover:bg-zinc-800"
                    @click="insertReply(reply.content)"
                  >
                    <span class="text-xs font-semibold text-zinc-200">{{ reply.title }}</span>
                    <span class="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{{ reply.content }}</span>
                  </button>
                </div>
                <div class="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-700">
                  Clique para inserir · ESC para fechar
                </div>
              </div>
            </div>

            <!-- Textarea -->
            <textarea
              v-model="inputText"
              rows="1"
              :disabled="windowClosed && !isInternalNote"
              :placeholder="isInternalNote ? 'Escreva uma nota interna…' : windowClosed ? 'Janela de 24h encerrada — aguarde o contato responder' : 'Mensagem…'"
              class="flex-1 min-h-[38px] max-h-32 resize-none overflow-y-hidden rounded-xl border py-2.5 px-4 text-sm placeholder-zinc-600 transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              :class="isInternalNote
                ? 'border-amber-500/40 bg-amber-500/5 text-amber-100 focus:border-amber-500/60'
                : 'border-zinc-700/60 bg-zinc-800/60 text-zinc-100 focus:border-blue-500/50 focus:bg-zinc-800'"
              @keydown.enter.exact.prevent="sendMessage"
              @input="autoResize"
            />

            <!-- Internal note toggle -->
            <button
              class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl transition"
              :class="isInternalNote
                ? 'bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'"
              title="Nota interna (visível apenas para agentes)"
              @click="isInternalNote = !isInternalNote"
            >
              <StickyNote :size="15" />
            </button>

            <!-- Audio record button -->
            <button
              v-if="!isInternalNote"
              class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40"
              :class="isRecording
                ? 'bg-red-600 text-white animate-pulse'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'"
              :disabled="windowClosed"
              :title="isRecording ? 'Parar gravação' : 'Gravar áudio'"
              @click="toggleRecording"
            >
              <Mic :size="16" />
            </button>

            <!-- Send button -->
            <button
              class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40"
              :class="isInternalNote ? 'bg-amber-500 hover:bg-amber-400' : 'bg-blue-600 hover:bg-blue-500'"
              :disabled="!inputText.trim() || sending || (windowClosed && !isInternalNote)"
              @click="sendMessage"
            >
              <StickyNote v-if="isInternalNote" :size="15" class="text-white" />
              <Send v-else :size="15" class="text-white" />
            </button>
          </div>
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
      class="w-[232px] shrink-0 flex flex-col border-l border-zinc-800/80 bg-zinc-950 overflow-y-auto"
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
            : activeConversation.status === 'LEAD'
            ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
            : 'border-zinc-700/60 bg-zinc-800/40 text-zinc-500'"
        >
          {{ activeConversation.status === 'OPEN' ? 'Em atendimento' : activeConversation.status === 'LEAD' ? 'Lead' : 'Finalizada' }}
        </span>
      </div>

      <div class="mx-4 h-px bg-zinc-800/60" />

      <!-- Priority -->
      <div class="px-4 py-4">
        <span class="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Prioridade</span>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="p in PRIORITIES"
            :key="p.value"
            class="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition"
            :class="activeConversation.priority === p.value
              ? p.activeBgClass
              : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'"
            @click="setPriority(p.value)"
          >
            <Flag :size="9" />
            {{ p.label }}
          </button>
        </div>
      </div>

      <div class="mx-4 h-px bg-zinc-800/60" />

      <!-- Tags -->
      <div class="px-4 py-4">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Tags</span>
          <button
            class="text-[10px] text-zinc-700 transition hover:text-blue-400"
            @click="addingTag = !addingTag; newTagInput = ''"
          >
            {{ addingTag ? 'Cancelar' : '+ Adicionar' }}
          </button>
        </div>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="tag in (activeConversation.tags ?? [])"
            :key="tag"
            class="flex items-center gap-0.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400"
          >
            {{ tag }}
            <button class="ml-0.5 transition hover:text-red-400" @click="removeTag(tag)">
              <X :size="9" />
            </button>
          </span>
          <span
            v-if="(activeConversation.tags ?? []).length === 0 && !addingTag"
            class="text-[10px] text-zinc-700"
          >
            Sem tags
          </span>
        </div>
        <div v-if="addingTag" class="mt-2 flex gap-1">
          <input
            ref="tagInputRef"
            v-model="newTagInput"
            type="text"
            placeholder="nova tag..."
            maxlength="32"
            class="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 outline-none transition focus:border-blue-500"
            @keydown.enter.prevent="addTag"
            @keydown.escape="addingTag = false"
          />
          <button
            class="rounded-lg bg-blue-600 px-2.5 text-[11px] font-medium text-white transition hover:bg-blue-500"
            @click="addTag"
          >
            Ok
          </button>
        </div>
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
          <div class="relative shrink-0">
            <div
              v-if="activeConversation.assignedTo"
              class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-300"
            >
              {{ activeConversation.assignedTo.name[0].toUpperCase() }}
            </div>
            <div v-else class="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800">
              <User :size="11" class="text-zinc-600" />
            </div>
            <!-- Online indicator -->
            <span
              v-if="activeConversation.assignedTo && isAgentOnline(activeConversation.assignedTo.id)"
              class="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-zinc-950 bg-emerald-400"
            />
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

      <!-- CSAT — shown for resolved conversations -->
      <div v-if="activeConversation.status === 'RESOLVED'" class="px-4 py-4">
        <span class="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Satisfação (CSAT)</span>
        <div class="flex gap-1">
          <button
            v-for="star in 5"
            :key="star"
            class="text-xl leading-none transition"
            :class="(activeConversation.csatScore ?? 0) >= star ? 'text-amber-400' : 'text-zinc-700 hover:text-amber-400/60'"
            :title="`${star} estrela${star > 1 ? 's' : ''}`"
            @click="setCsat(star)"
          >
            ★
          </button>
        </div>
        <p class="mt-1 text-[9px] text-zinc-700">
          {{ activeConversation.csatScore ? `Nota: ${activeConversation.csatScore}/5` : 'Sem avaliação' }}
        </p>
      </div>

      <div v-if="activeConversation.status === 'RESOLVED'" class="mx-4 h-px bg-zinc-800/60" />

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
          v-if="activeConversation.status === 'LEAD'"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
          :disabled="beginningConv"
          @click="beginConversation"
        >
          <LoaderCircle v-if="beginningConv" :size="13" class="animate-spin" />
          <Play v-else :size="13" />
          Iniciar atendimento
        </button>
        <button
          v-else-if="activeConversation.status === 'OPEN'"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          :disabled="statusChanging"
          @click="changeStatus('RESOLVED')"
        >
          <CheckCircle :size="13" />
          Finalizar atendimento
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

        <div class="mt-2 h-px bg-zinc-800/60" />

        <button
          class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-900/40 bg-red-950/20 py-2 text-[11px] font-medium text-red-500 transition hover:bg-red-950/40 disabled:opacity-50"
          :disabled="deletingContact"
          @click="deleteContact"
          title="LGPD Art. 18 — direito à exclusão de dados pessoais"
        >
          <LoaderCircle v-if="deletingContact" :size="11" class="animate-spin" />
          <Trash2 v-else :size="11" />
          Apagar dados (LGPD)
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
        <div class="flex w-full max-w-lg flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 shadow-2xl" style="max-height: 90vh;">
          <div class="flex shrink-0 items-start justify-between p-6 pb-4">
            <div>
              <h2 class="text-base font-semibold text-white">Nova conversa</h2>
              <p class="mt-0.5 text-xs text-zinc-500">Selecione um contato ou insira um número para iniciar.</p>
            </div>
            <button class="mt-0.5 text-zinc-600 transition hover:text-zinc-300" @click="showNewConvModal = false">
              <X :size="18" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-6 pb-2">
            <div v-if="newConvForm.contactPhone" class="mb-4 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-300">
                {{ initials(newConvSelectedName || newConvForm.contactPhone) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-white">{{ newConvSelectedName || newConvForm.contactPhone }}</p>
                <p class="text-xs text-zinc-400">{{ newConvForm.contactPhone }}</p>
              </div>
              <button class="text-zinc-600 hover:text-zinc-300" @click="clearConvContact">
                <X :size="14" />
              </button>
            </div>

            <div v-if="!newConvForm.contactPhone" class="mb-3">
              <div class="relative">
                <Search :size="14" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  v-model="contactSearch"
                  type="text"
                  placeholder="Buscar contato ou inserir número..."
                  class="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 py-2.5 pl-9 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
                  @input="onContactSearchInput"
                />
              </div>
            </div>

            <div v-if="!newConvForm.contactPhone" class="mb-4 space-y-1">
              <button
                v-if="contactSearch.trim().length >= 6 && !contactSearchResults.find(c => c.phoneNumber === contactSearch.trim())"
                class="flex w-full items-center gap-3 rounded-xl border border-dashed border-zinc-700 px-3 py-2.5 text-left transition hover:border-blue-500/40 hover:bg-blue-500/5"
                @click="selectManualPhone(contactSearch.trim())"
              >
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                  <Plus :size="14" />
                </div>
                <div>
                  <p class="text-sm text-white">Usar <span class="font-mono">{{ contactSearch.trim() }}</span></p>
                  <p class="text-xs text-zinc-500">Número não encontrado nos contatos</p>
                </div>
              </button>

              <button
                v-for="contact in contactSearchResults"
                :key="contact.id"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-zinc-800"
                @click="selectContact(contact)"
              >
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  :style="{ background: avatarGradient(contact.name ?? contact.phoneNumber) }"
                >
                  {{ initials(contact.name ?? contact.phoneNumber) }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-white">{{ contact.name || contact.phoneNumber }}</p>
                  <p class="text-xs text-zinc-500">{{ contact.phoneNumber }}</p>
                </div>
              </button>

              <p v-if="contactSearchResults.length === 0 && contactSearch.length < 3" class="py-2 text-center text-xs text-zinc-600">
                Digite para buscar ou insira um número com +55...
              </p>
              <p v-else-if="contactSearchResults.length === 0 && contactSearch.trim().length < 6" class="py-2 text-center text-xs text-zinc-600">
                Nenhum contato encontrado.
              </p>
            </div>

            <div v-if="showNewContactForm && !newConvForm.contactPhone" class="mb-4 rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-4">
              <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Novo contato</p>
              <div class="space-y-3">
                <input v-model="newContactData.name" type="text" placeholder="Nome" class="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500" />
                <input v-model="newContactData.phoneNumber" type="text" placeholder="+5521999999999" class="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500" />
                <div class="flex gap-2">
                  <button class="flex-1 rounded-xl border border-zinc-700 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800" @click="showNewContactForm = false">Cancelar</button>
                  <button :disabled="savingContact || !newContactData.name.trim() || !newContactData.phoneNumber.trim()" class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50" @click="saveNewContact">
                    <LoaderCircle v-if="savingContact" :size="12" class="animate-spin" />
                    Salvar contato
                  </button>
                </div>
              </div>
            </div>

            <button
              v-if="!showNewContactForm && !newConvForm.contactPhone"
              class="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-2.5 text-xs text-zinc-500 transition hover:border-blue-500/40 hover:text-blue-400"
              @click="openNewContactForm"
            >
              <Plus :size="13" />
              Adicionar novo contato
            </button>

            <div v-if="newConvForm.contactPhone" class="space-y-4">
              <div>
                <label class="text-xs font-medium text-zinc-400">Canal</label>
                <select v-model="newConvForm.instanceId" class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500">
                  <option value="" disabled>Selecione um canal...</option>
                  <option v-for="inst in connectedInstances" :key="inst.id" :value="inst.id">{{ inst.name }} · {{ providerLabel[inst.providerType] ?? inst.providerType }}</option>
                </select>
                <p v-if="connectedInstances.length === 0" class="mt-1 text-[11px] text-yellow-500">
                  Nenhum canal conectado. Conecte em <NuxtLink to="/whatsapp" class="underline">Canais</NuxtLink>.
                </p>
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400">Departamento <span class="text-zinc-600">(opcional)</span></label>
                <select v-model="newConvForm.departmentId" class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500">
                  <option value="">Sem departamento</option>
                  <option v-for="dept in allDepts" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-medium text-zinc-400">Atendente <span class="text-zinc-600">(opcional)</span></label>
                <select v-model="newConvForm.assignedToId" class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500">
                  <option value="">Não atribuído</option>
                  <option v-for="user in transferUsers" :key="user.id" :value="user.id">{{ user.name }}{{ isAgentOnline(user.id) ? ' ●' : '' }}</option>
                </select>
              </div>
              <div v-if="isMetaInstance">
                <label class="text-xs font-medium text-zinc-400">Template de mensagem <span class="text-red-400">*</span></label>
                <p class="mt-0.5 text-[11px] text-zinc-600">Envio proativo via Meta exige template aprovado na Business Suite.</p>
                <div v-if="loadingTemplates" class="mt-2 flex items-center gap-2 py-2 text-xs text-zinc-500">
                  <LoaderCircle :size="12" class="animate-spin" />
                  Carregando templates...
                </div>
                <div v-else-if="templates.length === 0" class="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-400">
                  Nenhum template aprovado encontrado.
                </div>
                <template v-else>
                  <select v-model="selectedTemplate" class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500">
                    <option :value="null">Selecione um template...</option>
                    <option v-for="t in templates" :key="t.id" :value="t">{{ t.name }} · {{ t.language }} ({{ t.category }})</option>
                  </select>
                  <div v-if="templateBodyText" class="mt-2 rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-3">
                    <p class="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Prévia do corpo</p>
                    <p class="whitespace-pre-line text-[12px] text-zinc-300">{{ templateBodyText }}</p>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div class="shrink-0 border-t border-zinc-800 p-6 pt-4">
            <p v-if="newConvError" class="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{{ newConvError }}</p>
            <button
              :disabled="startingConv || !newConvForm.contactPhone.trim() || !newConvForm.instanceId || (isMetaInstance && !selectedTemplate)"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              @click="doStartConversation"
            >
              <LoaderCircle v-if="startingConv" :size="15" class="animate-spin" />
              <Send v-else :size="14" />
              {{ startingConv ? 'Iniciando…' : 'Iniciar conversa' }}
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
            <div>
              <label class="text-xs font-medium text-zinc-400">Departamento</label>
              <select v-model="transferForm.departmentId" class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500">
                <option value="">Sem departamento</option>
                <option v-for="dept in allDepts" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
              </select>
            </div>

            <div>
              <label class="text-xs font-medium text-zinc-400">
                Atendente
                <span v-if="transferForm.departmentId" class="ml-1 text-zinc-600">(do departamento)</span>
              </label>
              <select v-model="transferForm.assignedToId" class="mt-1.5 w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-500">
                <option value="">Sem atribuição</option>
                <option v-for="user in filteredTransferUsers" :key="user.id" :value="user.id">
                  {{ user.name }}{{ isAgentOnline(user.id) ? ' ●' : '' }}
                </option>
              </select>
            </div>

            <!-- Online agents quick view -->
            <div v-if="onlineAgents.length > 0" class="rounded-xl border border-zinc-800/80 bg-zinc-800/30 px-3 py-2.5">
              <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Agentes online</p>
              <div class="flex flex-wrap gap-2">
                <div v-for="agent in onlineAgents" :key="agent.userId" class="flex items-center gap-1.5">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span class="text-[11px] text-zinc-400">{{ agent.name }}</span>
                </div>
              </div>
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
  Plus, ChevronDown, Trash2, Play, Pause, Paperclip, Mic, Clock,
  StickyNote, Flag, Zap, AlertTriangle,
} from "lucide-vue-next"
import { useApi } from "../../composables/useApi"
import { useCookie, useRuntimeConfig } from "#imports"

definePageMeta({ layout: "chat", middleware: "auth" })
useHead({ title: "Conversas" })

// ── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name?: string | null
  phoneNumber: string
  avatarUrl?: string | null
}

interface ConvSummary {
  id: string
  status: "LEAD" | "OPEN" | "RESOLVED"
  lastMessageAt?: string | null
  unreadCount?: number
  priority?: string | null
  tags?: string[]
  slaBreachedAt?: string | null
  firstResponseAt?: string | null
  csatScore?: number | null
  createdAt?: string
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
  mediaUrl?: string | null
  createdAt: string
  isInternal?: boolean
  author?: { id: string; name: string } | null
}

interface ChannelInstance {
  id: string
  name: string
  providerType: string
  connectionStatus: string
  phoneNumber?: string | null
}

interface PresenceAgent {
  userId: string
  name: string
  status: "online" | "away" | "busy"
  updatedAt: number
}

// ── Config ───────────────────────────────────────────────────────────────────

const config = useRuntimeConfig()
const apiUrl = (config.public.apiUrl as string | undefined) ?? "http://localhost:3333"
const accessToken = useCookie<string | null>("access_token")

// ── State ────────────────────────────────────────────────────────────────────

const api = useApi()

const search = ref("")
const filterDeptId = ref("")
const activeTab = ref<"LEADS" | "ALL" | "MINE" | "RESOLVED">("LEADS")
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
const beginningConv = ref(false)

// SSE
const sseCleanup = ref<(() => void) | null>(null)

// Internal note
const isInternalNote = ref(false)

// Priority menu
const showPriorityMenu = ref(false)

// Tags
const addingTag = ref(false)
const newTagInput = ref("")
const tagInputRef = ref<HTMLInputElement | null>(null)

// Presence
const onlineAgents = ref<PresenceAgent[]>([])
let presenceInterval: ReturnType<typeof setInterval> | null = null

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
const newConvForm = reactive({ contactPhone: "", instanceId: "", departmentId: "", assignedToId: "" })
const newConvSelectedName = ref("")

// Contacts
const contactSearch = ref("")
const contactSearchResults = ref<{ id: string; name?: string | null; phoneNumber: string }[]>([])
const allContacts = ref<{ id: string; name?: string | null; phoneNumber: string }[]>([])

// New contact inline
const showNewContactForm = ref(false)
const savingContact = ref(false)
const newContactData = reactive({ name: "", phoneNumber: "+55" })
const instances = ref<ChannelInstance[]>([])
const connectedInstances = computed(() =>
  instances.value.filter((i) => i.connectionStatus === "CONNECTED")
)

const convMenuOpen = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingMedia = ref(false)
const sendError = ref("")
const templates = ref<any[]>([])
const loadingTemplates = ref(false)
const selectedTemplate = ref<any | null>(null)
const deletingContact = ref(false)
const isRecording = ref(false)
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

// Saved replies
const showRepliesPicker = ref(false)
const savedReplies = ref<{ id: string; title: string; content: string }[]>([])
const repliesSearch = ref("")
const loadingReplies = ref(false)

const TABS = [
  { label: "Leads", value: "LEADS" as const },
  { label: "Abertas", value: "ALL" as const },
  { label: "Minhas", value: "MINE" as const },
  { label: "Resolvidas", value: "RESOLVED" as const },
]

const PRIORITIES = [
  { value: "LOW",    label: "Baixa",   textClass: "text-blue-400",   activeBgClass: "bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-500/30" },
  { value: "MEDIUM", label: "Média",   textClass: "text-zinc-400",   activeBgClass: "bg-zinc-700 text-zinc-300 ring-1 ring-inset ring-zinc-600/50" },
  { value: "HIGH",   label: "Alta",    textClass: "text-orange-400", activeBgClass: "bg-orange-500/15 text-orange-400 ring-1 ring-inset ring-orange-500/30" },
  { value: "URGENT", label: "Urgente", textClass: "text-red-400",    activeBgClass: "bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30" },
]

// ── Priority helpers ──────────────────────────────────────────────────────────

const priorityLabel: Record<string, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente",
}

const priorityStripClass: Record<string, string> = {
  LOW: "bg-blue-500",
  HIGH: "bg-orange-500",
  URGENT: "bg-red-500",
}

const priorityBadgeClass: Record<string, string> = {
  LOW:    "bg-blue-500/10 text-blue-400",
  HIGH:   "bg-orange-500/10 text-orange-400",
  URGENT: "bg-red-500/10 text-red-400",
}

const priorityHeaderClass: Record<string, string> = {
  LOW:    "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
  MEDIUM: "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800",
  HIGH:   "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20",
  URGENT: "bg-red-500/10 text-red-400 hover:bg-red-500/20",
}

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
const leadCount = computed(() => conversations.value.filter((c) => c.status === "LEAD").length)

const filteredReplies = computed(() => {
  const q = repliesSearch.value.trim().toLowerCase()
  if (!q) return savedReplies.value
  return savedReplies.value.filter(
    (r) => r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
  )
})

const filteredTransferUsers = computed(() => {
  if (!transferForm.departmentId) return transferUsers.value
  return transferUsers.value.filter(
    (u) => !u.departmentIds?.length || u.departmentIds.includes(transferForm.departmentId)
  )
})

const windowClosed = computed(() => {
  if (activeConversation.value?.instance?.providerType !== "META_CLOUD_API") return false
  const lastInbound = [...messages.value].reverse().find((m) => m.direction === "INBOUND")
  if (!lastInbound) return true
  const expiry = new Date(new Date(lastInbound.createdAt).getTime() + 24 * 60 * 60 * 1000)
  return expiry < new Date()
})

const selectedInstance = computed(() =>
  instances.value.find((i) => i.id === newConvForm.instanceId) ?? null
)
const isMetaInstance = computed(() =>
  selectedInstance.value?.providerType === "META_CLOUD_API"
)
const templateBodyText = computed(() => {
  if (!selectedTemplate.value) return null
  const body = (selectedTemplate.value.components ?? []).find((c: any) => c.type === "BODY")
  return body?.text ?? null
})

// ── Search debounce ───────────────────────────────────────────────────────────

const debouncedSearch = ref("")
let searchTimer: ReturnType<typeof setTimeout>
watch(search, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = val }, 300)
})

watch(() => newConvForm.instanceId, async (id) => {
  selectedTemplate.value = null
  templates.value = []
  if (!id) return
  const inst = instances.value.find((i) => i.id === id)
  if (inst?.providerType !== "META_CLOUD_API") return
  loadingTemplates.value = true
  try { templates.value = await api<any[]>(`/whatsapp/instances/${id}/templates`) } catch {}
  loadingTemplates.value = false
})

watch(addingTag, (val) => {
  if (val) nextTick(() => tagInputRef.value?.focus())
})

// ── List polling ──────────────────────────────────────────────────────────────

let listInterval: ReturnType<typeof setInterval> | null = null

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

// ── SSE ───────────────────────────────────────────────────────────────────────

function disconnectSSE() {
  if (sseCleanup.value) {
    sseCleanup.value()
    sseCleanup.value = null
  }
}

function handleSSEEvent(event: { type: string; data: any }, convId: string) {
  if (activeConversationId.value !== convId) return

  if (event.type === "message") {
    const msg = event.data as Message
    if (!messages.value.find((m) => m.id === msg.id)) {
      if (msg.direction === "INBOUND" && !msg.isInternal && activeConversation.value?.status === "OPEN") {
        playNotificationSound()
        const contactName = activeConversation.value?.contact.name ?? activeConversation.value?.contact.phoneNumber ?? "Contato"
        sendBrowserNotification(`Nova mensagem — ${contactName}`, msg.content ?? "Mídia recebida")
      }
      messages.value.push(msg)
      scrollToBottom()
    }
  } else if (event.type === "conversation_updated") {
    if (activeConversation.value) {
      const upd = event.data as Partial<FullConversation>
      if (upd.status !== undefined) activeConversation.value.status = upd.status as any
      if (upd.priority !== undefined) activeConversation.value.priority = upd.priority
      // Reload for assignedTo name resolution
      if ((upd as any).assignedToId !== undefined) {
        api<FullConversation>(`/conversations/${convId}`).then((fresh) => {
          if (activeConversationId.value === convId) {
            activeConversation.value = fresh
          }
        }).catch(() => {})
      }
    }
  }
}

function connectSSE(convId: string) {
  disconnectSSE()
  let aborted = false
  const controller = new AbortController()

  sseCleanup.value = () => {
    aborted = true
    controller.abort()
  }

  async function run() {
    while (!aborted) {
      try {
        const token = accessToken.value
        const resp = await fetch(`${apiUrl}/conversations/${convId}/events`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        })
        if (!resp.ok || !resp.body) {
          await new Promise((r) => setTimeout(r, 3000))
          continue
        }
        const reader = resp.body.getReader()
        const dec = new TextDecoder()
        let buf = ""
        while (!aborted) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const chunks = buf.split("\n\n")
          buf = chunks.pop()!
          for (const chunk of chunks) {
            const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"))
            if (!dataLine) continue
            try { handleSSEEvent(JSON.parse(dataLine.slice(5).trim()), convId) } catch {}
          }
        }
      } catch {
        if (aborted) return
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
  }

  run()
}

// ── Load data ─────────────────────────────────────────────────────────────────

let currentLoadId = 0

async function loadConversations() {
  const loadId = ++currentLoadId
  try {
    const params = new URLSearchParams()
    if (activeTab.value === "MINE") params.set("mine", "true")
    if (activeTab.value === "LEADS") params.set("status", "LEAD")
    else if (activeTab.value === "RESOLVED") params.set("status", "RESOLVED")
    else params.set("status", "OPEN")
    if (debouncedSearch.value) params.set("search", debouncedSearch.value)
    if (filterDeptId.value) params.set("departmentId", filterDeptId.value)

    const result = await api<{ items: ConvSummary[]; nextCursor: string | null }>(`/conversations?${params}`)
    if (loadId === currentLoadId) conversations.value = result.items
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

// ── Presence ──────────────────────────────────────────────────────────────────

async function heartbeat() {
  try { await api("/presence/heartbeat", { method: "POST", body: { status: "online" } }) } catch {}
}

async function loadPresence() {
  try { onlineAgents.value = await api<PresenceAgent[]>("/presence") } catch {}
}

function isAgentOnline(userId: string) {
  return onlineAgents.value.some((a) => a.userId === userId)
}

// ── Conversation select ───────────────────────────────────────────────────────

async function selectConversation(id: string) {
  if (activeConversationId.value === id) return
  activeConversationId.value = id
  messages.value = []
  sendError.value = ""
  isInternalNote.value = false
  disconnectSSE()

  try {
    activeConversation.value = await api<FullConversation>(`/conversations/${id}`)
    messages.value = activeConversation.value.messages as unknown as Message[]
    scrollToBottom(false)
  } catch {
    activeConversation.value = null
  }

  connectSSE(id)
}

function scrollToBottom(smooth = true) {
  nextTick(() => scrollAnchorRef.value?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" }))
}

// ── Send ──────────────────────────────────────────────────────────────────────

async function sendMessage() {
  if (isInternalNote.value) { await sendNote(); return }
  const content = inputText.value.trim()
  if (!content || sending.value || !activeConversationId.value) return
  sendError.value = ""
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
  } catch (err: any) {
    messages.value = messages.value.filter((m) => m.id !== optimistic.id)
    if (err?.data?.code === "WINDOW_CLOSED") sendError.value = err.data.error
    else inputText.value = content
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

async function sendNote() {
  const content = inputText.value.trim()
  if (!content || sending.value || !activeConversationId.value) return
  sending.value = true
  inputText.value = ""

  const optimistic: Message = {
    id: `opt-note-${Date.now()}`,
    conversationId: activeConversationId.value,
    direction: "OUTBOUND",
    type: "TEXT",
    content,
    createdAt: new Date().toISOString(),
    isInternal: true,
  }
  messages.value.push(optimistic)
  scrollToBottom()

  try {
    const note = await api<Message>(`/conversations/${activeConversationId.value}/notes`, {
      method: "POST",
      body: { content },
    })
    const idx = messages.value.findIndex((m) => m.id === optimistic.id)
    if (idx !== -1) messages.value.splice(idx, 1, note)
  } catch {
    messages.value = messages.value.filter((m) => m.id !== optimistic.id)
    inputText.value = content
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

// ── Tags ──────────────────────────────────────────────────────────────────────

async function saveTags(newTags: string[]) {
  if (!activeConversationId.value) return
  try {
    await api(`/conversations/${activeConversationId.value}/tags`, {
      method: "PATCH",
      body: { tags: newTags },
    })
    if (activeConversation.value) activeConversation.value.tags = newTags
    const listConv = conversations.value.find((c) => c.id === activeConversationId.value)
    if (listConv) listConv.tags = newTags
  } catch {}
}

async function addTag() {
  const tag = newTagInput.value.trim().toLowerCase().replace(/\s+/g, "-")
  if (!tag) return
  const current = activeConversation.value?.tags ?? []
  if (!current.includes(tag)) await saveTags([...current, tag])
  newTagInput.value = ""
  addingTag.value = false
}

async function removeTag(tag: string) {
  const current = activeConversation.value?.tags ?? []
  await saveTags(current.filter((t) => t !== tag))
}

// ── Priority ──────────────────────────────────────────────────────────────────

async function setPriority(priority: string) {
  if (!activeConversationId.value) return
  try {
    await api(`/conversations/${activeConversationId.value}/priority`, {
      method: "PATCH",
      body: { priority },
    })
    if (activeConversation.value) activeConversation.value.priority = priority
    const listConv = conversations.value.find((c) => c.id === activeConversationId.value)
    if (listConv) listConv.priority = priority
  } catch {}
}

// ── Iniciar atendimento ───────────────────────────────────────────────────────

async function beginConversation() {
  if (!activeConversationId.value || beginningConv.value) return
  beginningConv.value = true
  try {
    await api(`/conversations/${activeConversationId.value}/begin`, { method: "POST" })
    if (activeConversation.value) activeConversation.value.status = "OPEN"
    activeTab.value = "ALL"
    await loadConversations()
  } catch {
  } finally {
    beginningConv.value = false
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
    await loadConversations()
  } catch {
  } finally {
    statusChanging.value = false
  }
}

// ── CSAT ──────────────────────────────────────────────────────────────────────

async function setCsat(score: number) {
  if (!activeConversationId.value) return
  try {
    await api(`/conversations/${activeConversationId.value}/csat`, { method: "PATCH", body: { score } })
    if (activeConversation.value) activeConversation.value.csatScore = score
  } catch {}
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

// ── Nova conversa ─────────────────────────────────────────────────────────────

async function openNewConvModal() {
  newConvForm.contactPhone = ""
  newConvForm.instanceId = connectedInstances.value[0]?.id ?? ""
  newConvForm.departmentId = ""
  newConvForm.assignedToId = ""
  newConvError.value = ""
  newConvSelectedName.value = ""
  contactSearch.value = ""
  showNewContactForm.value = false
  selectedTemplate.value = null
  templates.value = []
  Object.assign(newContactData, { name: "", phoneNumber: "+55" })
  showNewConvModal.value = true
  try {
    allContacts.value = await api<{ id: string; name?: string | null; phoneNumber: string }[]>("/contacts")
    contactSearchResults.value = allContacts.value.slice(0, 30)
  } catch {
    allContacts.value = []
    contactSearchResults.value = []
  }
}

function onContactSearchInput() {
  const q = contactSearch.value.trim().toLowerCase()
  if (!q) { contactSearchResults.value = allContacts.value.slice(0, 30); return }
  contactSearchResults.value = allContacts.value.filter(
    (c) => (c.name ?? "").toLowerCase().includes(q) || c.phoneNumber.includes(q)
  ).slice(0, 20)
}

function selectContact(c: { id: string; name?: string | null; phoneNumber: string }) {
  newConvForm.contactPhone = c.phoneNumber
  newConvSelectedName.value = c.name ?? c.phoneNumber
  contactSearch.value = ""
}

function selectManualPhone(phone: string) {
  newConvForm.contactPhone = phone.startsWith("+") ? phone : `+55${phone.replace(/\D/g, "")}`
  newConvSelectedName.value = ""
}

function clearConvContact() {
  newConvForm.contactPhone = ""
  newConvSelectedName.value = ""
  contactSearch.value = ""
  contactSearchResults.value = allContacts.value.slice(0, 30)
}

function openNewContactForm() {
  showNewContactForm.value = true
  newContactData.name = ""
  newContactData.phoneNumber = contactSearch.value.trim() || "+55"
}

async function saveNewContact() {
  if (!newContactData.name.trim() || !newContactData.phoneNumber.trim()) return
  savingContact.value = true
  try {
    const contact = await api<{ id: string; name: string; phoneNumber: string }>("/contacts", {
      method: "POST",
      body: { name: newContactData.name.trim(), phoneNumber: newContactData.phoneNumber.trim() },
    })
    allContacts.value.unshift(contact)
    contactSearchResults.value = allContacts.value.slice(0, 30)
    selectContact(contact)
    showNewContactForm.value = false
  } catch (err: any) {
    alert(err?.data?.error ?? "Não foi possível salvar o contato.")
  } finally {
    savingContact.value = false
  }
}

async function doStartConversation() {
  if (!newConvForm.contactPhone.trim() || !newConvForm.instanceId) return
  startingConv.value = true
  newConvError.value = ""
  try {
    const body: Record<string, any> = {
      contactPhone: newConvForm.contactPhone.trim(),
      instanceId: newConvForm.instanceId,
      departmentId: newConvForm.departmentId || null,
      assignedToId: newConvForm.assignedToId || null,
    }
    if (isMetaInstance.value && selectedTemplate.value) {
      body.templateName = selectedTemplate.value.name
      body.languageCode = selectedTemplate.value.language
    }
    const conversation = await api<{ id: string }>("/conversations/start", { method: "POST", body })
    showNewConvModal.value = false
    await loadConversations()
    await selectConversation(conversation.id)
  } catch (err: any) {
    newConvError.value = err?.data?.error ?? err?.data?.message ?? "Não foi possível iniciar a conversa."
  } finally {
    startingConv.value = false
  }
}

async function deleteContact() {
  const contact = activeConversation.value?.contact
  if (!contact) return
  const confirmed = confirm(
    `Apagar todos os dados de ${contact.name || contact.phoneNumber}?\n\nIsso removerá o contato e todas as conversas associadas (LGPD Art. 18). Esta ação é irreversível.`
  )
  if (!confirmed) return
  deletingContact.value = true
  try {
    await api(`/contacts/${contact.id}`, { method: "DELETE" })
    activeConversationId.value = null
    activeConversation.value = null
    messages.value = []
    disconnectSSE()
    await loadConversations()
  } catch (err: any) {
    alert(err?.data?.error ?? "Não foi possível apagar os dados do contato.")
  } finally {
    deletingContact.value = false
  }
}

// ── Textarea resize ───────────────────────────────────────────────────────────

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = "auto"
  const newH = Math.min(el.scrollHeight, 128)
  el.style.height = `${newH}px`
  el.style.overflowY = el.scrollHeight > 128 ? "auto" : "hidden"
}

// ── Notification sound ────────────────────────────────────────────────────────

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  if (document.visibilityState === "visible") return
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "omniflow-msg" })
  } catch {}
}

function playNotificationSound() {
  try {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
    setTimeout(() => ctx.close(), 1000)
  } catch {}
}

// ── Media upload ──────────────────────────────────────────────────────────────

async function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !activeConversationId.value) return
  ;(e.target as HTMLInputElement).value = ""
  uploadingMedia.value = true
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const msg = await api<Message>(`/conversations/${activeConversationId.value}/media`, {
      method: "POST",
      body: { data: base64, mimeType: file.type, filename: file.name },
    })
    messages.value.push(msg)
    scrollToBottom()
    await loadConversations()
  } catch (err: any) {
    if (err?.data?.code === "WINDOW_CLOSED") sendError.value = err.data.error
    else alert(err?.data?.error ?? "Falha ao enviar arquivo.")
  } finally {
    uploadingMedia.value = false
  }
}

// ── Audio player ──────────────────────────────────────────────────────────────

const AUDIO_SPEEDS = [1, 1.5, 2] as const
type AudioSpeed = typeof AUDIO_SPEEDS[number]

interface AudioPlayerState {
  playing: boolean
  currentTime: number
  duration: number
  speed: AudioSpeed
}

const audioPlayerState = reactive<Record<string, AudioPlayerState>>({})
const audioEls = new Map<string, HTMLAudioElement>()

function getAudioState(id: string): AudioPlayerState {
  if (!audioPlayerState[id]) {
    audioPlayerState[id] = { playing: false, currentTime: 0, duration: 0, speed: 1 }
  }
  return audioPlayerState[id]
}

function cycleSpeed(id: string) {
  const state = getAudioState(id)
  const idx   = AUDIO_SPEEDS.indexOf(state.speed)
  state.speed = AUDIO_SPEEDS[(idx + 1) % AUDIO_SPEEDS.length]
  const el = audioEls.get(id)
  if (el) el.playbackRate = state.speed
}

function speedLabel(id: string): string {
  const s = getAudioState(id).speed
  return s === 1 ? "1×" : s === 1.5 ? "1.5×" : "2×"
}

function registerAudio(id: string, el: HTMLAudioElement | null) {
  if (!el) { audioEls.delete(id); return }
  if (audioEls.get(id) === el) return
  audioEls.set(id, el)
  const state = getAudioState(id)
  el.addEventListener("loadedmetadata", () => { state.duration = isFinite(el.duration) ? el.duration : 0 })
  el.addEventListener("durationchange",  () => { state.duration = isFinite(el.duration) ? el.duration : 0 })
  el.addEventListener("timeupdate",      () => { state.currentTime = el.currentTime })
  el.addEventListener("ended",           () => { state.playing = false; state.currentTime = 0; el.currentTime = 0 })
}

function toggleAudio(id: string) {
  const el = audioEls.get(id)
  if (!el) return
  const state = getAudioState(id)
  if (state.playing) {
    el.pause()
    state.playing = false
  } else {
    audioEls.forEach((other, otherId) => {
      if (otherId !== id && !other.paused) {
        other.pause()
        getAudioState(otherId).playing = false
      }
    })
    el.play().catch(() => {})
    state.playing = true
  }
}

function seekAudio(id: string, e: MouseEvent) {
  const el    = audioEls.get(id)
  const state = getAudioState(id)
  if (!el || !state.duration) return
  const bar  = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  el.currentTime = Math.max(0, Math.min(((e.clientX - rect.left) / rect.width) * state.duration, state.duration))
}

function audioProgress(id: string): number {
  const s = audioPlayerState[id]
  if (!s || !s.duration) return 0
  return Math.min((s.currentTime / s.duration) * 100, 100)
}

function fmtAudioTime(sec: number): string {
  if (!sec || isNaN(sec) || !isFinite(sec)) return "0:00"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

// ── Audio recording ───────────────────────────────────────────────────────────

async function toggleRecording() {
  if (isRecording.value) { mediaRecorder?.stop(); return }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      isRecording.value = false
      if (!activeConversationId.value || audioChunks.length === 0) return
      const blob = new Blob(audioChunks, { type: "audio/webm" })
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      try {
        const msg = await api<Message>(`/conversations/${activeConversationId.value}/media`, {
          method: "POST",
          body: { data: base64, mimeType: "audio/webm", filename: `audio-${Date.now()}.webm` },
        })
        messages.value.push(msg)
        scrollToBottom()
        await loadConversations()
      } catch (err: any) {
        if (err?.data?.code === "WINDOW_CLOSED") sendError.value = err.data.error
      }
    }
    mediaRecorder.start()
    isRecording.value = true
  } catch {
    alert("Permissão de microfone negada ou não disponível.")
  }
}

// ── Conversation card dropdown ────────────────────────────────────────────────

function toggleConvMenu(id: string) {
  convMenuOpen.value = convMenuOpen.value === id ? null : id
}

async function quickFinish(conv: ConvSummary) {
  if (conv.status !== "OPEN") return
  try {
    await api(`/conversations/${conv.id}/status`, { method: "PATCH", body: { status: "RESOLVED" } })
    if (activeConversation.value?.id === conv.id) activeConversation.value.status = "RESOLVED"
    await loadConversations()
  } catch {}
}

async function deleteConv(conv: ConvSummary) {
  if (!confirm(`Apagar a conversa com ${conv.contact.name || conv.contact.phoneNumber}? Esta ação não pode ser desfeita.`)) return
  try {
    await api(`/conversations/${conv.id}`, { method: "DELETE" })
    if (activeConversationId.value === conv.id) {
      activeConversationId.value = null
      activeConversation.value = null
      messages.value = []
      disconnectSSE()
    }
    conversations.value = conversations.value.filter((c) => c.id !== conv.id)
  } catch {}
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

async function openRepliesPicker() {
  if (savedReplies.value.length === 0) {
    loadingReplies.value = true
    try { savedReplies.value = await api<{ id: string; title: string; content: string }[]>("/saved-replies") } catch {}
    loadingReplies.value = false
  }
  repliesSearch.value = ""
  showRepliesPicker.value = !showRepliesPicker.value
}

function insertReply(content: string) {
  inputText.value = content
  showRepliesPicker.value = false
  nextTick(() => {
    const el = document.querySelector<HTMLTextAreaElement>("textarea[placeholder]")
    el?.focus()
    if (el) {
      el.style.height = "auto"
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`
    }
  })
}

function closeMenuOnClickOutside() {
  convMenuOpen.value = null
  showPriorityMenu.value = false
  showRepliesPicker.value = false
}

onMounted(async () => {
  loadConversations()
  loadSidebarData()
  listInterval = setInterval(loadConversations, 8000)
  document.addEventListener("click", closeMenuOnClickOutside)

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {})
  }

  await heartbeat()
  await loadPresence()
  presenceInterval = setInterval(async () => {
    await heartbeat()
    await loadPresence()
  }, 45000)
})

onUnmounted(() => {
  clearInterval(listInterval!)
  clearInterval(presenceInterval!)
  disconnectSSE()
  document.removeEventListener("click", closeMenuOnClickOutside)
})
</script>
