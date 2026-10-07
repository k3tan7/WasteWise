"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, success } from "@/lib/flash";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { seedDemoCampus } from "@/lib/demo/seed-campus";

export async function updateSettings(fd: FormData) {
  await requireRole(["ADMIN"]);

  let updated = 0;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const def = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS];
    const raw = fd.get(`setting:${key}`);
    if (raw === undefined) {
      // An unchecked checkbox for a BOOLEAN setting should persist as "false".
      if (def.type === "BOOLEAN" && fd.has(`bool:${key}`)) {
        await prisma.campusSetting.upsert({
          where: { key },
          update: { value: "false" },
          create: { key, value: "false", label: def.label, type: def.type, category: def.category },
        });
        updated++;
      }
      continue;
    }
    const value = typeof raw === "string" ? raw.trim() : String(raw);
    if (def.type === "NUMBER" && value !== "" && Number.isNaN(Number(value))) {
      fail("/settings", `"${def.label}" must be a number.`);
    }
    await prisma.campusSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, label: def.label, type: def.type, category: def.category },
    });
    updated++;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard", "layout");
  success("/settings", `${updated} setting(s) saved. Conversion assumptions apply to future treatment batches only.`);
}

/** Rebuild the entire demo campus using the shared seed routine. */
export async function resetDemoData() {
  await requireRole(["ADMIN"]);
  try {
    await seedDemoCampus();
  } catch {
    fail("/settings", "Demo reset failed. Check the server logs.");
  }
  revalidatePath("/", "layout");
  success("/settings", "Demo campus data has been reset and regenerated.");
}
