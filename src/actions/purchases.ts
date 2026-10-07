"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";
import { toNumber } from "@/lib/csv";
import { startOfDay } from "@/lib/utils";
import { buildPurchasePlan } from "@/lib/services/plan";

const ALLOWED = ["ADMIN", "MESS_MANAGER"] as const;

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

function refresh() {
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

/** Recompute the plan from upcoming menus and store a fresh recommendation set. */
export async function generateRecommendations(fd: FormData) {
  const user = await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/purchases");
  const date = startOfDay(new Date(str(fd, "date") || Date.now()));
  const horizon = Math.max(1, Math.min(14, toNumber(str(fd, "horizonDays"), 4)));

  const { plan, forecastSource } = await buildPurchasePlan(date, horizon);
  const actionable = plan.rows.filter((r) => r.recommendedQty > 0);

  // Replace only the pending recommendations for this date — decisions already
  // made (approved/rejected/converted) are preserved as an audit trail.
  await prisma.purchaseRecommendation.deleteMany({ where: { date, status: "PENDING" } });

  if (actionable.length) {
    await prisma.purchaseRecommendation.createMany({
      data: actionable.map((r) => ({
        date,
        ingredientId: r.ingredientId,
        requiredQty: r.requiredQty,
        currentStock: r.currentStock,
        safetyStock: r.safetyStock,
        recommendedQty: r.recommendedQty,
        reason: r.reason,
        status: "PENDING",
      })),
    });
  }

  void forecastSource;
  void user;
  refresh();
  success(
    path,
    actionable.length
      ? `Generated ${actionable.length} purchase recommendation(s) for a ${horizon}-day horizon.`
      : `No purchases needed — existing stock covers the next ${horizon} days.`
  );
}

export async function decideRecommendation(fd: FormData) {
  const user = await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/purchases");
  const id = str(fd, "id");
  const decision = str(fd, "decision");
  const rec = await prisma.purchaseRecommendation.findUnique({ where: { id } });
  if (!rec) fail(path, "Recommendation not found.");

  if (decision === "APPROVE" || decision === "MODIFY") {
    const finalQty = decision === "MODIFY" ? toNumber(str(fd, "finalQty"), rec!.recommendedQty) : rec!.recommendedQty;
    if (finalQty < 0) fail(path, "Quantity cannot be negative.");
    await prisma.purchaseRecommendation.update({
      where: { id },
      data: { status: decision === "MODIFY" ? "MODIFIED" : "APPROVED", finalQty, decidedBy: user.name, decidedAt: new Date() },
    });
    refresh();
    success(path, decision === "MODIFY" ? `Recommendation modified to ${finalQty}.` : "Recommendation approved.");
  }

  if (decision === "REJECT") {
    await prisma.purchaseRecommendation.update({
      where: { id },
      data: { status: "REJECTED", decidedBy: user.name, decidedAt: new Date() },
    });
    refresh();
    success(path, "Recommendation rejected.");
  }

  fail(path, "Unknown decision.");
}

export async function convertToOrder(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/purchases");
  const id = str(fd, "id");
  const rec = await prisma.purchaseRecommendation.findUnique({ where: { id }, include: { ingredient: true } });
  if (!rec) fail(path, "Recommendation not found.");
  if (rec!.purchaseOrderId) fail(path, "A purchase order already exists for this recommendation.");

  const quantity = rec!.finalQty ?? rec!.recommendedQty;
  if (quantity <= 0) fail(path, "Nothing to order.");

  const code = `PO-${new Date().getFullYear()}-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;
  const order = await prisma.purchaseOrder.create({
    data: {
      code,
      supplierId: rec!.ingredient.supplierId,
      ingredientId: rec!.ingredientId,
      quantity,
      unitCost: rec!.ingredient.costPerUnit,
      totalCost: Math.round(quantity * rec!.ingredient.costPerUnit * 100) / 100,
      status: "ORDERED",
      expectedAt: new Date(Date.now() + 2 * 86400000),
      notes: `From recommendation ${rec!.id.slice(-6)}`,
    },
  });
  await prisma.purchaseRecommendation.update({
    where: { id },
    data: { status: "CONVERTED", purchaseOrderId: order.id, finalQty: quantity },
  });
  refresh();
  success(path, `Purchase order ${code} created for ${quantity} ${rec!.ingredient.unit} of ${rec!.ingredient.name}.`);
}

/** Receive (or cancel) a purchase order, updating inventory on receipt. */
export async function updateOrderStatus(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/purchases");
  const id = str(fd, "id");
  const action = str(fd, "action");
  const order = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!order) fail(path, "Purchase order not found.");

  if (action === "receive") {
    const receivedQty = toNumber(str(fd, "receivedQty"), order!.quantity);
    const inventory = await prisma.inventoryItem.findUnique({ where: { ingredientId: order!.ingredientId } });
    const current = inventory?.quantity ?? 0;
    const next = current + receivedQty;
    await prisma.$transaction([
      prisma.inventoryItem.upsert({
        where: { ingredientId: order!.ingredientId },
        update: { quantity: next, lastRestockedAt: new Date() },
        create: { ingredientId: order!.ingredientId, quantity: next, lastRestockedAt: new Date() },
      }),
      prisma.inventoryTransaction.create({
        data: { ingredientId: order!.ingredientId, type: "RECEIPT", quantity: receivedQty, balanceAfter: next, note: `Received ${order!.code}`, refType: "PO", refId: order!.id },
      }),
      prisma.purchaseOrder.update({ where: { id }, data: { status: "RECEIVED", receivedQty, receivedAt: new Date() } }),
    ]);
    refresh();
    success(path, `Received ${receivedQty} on order ${order!.code}. Stock updated.`);
  }

  if (action === "cancel") {
    await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    refresh();
    success(path, `Order ${order!.code} cancelled.`);
  }

  fail(path, "Unknown action.");
}
