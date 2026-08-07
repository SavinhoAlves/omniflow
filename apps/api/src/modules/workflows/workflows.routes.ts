import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../shared/permissions.catalog";
import { WorkflowsService, WorkflowValidationError } from "./workflows.service";

const ruleSchema = z.object({
  optionLabel: z.string().min(1),
  departmentId: z.string().uuid(),
});

const upsertSchema = z.object({
  enabled: z.boolean(),
  welcomeMessage: z.string().optional().nullable(),
  // O frontend manda "" quando nenhum departamento de fallback foi
  // escolhido ainda (ver <select> em workflows/index.vue) — trata
  // como "nenhum" em vez de falhar a validação de uuid.
  fallbackDepartmentId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .nullable(),
  rules: z.array(ruleSchema),
});

export async function workflowsRoutes(app: FastifyInstance) {
  const service = new WorkflowsService();

  app.get(
    "/workflows/default",
    { preHandler: requirePermission(PERMISSIONS.WORKFLOWS_VIEW) },
    async (_request, reply) => {
      const workflow = await service.getDefault();
      // 200 com null (não 404): a tela já sabe lidar com "nenhum
      // fluxo salvo ainda" e monta um rascunho a partir dos
      // departamentos existentes (ver loadData() no .vue) — um 404
      // aqui derrubaria esse fallback via Promise.allSettled.
      return reply.send(workflow);
    }
  );

  app.put(
    "/workflows/default",
    { preHandler: requirePermission(PERMISSIONS.WORKFLOWS_MANAGE) },
    async (request, reply) => {
      const body = upsertSchema.parse(request.body);
      try {
        const workflow = await service.upsertDefault({
          enabled: body.enabled,
          welcomeMessage: body.welcomeMessage,
          fallbackDepartmentId: body.fallbackDepartmentId || null,
          rules: body.rules,
        });
        return reply.send(workflow);
      } catch (err) {
        if (err instanceof WorkflowValidationError) {
          return reply.status(422).send({ error: err.message });
        }
        throw err;
      }
    }
  );
}
