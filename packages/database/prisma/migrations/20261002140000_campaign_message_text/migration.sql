-- Campanhas: texto livre para canais que não usam template aprovado da Meta.

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "message_text" TEXT;

