"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";
import { parseCsv, toNumber } from "@/lib/csv";
import { round } from "@/lib/utils";

const ALLOWED = ["ADMIN", "MESS_MANAGER"] as const;

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

function refresh() {
  revalidatePath("/inventory");
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
}

export async function createIngredient(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/inventory");
  const name = str(fd, "name");
  if (!name) fail(path, "Ingredient name is required.");

  const openingQuantity = toNumber(str(fd, "openingQuantity"), 0);
  try {
    const ing = await prisma.ingredient.create({
      data: {
        name,
        category: str(fd, "category", "OTHER"),
        unit: str(fd, "unit", "kg"),
        minStock: toNumber(str(fd, "minStock"), 0),
        maxStock: toNumber(str(fd, "maxStock"), 100),
        shelfLifeDays: toNumber(str(fd, "shelfLifeDays"), 30),
        costPerUnit: toNumber(str(fd, "costPerUnit"), 0),
        supplierId: str(fd, "supplierId") || null,
      },
    });
    await prisma.inventoryItem.create({
      data: { ingredientId: ing.id, quantity: openingQuantity, lastRestockedAt: new Date() },
    });
    if (openingQuantity > 0) {
      await prisma.inventoryTransaction.create({
        data: { ingredientId: ing.id, type: "RECEIPT", quantity: openingQuantity, balanceAfter: openingQuantity, note: "Opening stock" },
      });
    }
  } catch {
    fail(path, `Could not create "${name}" — it may already exist.`);
  }
  refresh();
  success(path, `Ingredient "${name}" added.`);
}

export async function updateIngredient(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/inventory");
  const id = str(fd, "id");
  if (!id) fail(path, "Missing ingredient id.");
  await prisma.ingredient
    .update({
      where: { id },
      data: {
        name: str(fd, "name"),
        category: str(fd, "category"),
        unit: str(fd, "unit"),
        minStock: toNumber(str(fd, "minStock"), 0),
        maxStock: toNumber(str(fd, "maxStock"), 100),
        shelfLifeDays: toNumber(str(fd, "shelfLifeDays"), 30),
        costPerUnit: toNumber(str(fd, "costPerUnit"), 0),
        supplierId: str(fd, "supplierId") || null,
      },
    })
    .catch(() => fail(path, "Could not update ingredient."));
  refresh();
  success(path, "Ingredient updated.");
}

export async function deleteIngredient(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/inventory");
  const id = str(fd, "id");
  const used = await prisma.recipeIngredient.count({ where: { ingredientId: id } });
  if (used > 0) fail(path, `Cannot delete — used in ${used} recipe(s).`);
  await prisma.ingredient.delete({ where: { id } }).catch(() => fail(path, "Could not delete ingredient."));
  refresh();
  success(path, "Ingredient deleted.");
}

/** Adjust stock and record an auditable transaction. */
export async function adjustStock(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/inventory");
  const ingredientId = str(fd, "ingredientId");
  const type = str(fd, "type", "ADJUSTMENT");
  const quantity = toNumber(str(fd, "quantity"), 0);
  if (!ingredientId) fail(path, "Select an ingredient.");
  if (quantity === 0) fail(path, "Enter a non-zero quantity.");
  if (!["RECEIPT", "CONSUMPTION", "ADJUSTMENT", "WASTE"].includes(type)) fail(path, "Invalid transaction type.");

  const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId }, include: { inventory: true } });
  if (!ing) fail(path, "Ingredient not found.");

  // Receipts add stock; consumption/waste subtract. Adjustments can be signed.
  const signed = type === "RECEIPT" ? Math.abs(quantity) : type === "ADJUSTMENT" ? quantity : -Math.abs(quantity);
  const current = ing!.inventory?.quantity ?? 0;
  const next = round(Math.max(0, current + signed), 2);

  await prisma.$transaction([
    prisma.inventoryItem.upsert({
      where: { ingredientId },
      update: { quantity: next, lastRestockedAt: signed > 0 ? new Date() : undefined },
      create: { ingredientId, quantity: next, lastRestockedAt: signed > 0 ? new Date() : null },
    }),
    prisma.inventoryTransaction.create({
      data: {
        ingredientId,
        type,
        quantity: signed,
        balanceAfter: next,
        note: str(fd, "note") || null,
      },
    }),
  ]);

  refresh();
  success(path, `${type === "RECEIPT" ? "Received" : type === "CONSUMPTION" ? "Consumed" : "Adjusted"} ${Math.abs(quantity)} ${ing!.unit} of ${ing!.name}. New stock: ${next} ${ing!.unit}.`);
}

export async function importInventoryCsv(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/inventory");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) fail(path, "Please choose a CSV file.");
  const { rows } = parseCsv<Record<string, string>>(await (file as File).text());
  if (!rows.length) fail(path, "No rows found in the file.");

  let count = 0;
  const errors: string[] = [];
  for (const [i, r] of rows.entries()) {
    const name = (r.name ?? r.ingredient ?? "").trim();
    if (!name) {
      errors.push(`Row ${i + 2}: missing name`);
      continue;
    }
    const quantity = toNumber(r.quantity ?? r.stock, 0);
    const ing = await prisma.ingredient.upsert({
      where: { name },
      update: {
        category: (r.category ?? "OTHER").trim() || "OTHER",
        unit: (r.unit ?? "kg").trim() || "kg",
        minStock: toNumber(r.minStock, 0),
        maxStock: toNumber(r.maxStock, 100),
        costPerUnit: toNumber(r.costPerUnit, 0),
      },
      create: {
        name,
        category: (r.category ?? "OTHER").trim() || "OTHER",
        unit: (r.unit ?? "kg").trim() || "kg",
        minStock: toNumber(r.minStock, 0),
        maxStock: toNumber(r.maxStock, 100),
        costPerUnit: toNumber(r.costPerUnit, 0),
      },
    });
    await prisma.inventoryItem.upsert({
      where: { ingredientId: ing.id },
      update: { quantity },
      create: { ingredientId: ing.id, quantity, lastRestockedAt: new Date() },
    });
    count++;
  }
  refresh();
  success(path, `Imported ${count} inventory rows${errors.length ? `, ${errors.length} skipped` : ""}.`);
}
