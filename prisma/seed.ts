import { PrismaClient } from "@prisma/client";
import { SENTINEL_CLIENT_NAME } from "../lib/sentinel-client";

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  "Fiscal",
  "Laboral",
  "Contable",
  "Jurídico-Mercantil",
  "Administración",
];

async function main() {
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, active: true },
    });
  }

  // Cliente sentinela para procesar comunicaciones sin cliente identificado.
  // Permite crear Task y subir adjuntos sin asignar un cliente real.
  // No se sincroniza con Notion (notionPageId=null).
  const existing = await prisma.client.findFirst({
    where: { name: SENTINEL_CLIENT_NAME, notionPageId: null },
  });
  if (!existing) {
    await prisma.client.create({
      data: {
        name: SENTINEL_CLIENT_NAME,
        aliases: "[]",
        areas: "[]",
        status: "Activo",
        assignee: null,
        email: null,
        taxId: null,
        notionPageId: null,
      },
    });
  }

  console.log("Categories and sentinel client seeded");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
