import { PrismaClient, UserRole, PlatformRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Iniciando o processo de seed do banco de dados...');

  // 1. Criar ou atualizar a Empresa de Demonstração (Company - Tenant)
  const demoCompany = await prisma.company.upsert({
    where: { slug: 'empresa-demonstrativa' },
    update: { name: 'Empresa Demonstrativa' },
    create: {
      name: 'Empresa Demonstrativa',
      slug: 'empresa-demonstrativa',
      cnpj: '00000000000191',
    },
  });

  console.log(`[Company] Empresa demonstrativa criada/atualizada: ${demoCompany.name} (${demoCompany.id})`);

  // 2. Criar ou atualizar o Super Admin da Plataforma (PlatformUser).
  // O Super Admin não pertence a nenhuma empresa — é um usuário da
  // plataforma (ver model PlatformUser), não um User de tenant.
  const platformPasswordHash = await bcrypt.hash('123456', 10);

  const superAdmin = await prisma.platformUser.upsert({
    where: { email: 'admin@omniflow.local' },
    update: {
      name: 'Super Admin',
      passwordHash: platformPasswordHash,
      role: PlatformRole.SUPER_ADMIN,
    },
    create: {
      name: 'Super Admin',
      email: 'admin@omniflow.local',
      passwordHash: platformPasswordHash,
      role: PlatformRole.SUPER_ADMIN,
    },
  });

  console.log(`[PlatformUser] Super Admin verificado: ${superAdmin.email}`);

  const tenantPasswordHash = await bcrypt.hash('123456', 10);

  const allPermissions = [
    { resource: 'conversations', action: 'view_own' },
    { resource: 'conversations', action: 'view_department' },
    { resource: 'conversations', action: 'view_all' },
    { resource: 'conversations', action: 'transfer' },
    { resource: 'conversations', action: 'close' },
    { resource: 'whatsapp', action: 'manage_instances' },
    { resource: 'whatsapp', action: 'view_instances' },
    { resource: 'users', action: 'manage' },
    { resource: 'departments', action: 'manage' },
    { resource: 'workflows', action: 'manage' },
    { resource: 'workflows', action: 'view' },
    { resource: 'campaigns', action: 'create' },
    { resource: 'campaigns', action: 'view' },
    { resource: 'reports', action: 'view' },
    { resource: 'billing', action: 'manage' },
    { resource: 'settings', action: 'manage' },
  ];

  // All writes to RLS-protected tables must run inside an interactive transaction
  // with app.current_company_id set so the policy allows the rows.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_company_id = '${demoCompany.id}'`);

    // 3. Usuário Administrador da Empresa (User - Tenant Owner)
    const tenantOwner = await tx.user.upsert({
      where: { companyId_email: { companyId: demoCompany.id, email: 'tenant@omniflow.local' } },
      update: { name: 'Tenant Owner', passwordHash: tenantPasswordHash, role: UserRole.OWNER },
      create: {
        companyId: demoCompany.id,
        name: 'Tenant Owner',
        email: 'tenant@omniflow.local',
        passwordHash: tenantPasswordHash,
        role: UserRole.OWNER,
      },
    });

    console.log(`[User] Usuário OWNER verificado: ${tenantOwner.email} (empresa: ${demoCompany.slug})`);

    // 4. Departamento Padrão (Department)
    const existingDepartment = await tx.department.findFirst({
      where: { companyId: demoCompany.id, name: 'Atendimento Geral' },
    });

    const defaultDepartment = existingDepartment
      ?? await tx.department.create({
          data: {
            companyId: demoCompany.id,
            name: 'Atendimento Geral',
            description: 'Departamento padrão para distribuição de chamados e conversas',
            isDefault: true,
          },
        });

    console.log(`[Department] Departamento verificado: ${defaultDepartment.name}`);

    // 5. Vínculo Usuário-Departamento (UserDepartment)
    await tx.userDepartment.upsert({
      where: { userId_departmentId: { userId: tenantOwner.id, departmentId: defaultDepartment.id } },
      update: {},
      create: { userId: tenantOwner.id, departmentId: defaultDepartment.id, isManager: true },
    });

    console.log(`[UserDepartment] Vínculo estabelecido com sucesso.`);

    // 6. Permissões da role OWNER (RolePermission)
    for (const perm of allPermissions) {
      await tx.rolePermission.upsert({
        where: {
          companyId_role_resource_action: {
            companyId: demoCompany.id,
            role: UserRole.OWNER,
            resource: perm.resource,
            action: perm.action,
          },
        },
        update: {},
        create: {
          companyId: demoCompany.id,
          role: UserRole.OWNER,
          resource: perm.resource,
          action: perm.action,
        },
      });
    }

    console.log(`[RolePermission] Permissões padrão para a role OWNER configuradas.`);
  });

  console.log('Concluído com sucesso o seed do banco de dados.');
}

main()
  .catch((error: unknown) => {
    console.error('Erro ao executar o seed do banco de dados:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
