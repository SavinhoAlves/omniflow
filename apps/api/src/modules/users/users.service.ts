import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@omnichannel/database";

const BCRYPT_ROUNDS = 12;

// Sem 0/O/1/I/l — caracteres fáceis de confundir quando o atendente
// digita a senha temporária que o admin te dá o cartão. Mantém
// aleatoriedade de crypto (não Math.random) porque é uma senha real,
// mesmo que descartável no primeiro login.
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateTemporaryPassword(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return password;
}

export class UsersService {
  async list() {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        userDepartments: { include: { department: { select: { name: true } } } },
      },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      departmentNames: user.userDepartments.map((ud) => ud.department.name),
    }));
  }

  /**
   * O sistema ainda não tem fluxo de convite por e-mail (nenhum
   * provider de envio configurado ainda), então o atendente nasce
   * com uma senha temporária gerada aqui — devolvida SÓ nesta
   * resposta de criação, nunca mais recuperável depois (a partir daí
   * só existe o hash no banco). A tela precisa mostrar isso pro
   * admin copiar/repassar, porque não há como reobter esse valor.
   */
  async create(input: {
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    departmentIds?: string[];
  }) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    // `departmentIds` vem do cliente — `department.findMany` roda
    // sob o Prisma middleware tenant-scoped (Department está na
    // TENANT_SCOPED_MODELS allowlist em client.ts), então IDs de
    // OUTRA empresa simplesmente não voltam aqui. O resultado é
    // usado (não o input bruto) pra criar os vínculos, então um
    // departmentId malicioso apontando pra outro tenant é
    // silenciosamente ignorado em vez de vazar/errar.
    const departmentIds = input.departmentIds ?? [];
    const validDepartments =
      departmentIds.length > 0
        ? await prisma.department.findMany({
            where: { id: { in: departmentIds } },
            select: { id: true },
          })
        : [];

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role,
        userDepartments: {
          create: validDepartments.map((dept) => ({ departmentId: dept.id })),
        },
      },
      include: {
        userDepartments: { include: { department: { select: { name: true } } } },
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      departmentNames: user.userDepartments.map((ud) => ud.department.name),
      // Único momento em que a senha em texto puro existe fora do
      // processo de hashing — nunca fica logada nem persistida.
      temporaryPassword,
    };
  }
}
