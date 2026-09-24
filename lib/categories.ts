import { prisma } from "@/lib/prisma";

export async function getActiveCategories(): Promise<string[]> {
  const cats = await prisma.category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return cats.map((c) => c.name);
}
