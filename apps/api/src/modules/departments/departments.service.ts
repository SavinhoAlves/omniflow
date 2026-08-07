import { prisma } from "@omnichannel/database";

export class DepartmentsService {
  /**
   * `memberCount` é o que a tela de Departamentos exibe (ver
   * apps/client/pages/departments/index.vue) — contagem via
   * `_count` em vez de carregar a lista inteira de userDepartments,
   * bem mais barato pra uma tela de listagem.
   */
  async list() {
    const departments = await prisma.department.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { userDepartments: true } },
      },
    });

    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      description: dept.description,
      isDefault: dept.isDefault,
      memberCount: dept._count.userDepartments,
    }));
  }

  async create(input: { name: string; description?: string; isDefault?: boolean }) {
    // Só pode existir um departamento padrão por empresa — se este
    // for marcado como default, desmarca o anterior primeiro. Feito
    // em transação pra nunca deixar dois (ou zero, se a query
    // seguinte falhar) marcados como default ao mesmo tempo.
    if (input.isDefault) {
      return prisma.$transaction(async (tx) => {
        await tx.department.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
        return tx.department.create({
          data: {
            name: input.name,
            description: input.description,
            isDefault: true,
          },
        });
      });
    }

    return prisma.department.create({
      data: {
        name: input.name,
        description: input.description,
        isDefault: false,
      },
    });
  }

  async update(
    id: string,
    input: { name?: string; description?: string; isDefault?: boolean }
  ) {
    if (input.isDefault) {
      return prisma.$transaction(async (tx) => {
        await tx.department.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        return tx.department.update({
          where: { id },
          data: input,
        });
      });
    }

    return prisma.department.update({
      where: { id },
      data: input,
    });
  }
}
