import { prisma, getCurrentCompanyId, Prisma } from "@omnichannel/database";

export class WorkflowValidationError extends Error {}

interface RuleInput {
  optionLabel: string;
  departmentId: string;
}

interface UpsertWorkflowInput {
  enabled: boolean;
  welcomeMessage?: string | null;
  fallbackDepartmentId?: string | null;
  rules: RuleInput[];
}

export class WorkflowsService {
  /**
   * Formato de resposta espelha exatamente o `reactive(workflow)` do
   * frontend (ver apps/client/pages/workflows/index.vue) — cada
   * regra devolve `key` (usado no `:key="rule.key"` do v-for; sem
   * isso o Vue reconciliaria a lista pela posição do array e
   * quebraria o binding ao editar/remover uma regra do meio). Usamos
   * o próprio `id` da linha como key — é estável entre saves,
   * diferente de gerar um novo Math.random() a cada load.
   */
  async getDefault() {
    const companyId = getCurrentCompanyId();

    const workflow = await prisma.workflow.findFirst({
      where: { companyId },
      include: { rules: { orderBy: { position: "asc" } } },
    });

    if (!workflow) return null;

    return this.toResponse(workflow);
  }

  async upsertDefault(input: UpsertWorkflowInput) {
    const companyId = getCurrentCompanyId();

    await this.assertDepartmentsBelongToTenant(
      [
        input.fallbackDepartmentId,
        ...input.rules.map((rule) => rule.departmentId),
      ].filter((id): id is string => Boolean(id))
    );

    const workflow = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const saved = await tx.workflow.upsert({
        where: { companyId },
        create: {
          companyId,
          enabled: input.enabled,
          welcomeMessage: input.welcomeMessage ?? null,
          fallbackDepartmentId: input.fallbackDepartmentId ?? null,
        },
        update: {
          enabled: input.enabled,
          welcomeMessage: input.welcomeMessage ?? null,
          fallbackDepartmentId: input.fallbackDepartmentId ?? null,
        },
      });

      // Estratégia "replace all": mais simples e segura que tentar
      // diffar regras existentes vs. recebidas (a tela manda a lista
      // inteira a cada save, não deltas) — apaga e recria na mesma
      // transação, então nunca existe um estado intermediário sem
      // regras se algo falhar no meio.
      await tx.workflowRule.deleteMany({ where: { workflowId: saved.id } });

      if (input.rules.length > 0) {
        await tx.workflowRule.createMany({
          data: input.rules.map((rule, index) => ({
            workflowId: saved.id,
            position: index,
            optionLabel: rule.optionLabel,
            departmentId: rule.departmentId,
          })),
        });
      }

      return tx.workflow.findUniqueOrThrow({
        where: { id: saved.id },
        include: { rules: { orderBy: { position: "asc" } } },
      });
    });

    return this.toResponse(workflow);
  }

  /**
   * WorkflowRule.departmentId e Workflow.fallbackDepartmentId são
   * FKs "cruas" pro Postgres — a constraint de FK só garante que o
   * departamento EXISTE em algum lugar do banco, não que ele
   * pertence à empresa de quem está salvando o fluxo. Sem esta
   * checagem, um departmentId de OUTRA empresa passaria pela FK sem
   * erro nenhum (Department não é filtrado por tenant no nível da
   * constraint, só nas queries via o middleware do Prisma). Faz a
   * mesma verificação buscando os departamentos através do client
   * tenant-scoped: qualquer id que não voltar aqui não pertence a
   * este tenant.
   */
  private async assertDepartmentsBelongToTenant(departmentIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(departmentIds));
    if (uniqueIds.length === 0) return;

    const found = await prisma.department.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    if (found.length !== uniqueIds.length) {
      throw new WorkflowValidationError(
        "Um ou mais departamentos informados não existem ou não pertencem a esta empresa"
      );
    }
  }

  private toResponse(
    workflow: Prisma.WorkflowGetPayload<{ include: { rules: true } }>
  ) {
    return {
      enabled: workflow.enabled,
      welcomeMessage: workflow.welcomeMessage ?? "",
      fallbackDepartmentId: workflow.fallbackDepartmentId ?? "",
      rules: workflow.rules
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((rule) => ({
          key: rule.id,
          optionLabel: rule.optionLabel,
          departmentId: rule.departmentId,
        })),
    };
  }
}
