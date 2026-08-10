interface FlowNode {
  id: string;
  type: string;
  data: {
    text?: string;
    options?: Array<{ id: string; label: string }>;
    actionType?: "set_department" | "end";
    departmentId?: string;
    delayMs?: number;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  sourceHandle?: string | null;
  target: string;
}

// Mensagem rica: pode ser texto simples, menu interativo ou marcador de atraso
export interface BotMessage {
  text: string;
  delayMs: number;
  isMenu: boolean;
  isDelay?: boolean;
  menuOptions?: { id: string; label: string }[];
}

export interface BotResult {
  messages: BotMessage[];
  nextBotNodeId: string | null;
  departmentId?: string;
  endConversation?: boolean;
}

/**
 * Executa o fluxo de bot a partir de um nó inicial.
 *
 * `variables` é um dicionário de substituição para placeholders {nome}, {telefone} etc.
 */
export function runBotFlow(params: {
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];
  startNodeId: string;
  userText?: string;
  variables?: Record<string, string>;
}): BotResult {
  const { flowNodes, flowEdges, startNodeId, userText, variables = {} } = params;

  const nodeMap = new Map(flowNodes.map((n) => [n.id, n] as [string, FlowNode]));

  const messages: BotMessage[] = [];
  let departmentId: string | undefined;
  let endConversation = false;

  // Substitui {variavel} pelo valor correspondente no dicionário
  function interpolate(text: string): string {
    return text.replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
  }

  function nextNodeId(fromId: string, handleId?: string | null): string | undefined {
    const edge = flowEdges.find(
      (e) => e.source === fromId && (handleId == null || e.sourceHandle === handleId),
    );
    return edge?.target;
  }

  let currentId: string | undefined = startNodeId;
  let iterations = 0;
  const MAX_ITER = 50;

  while (currentId && iterations++ < MAX_ITER) {
    const node = nodeMap.get(currentId);
    if (!node) break;

    switch (node.type) {
      case "start": {
        currentId = nextNodeId(node.id);
        break;
      }

      case "message": {
        const raw = node.data.text?.trim() ?? "";
        if (raw) {
          messages.push({
            text: interpolate(raw),
            delayMs: node.data.delayMs ?? 0,
            isMenu: false,
          });
        }
        currentId = nextNodeId(node.id);
        break;
      }

      case "menu": {
        const options = (node.data.options ?? []).filter((o) => o.label?.trim());

        if (userText != null && currentId === startNodeId) {
          const trimmed = userText.trim();
          const numChoice = parseInt(trimmed, 10);

          let chosen = !isNaN(numChoice) ? options[numChoice - 1] : undefined;

          if (!chosen) {
            const lower = trimmed.toLowerCase();
            chosen = options.find(
              (o) =>
                o.label.toLowerCase() === lower ||
                o.label.toLowerCase().startsWith(lower),
            );
          }

          if (chosen) {
            currentId = nextNodeId(node.id, chosen.id);
          } else {
            // Seleção inválida — reenvia o menu como interativo
            messages.push(buildMenuMessage(node, options));
            return { messages, nextBotNodeId: node.id };
          }
        } else {
          // Primeira vez que chegamos ao menu — envia e pausa
          messages.push(buildMenuMessage(node, options));
          return { messages, nextBotNodeId: node.id };
        }
        break;
      }

      case "timer": {
        const delayMs = node.data.delayMs ?? 0;
        if (delayMs > 0) {
          messages.push({ text: "", delayMs, isMenu: false, isDelay: true });
        }
        currentId = nextNodeId(node.id);
        break;
      }

      case "action": {
        if (node.data.actionType === "set_department" && node.data.departmentId) {
          departmentId = node.data.departmentId;
        } else if (node.data.actionType === "end") {
          endConversation = true;
        }
        currentId = nextNodeId(node.id);
        break;
      }

      default: {
        currentId = undefined;
        break;
      }
    }
  }

  return { messages, nextBotNodeId: null, departmentId, endConversation };
}

function buildMenuMessage(node: FlowNode, options: { id: string; label: string }[]): BotMessage {
  const header = node.data.text?.trim() ?? "";
  // Fallback em texto puro (caso Baileys não suporte lista)
  const lines = options.map((o, i) => `${i + 1}. ${o.label}`);
  const text = header ? `${header}\n\n${lines.join("\n")}` : lines.join("\n");
  return {
    text,
    delayMs: node.data.delayMs ?? 0,
    isMenu: true,
    menuOptions: options,
  };
}
