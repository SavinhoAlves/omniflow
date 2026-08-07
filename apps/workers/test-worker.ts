import { tenantStorage, prisma } from "@omnichannel/database";

async function testQuery() {
  console.log("Testing DB connection...");
  const rows = await (prisma as any).$queryRawUnsafe("SELECT current_user as u");
  console.log("DB user:", rows);

  console.log("Testing instance lookup in isPlatform context...");
  const instance = await tenantStorage.run({ isPlatform: true }, async () => {
    return await prisma.whatsAppInstance.findFirst({
      where: { id: "c044b22c-3c43-4db8-928d-3b1f2596625e" },
      select: { id: true, companyId: true }
    });
  });
  console.log("Instance:", instance ? `found (companyId=${instance.companyId})` : "NULL - RLS blocking or not found");
}

testQuery().catch(e => { console.error("ERROR:", e.message); }).finally(() => process.exit(0));
