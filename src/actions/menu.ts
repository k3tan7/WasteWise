"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";
import { toNumber } from "@/lib/csv";
import { addDays, startOfDay } from "@/lib/utils";

const ALLOWED = ["ADMIN", "MESS_MANAGER"] as const;

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

function refresh() {
  revalidatePath("/menu");
  revalidatePath("/meals");
  revalidatePath("/predictions");
  revalidatePath("/dashboard");
  revalidatePath("/purchases");
  revalidatePath("/inventory");
}

type RecipeRow = { ingredientId: string; quantityPerServing: number; unit?: string };

function parseRecipe(raw: string): RecipeRow[] {
  try {
    const parsed = JSON.parse(raw || "[]") as RecipeRow[];
    return parsed.filter((r) => r.ingredientId && Number.isFinite(Number(r.quantityPerServing)) && Number(r.quantityPerServing) > 0);
  } catch {
    return [];
  }
}

export async function createDish(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/menu");
  const name = str(fd, "name");
  if (!name) fail(path, "Dish name is required.");

  const rows = parseRecipe(str(fd, "recipe"));
  try {
    const dish = await prisma.dish.create({
      data: {
        name,
        category: str(fd, "category", "MAIN"),
        description: str(fd, "description") || null,
        portionSizeG: toNumber(str(fd, "portionSizeG"), 150),
        estCostPerServing: toNumber(str(fd, "estCostPerServing"), 10),
        recipe: rows.length
          ? {
              create: {
                instructions: str(fd, "instructions") || null,
                items: { create: rows.map((r) => ({ ingredientId: r.ingredientId, quantityPerServing: Number(r.quantityPerServing), unit: r.unit || "kg" })) },
              },
            }
          : undefined,
      },
    });
    void dish;
  } catch {
    fail(path, `Could not create dish — "${name}" may already exist.`);
  }
  refresh();
  success(path, `Dish "${name}" created.`);
}

export async function updateDish(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/menu");
  const id = str(fd, "id");
  if (!id) fail(path, "Missing dish id.");
  const rows = parseRecipe(str(fd, "recipe"));

  try {
    await prisma.dish.update({
      where: { id },
      data: {
        name: str(fd, "name"),
        category: str(fd, "category", "MAIN"),
        description: str(fd, "description") || null,
        portionSizeG: toNumber(str(fd, "portionSizeG"), 150),
        estCostPerServing: toNumber(str(fd, "estCostPerServing"), 10),
      },
    });
    if (rows.length) {
      const recipe = await prisma.recipe.upsert({
        where: { dishId: id },
        update: { instructions: str(fd, "instructions") || null },
        create: { dishId: id, instructions: str(fd, "instructions") || null },
      });
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
      await prisma.recipeIngredient.createMany({
        data: rows.map((r) => ({ recipeId: recipe.id, ingredientId: r.ingredientId, quantityPerServing: Number(r.quantityPerServing), unit: r.unit || "kg" })),
      });
    }
  } catch {
    fail(path, "Could not update dish.");
  }
  refresh();
  success(path, "Dish updated.");
}

export async function deleteDish(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/menu");
  const id = str(fd, "id");
  const used = await prisma.menuItem.count({ where: { dishId: id } });
  if (used > 0) fail(path, `Cannot delete — this dish appears on ${used} menu(s). Remove it from menus first.`);
  await prisma.dish.delete({ where: { id } }).catch(() => fail(path, "Could not delete dish."));
  refresh();
  success(path, "Dish deleted.");
}

/* -------------------------------------------------------------------------- */
/* Menus                                                                       */
/* -------------------------------------------------------------------------- */
export async function createMenu(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/menu");
  const dateRaw = str(fd, "date");
  const mealType = str(fd, "mealType", "LUNCH");
  const date = dateRaw ? startOfDay(new Date(dateRaw)) : null;
  if (!date || Number.isNaN(date.getTime())) fail(path, "A valid date is required.");
  const dishIds = fd.getAll("dishIds").map(String).filter(Boolean);
  if (!dishIds.length) fail(path, "Select at least one dish for the menu.");

  try {
    const existing = await prisma.menu.findUnique({ where: { date_mealType: { date: date!, mealType } } });
    if (existing) {
      await prisma.menu.update({
        where: { id: existing.id },
        data: { name: str(fd, "name") || existing.name, published: str(fd, "published") === "on" },
      });
      await prisma.menuItem.deleteMany({ where: { menuId: existing.id } });
      await prisma.menuItem.createMany({ data: dishIds.map((dishId) => ({ menuId: existing.id, dishId })) });
    } else {
      await prisma.menu.create({
        data: {
          date: date!,
          mealType,
          name: str(fd, "name") || `${mealType.charAt(0) + mealType.slice(1).toLowerCase()} menu`,
          published: str(fd, "published") === "on",
          items: { create: dishIds.map((dishId) => ({ dishId })) },
        },
      });
    }
  } catch {
    fail(path, "Could not save menu.");
  }
  refresh();
  success(path, `Menu saved for ${dateRaw} · ${mealType}.`);
}

export async function deleteMenu(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/menu");
  const id = str(fd, "id");
  await prisma.menu.delete({ where: { id } }).catch(() => fail(path, "Could not delete menu."));
  refresh();
  success(path, "Menu deleted.");
}

export async function duplicateMenu(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/menu");
  const sourceId = str(fd, "sourceId");
  const targetMealType = str(fd, "targetMealType");
  const source = await prisma.menu.findUnique({ where: { id: sourceId }, include: { items: true } });
  if (!source) fail(path, "Source menu not found.");

  const targetDate = source!.date;
  const mealType = targetMealType || source!.mealType;
  await prisma.menu.upsert({
    where: { date_mealType: { date: targetDate, mealType } },
    update: { items: { deleteMany: {}, create: source!.items.map((i) => ({ dishId: i.dishId })) } },
    create: {
      date: targetDate,
      mealType,
      name: `${mealType.charAt(0) + mealType.slice(1).toLowerCase()} menu (copy)`,
      published: true,
      items: { create: source!.items.map((i) => ({ dishId: i.dishId })) },
    },
  });
  refresh();
  success(path, `Duplicated menu to ${mealType}.`);
}

/** Duplicate yesterday's menu for the same meal onto tomorrow. */
export async function duplicatePreviousDay(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/menu");
  const mealType = str(fd, "mealType", "LUNCH");
  const toDate = startOfDay(new Date(str(fd, "date") || Date.now()));
  const fromDate = addDays(toDate, -1);
  const source = await prisma.menu.findUnique({ where: { date_mealType: { date: fromDate, mealType } }, include: { items: true } });
  if (!source) fail(path, `No ${mealType.toLowerCase()} menu found for the previous day.`);
  await prisma.menu.upsert({
    where: { date_mealType: { date: toDate, mealType } },
    update: { items: { deleteMany: {}, create: source!.items.map((i) => ({ dishId: i.dishId })) } },
    create: {
      date: toDate,
      mealType,
      name: `${mealType.charAt(0) + mealType.slice(1).toLowerCase()} menu (copy)`,
      published: true,
      items: { create: source!.items.map((i) => ({ dishId: i.dishId })) },
    },
  });
  refresh();
  success(path, `Copied the previous day's ${mealType.toLowerCase()} menu.`);
}
