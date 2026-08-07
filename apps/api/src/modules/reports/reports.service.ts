import { prisma, getCurrentCompanyId } from "@omnichannel/database";

type Period = "today" | "7d" | "30d" | "90d";

function getPeriodStart(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "7d":  return new Date(now.getTime() - 7  * 86_400_000);
    case "30d": return new Date(now.getTime() - 30 * 86_400_000);
    case "90d": return new Date(now.getTime() - 90 * 86_400_000);
    default:    return new Date(now.getTime() - 7  * 86_400_000);
  }
}

export class ReportsService {
  async getOverview(period: Period) {
    const companyId = getCurrentCompanyId();
    const since = getPeriodStart(period);

    const [totalConversations, openConversations, resolvedInPeriod, newContacts, resolvedForTime] =
      await Promise.all([
        prisma.conversation.count({ where: { createdAt: { gte: since } } }),
        prisma.conversation.count({ where: { status: "OPEN" } }),
        prisma.conversation.count({ where: { status: "RESOLVED", updatedAt: { gte: since } } }),
        prisma.contact.count({ where: { createdAt: { gte: since } } }),
        // fetch timestamps for avg resolution time computation (JS-side)
        prisma.conversation.findMany({
          where: { status: "RESOLVED", updatedAt: { gte: since } },
          select: { createdAt: true, updatedAt: true },
        }),
      ]);

    const avgResolutionMinutes =
      resolvedForTime.length > 0
        ? Math.round(
            resolvedForTime.reduce(
              (sum, c) => sum + (c.updatedAt.getTime() - c.createdAt.getTime()) / 60_000,
              0
            ) / resolvedForTime.length
          )
        : null;

    // Messages need raw SQL because they have no companyId column
    // Use an interactive transaction to SET LOCAL the RLS config first
    const [msgRow] = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      return tx.$queryRaw<{ inbound: bigint; outbound: bigint }[]>`
        SELECT
          COUNT(*) FILTER (WHERE m.direction = 'INBOUND')::bigint  AS inbound,
          COUNT(*) FILTER (WHERE m.direction = 'OUTBOUND' AND m.type != 'SYSTEM')::bigint AS outbound
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.company_id = ${companyId}
          AND m.created_at >= ${since}
      `;
    });

    return {
      totalConversations,
      openConversations,
      resolvedInPeriod,
      newContacts,
      messagesInbound:  Number(msgRow?.inbound  ?? 0),
      messagesOutbound: Number(msgRow?.outbound ?? 0),
      avgResolutionMinutes,
    };
  }

  async getVolume(period: Period) {
    const since = getPeriodStart(period);
    const now = new Date();

    const conversations = await prisma.conversation.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const countByDay = new Map<string, number>();
    for (const conv of conversations) {
      const day = conv.createdAt.toISOString().slice(0, 10);
      countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
    }

    // Fill every day from since → now, including zeros
    const days: { date: string; total: number }[] = [];
    const cursor = new Date(since);
    cursor.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(23, 59, 59, 999);

    while (cursor <= today) {
      const day = cursor.toISOString().slice(0, 10);
      days.push({ date: day, total: countByDay.get(day) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  async getAgents(period: Period) {
    const since = getPeriodStart(period);

    const [byAgent, resolvedByAgent] = await Promise.all([
      prisma.conversation.groupBy({
        by: ["assignedToId"],
        where: { createdAt: { gte: since }, assignedToId: { not: null } },
        _count: { _all: true },
      }),
      prisma.conversation.groupBy({
        by: ["assignedToId"],
        where: { createdAt: { gte: since }, status: "RESOLVED", assignedToId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const resolvedMap = new Map(resolvedByAgent.map((r) => [r.assignedToId, r._count._all]));
    const userIds = byAgent.map((g) => g.assignedToId!).filter(Boolean);

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return byAgent
      .map((g) => ({
        agentId:   g.assignedToId!,
        agentName: userMap.get(g.assignedToId!) ?? "Desconhecido",
        total:     g._count._all,
        resolved:  resolvedMap.get(g.assignedToId!) ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async getDepartments(period: Period) {
    const since = getPeriodStart(period);

    const [byDept, resolvedByDept] = await Promise.all([
      prisma.conversation.groupBy({
        by: ["departmentId"],
        where: { createdAt: { gte: since }, departmentId: { not: null } },
        _count: { _all: true },
      }),
      prisma.conversation.groupBy({
        by: ["departmentId"],
        where: { createdAt: { gte: since }, status: "RESOLVED", departmentId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const resolvedMap = new Map(resolvedByDept.map((r) => [r.departmentId, r._count._all]));
    const deptIds = byDept.map((g) => g.departmentId!).filter(Boolean);

    const departments = await prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    });
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    return byDept
      .map((g) => ({
        departmentId:   g.departmentId!,
        departmentName: deptMap.get(g.departmentId!) ?? "Sem departamento",
        total:          g._count._all,
        resolved:       resolvedMap.get(g.departmentId!) ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
  }
}
