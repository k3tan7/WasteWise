"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

const VALID = ["UNREAD", "READ", "RESOLVED", "IGNORED"];

export async function setAlertStatus(fd: FormData) {
  await requireUser();
  const path = redirectTarget(fd, "/alerts");
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!VALID.includes(status)) fail(path, "Invalid alert status.");
  await prisma.alert
    .update({ where: { id }, data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null } })
    .catch(() => fail(path, "Could not update the alert."));
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  success(path, `Alert marked ${status.toLowerCase()}.`);
}

export async function markAllAlertsRead() {
  await requireUser();
  await prisma.alert.updateMany({ where: { status: "UNREAD" }, data: { status: "READ" } });
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  success("/alerts", "All alerts marked as read.");
}
