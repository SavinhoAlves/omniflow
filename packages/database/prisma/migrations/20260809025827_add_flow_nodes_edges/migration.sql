-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "flow_edges" JSONB,
ADD COLUMN     "flow_nodes" JSONB;
