import jwt from "jsonwebtoken";
import crypto from "node:crypto";

export type TokenType = "platform" | "tenant";

export interface BaseJwtPayload {
  sub: string;
  type: TokenType;
  role: string;
  email?: string;
}

export interface TenantJwtPayload extends BaseJwtPayload {
  type: "tenant";
  name: string;
  companyId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  departmentIds: string[];
  permissions: string[];
}

export interface PlatformJwtPayload extends BaseJwtPayload {
  type: "platform";
  name: string;
  role: "SUPER_ADMIN" | "SUPPORT";
}

export type CustomJwtPayload = TenantJwtPayload | PlatformJwtPayload;

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET não configurada");
  return secret;
}

/**
 * Access token: contém tudo que as rotas precisam para autorizar a
 * requisição (companyId, role, permissões já resolvidas) — assinado,
 * de curta duração (15min), nunca persistido no banco.
 */
export function signAccessToken(payload: Omit<TenantJwtPayload, "type">): string {
  const fullPayload: TenantJwtPayload = { type: "tenant", ...payload };
  return jwt.sign(fullPayload, getAccessSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function signPlatformAccessToken(payload: Omit<PlatformJwtPayload, "type">): string {
  const fullPayload: PlatformJwtPayload = { type: "platform", ...payload };
  return jwt.sign(fullPayload, getAccessSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

/**
 * Verifica e decodifica um access token. Lança se inválido/expirado.
 * Usado pelo tenant.middleware — substitui o `request.jwtVerify()`
 * do @fastify/jwt, que nunca foi de fato registrado no server.
 */
export function verifyAccessToken(token: string): CustomJwtPayload {
  return jwt.verify(token, getAccessSecret()) as CustomJwtPayload;
}

/**
 * Refresh token: opaco (não é JWT), gerado aleatoriamente e
 * armazenado no banco apenas como hash (nunca em texto puro) — se o
 * banco vazar, os tokens não são reutilizáveis diretamente.
 */
export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString("hex");
  return {
    token,
    hash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
