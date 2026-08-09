interface FlowNode {
  id: string;
  type: string;
  data: {
    text?: string;
    options?: Array<{ id: string; label: string }>;
    actionType?: "set_department" | "end";
    departmentId?: string;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  sourceHandle?: string | null;
  target: string;
}

export interface BotResult {
  messages: string[];
  nextBotNodeId: string | null;
  departmentId?: string;
  endConversation?: boolean;
}

/**
 * Executa o fluxo de bot a partir de um nó inicial.
 *
 * - `startNodeId`: "start" para nova conversa, ou o ID do nó de menu
 *   onde o bot estava pausado esperando input do usuário.
 * - `userText`: texto enviado pelo usuário. Usado apenas para resolver
 *   a seleção quando `startNodeId` aponta para um nó de menu.
 *
 * Retorna os textos a enviar e o próximo estado do bot:
 * - `nextBotNodeId = null` → bot terminou (humano assume ou conversa encerrada)
 * - `nextBotNodeId = <id>` → bot pausado num menu, aguardando resposta
 */
export function runBotFlow(params: {
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];
  startNodeId: string;
  userText?: string;
}): BotResult {
  const { flowNodes, flowEdges, startNodeId, userText } = params;

  const nodeMap = new Map(flowNodes.map((n) => [n.id, n] as [string, FlowNode]));

  const messages: string[] = [];
  let departmentId: string | undefined;
  let endConversation = false;

  function nextNodeId(fromId: string, handleId?: string | null): string | undefined {
    const edge = flowEdges.find(
      (e) => e.source === fromId && (handleId == null || e.sourceHandle === handleId),
    );
    return edge?.target;
  }

  let currentId: string | undefined = startNodeId;
  let iterations = 0;
  const MAX_ITER = 50; // guarda contra loops infinitos no fluxo

  while (currentId && iterations++ < MAX_ITER) {
    const node = nodeMap.get(currentId);
    if (!node) break;

    switch (node.type) {
      case "start": {
        currentId = nextNodeId(node.id);
        break;
      }

      case "message": {
        if (node.data.text?.trim()) {
          messages.push(node.data.text.trim());
        }
        currentId = nextNodeId(node.id);
        break;
      }

      case "menu": {
        const options = node.data.options ?? [];

        // Se chegamos NESTE nó como ponto de entrada E há texto do usuário,
        // interpretamos como seleção do menu.
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
            // Seleção inválida — reenvia o menu
            messages.push(buildMenuText(node));
            return { messages, nextBotNodeId: node.id };
          }
        } else {
          // Primeira vez que chegamos ao menu — envia e pausa
          messages.push(buildMenuText(node));
          return { messages, nextBotNodeId: node.id };
        }
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

function buildMenuText(node: FlowNode): string {
  const header = node.data.text?.trim() ?? "";
  const lines = (node.data.options ?? []).map((o, i) => `${i + 1}. ${o.label}`);
  return header ? `${header}\n\n${lines.join("\n")}` : lines.join("\n");
}
