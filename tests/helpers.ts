import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { randomUUID } from "crypto";

const TEST_DATABASE_URL = `file:${process.cwd()}/prisma/test.db`;

let prisma: PrismaClient | null = null;

export async function getTestPrisma(): Promise<PrismaClient> {
  if (prisma) return prisma;

  process.env.DATABASE_URL = TEST_DATABASE_URL;
  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore",
  });

  prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  await prisma.$connect();
  return prisma;
}

export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.activityTarget.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.errorLog.deleteMany();
  await prisma.communication.deleteMany();
  await prisma.task.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.category.deleteMany();
}

export async function seedTestCategories(prisma: PrismaClient): Promise<void> {
  for (const name of ["Fiscal", "Laboral", "Contable", "Jurídico-Mercantil", "Administración"]) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
}

export async function createTestClient(
  prisma: PrismaClient,
  data: { name: string; email: string; taxId?: string }
): Promise<{ id: string; contactId: string }> {
  const client = await prisma.client.create({
    data: {
      name: data.name,
      taxId: data.taxId,
      contacts: { create: { channel: "Email", address: data.email.toLowerCase(), isPrimary: true } },
    },
    include: { contacts: true },
  });
  return { id: client.id, contactId: client.contacts[0].id };
}

export async function createTestTask(
  prisma: PrismaClient,
  clientId: string,
  title: string,
  extra?: Partial<{ area: string; status: string }>
): Promise<{ id: string }> {
  const task = await prisma.task.create({
    data: { clientId, title, area: extra?.area ?? "Fiscal", status: extra?.status ?? "Pendiente" },
  });
  return { id: task.id };
}

export function uniqueEmail(): string {
  return `test-${randomUUID().slice(0, 8)}@example.com`;
}
