"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";
import { parseCsv, toBool, toDate, toNumber } from "@/lib/csv";
import { startOfDay } from "@/lib/utils";
import { getSettings, participationBaseline } from "@/lib/settings";

const ALLOWED = ["ADMIN", "MESS_MANAGER"] as const;

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

function refresh() {
  revalidatePath("/students");
  revalidatePath("/dashboard");
}

export async function createStudent(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/students");

  const studentId = str(fd, "studentId");
  const name = str(fd, "name");
  const department = str(fd, "department");
  const year = toNumber(str(fd, "year"), 1);
  const residence = str(fd, "residence", "HOSTEL");
  const hostel = str(fd, "hostel");
  const email = str(fd, "email");

  if (!studentId || !name) fail(path, "Student ID and name are required.");
  if (!["HOSTEL", "DAY_SCHOLAR"].includes(residence)) fail(path, "Residence must be Hostel or Day Scholar.");
  if (year < 1 || year > 6) fail(path, "Year must be between 1 and 6.");

  try {
    await prisma.student.create({
      data: { studentId, name, department: department || "General", year, residence, hostel: hostel || null, email: email || null },
    });
  } catch {
    fail(path, `Could not add student — ID "${studentId}" may already exist.`);
  }
  refresh();
  success(path, `Student ${name} added.`);
}

export async function updateStudent(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/students");
  const id = str(fd, "id");
  if (!id) fail(path, "Missing student id.");

  const year = toNumber(str(fd, "year"), 1);
  try {
    await prisma.student.update({
      where: { id },
      data: {
        name: str(fd, "name"),
        department: str(fd, "department"),
        year,
        residence: str(fd, "residence", "HOSTEL"),
        hostel: str(fd, "hostel") || null,
        email: str(fd, "email") || null,
      },
    });
  } catch {
    fail(path, "Could not update student.");
  }
  refresh();
  success(path, "Student updated.");
}

export async function toggleStudentActive(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/students");
  const id = str(fd, "id");
  const s = await prisma.student.findUnique({ where: { id } });
  if (!s) fail(path, "Student not found.");
  await prisma.student.update({ where: { id }, data: { active: !s!.active } });
  refresh();
  success(path, `${s!.name} marked ${s!.active ? "inactive" : "active"}.`);
}

export async function deleteStudent(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/students");
  const id = str(fd, "id");
  await prisma.student.delete({ where: { id } }).catch(() => fail(path, "Could not delete student."));
  refresh();
  success(path, "Student removed.");
}

/** Set (or clear) one student's attendance + meal participation for a date. */
export async function setAttendance(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/students");
  const studentId = str(fd, "studentId");
  const date = toDate(str(fd, "date"));
  if (!studentId || !date) fail(path, "Student and date are required.");
  const day = startOfDay(date!);
  const present = str(fd, "present") === "on" || str(fd, "present") === "true";

  const data = {
    present,
    breakfast: present && str(fd, "breakfast") === "on",
    lunch: present && str(fd, "lunch") === "on",
    snacks: present && str(fd, "snacks") === "on",
    dinner: present && str(fd, "dinner") === "on",
    location: str(fd, "location") || null,
  };

  await prisma.attendance.upsert({
    where: { studentId_date: { studentId, date: day } },
    update: data,
    create: { studentId, date: day, ...data },
  });
  refresh();
  success(path, "Attendance saved.");
}

/** Mark every active student present or absent for a date (with default participation). */
export async function bulkMarkAttendance(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/students");
  const date = toDate(str(fd, "date"));
  if (!date) fail(path, "A valid date is required.");
  const day = startOfDay(date!);
  const present = str(fd, "present") !== "false";

  const [students, settings] = await Promise.all([
    prisma.student.findMany({ where: { active: true }, select: { id: true } }),
    getSettings(),
  ]);

  const rates = {
    breakfast: participationBaseline(settings, "BREAKFAST") / 100,
    lunch: participationBaseline(settings, "LUNCH") / 100,
    snacks: participationBaseline(settings, "SNACKS") / 100,
    dinner: participationBaseline(settings, "DINNER") / 100,
  };

  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { date: day } }),
    prisma.attendance.createMany({
      data: students.map((s, i) => ({
        studentId: s.id,
        date: day,
        present,
        location: present ? "Campus" : null,
        // Deterministic spread (round-robin) so participation is realistic and repeatable.
        breakfast: present && (i % 100) / 100 < rates.breakfast,
        lunch: present && (i % 100) / 100 < rates.lunch,
        snacks: present && (i % 100) / 100 < rates.snacks,
        dinner: present && (i % 100) / 100 < rates.dinner,
      })),
    }),
  ]);
  refresh();
  success(path, `Marked ${students.length} students ${present ? "present" : "absent"} for that date.`);
}

export async function importStudentsCsv(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/students");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) fail(path, "Please choose a CSV file.");
  const text = await (file as File).text();
  const { rows, errors } = parseCsv<Record<string, string>>(text);
  if (!rows.length) fail(path, `No rows found in the file. ${errors[0] ?? ""}`);

  let created = 0;
  let updated = 0;
  const rowErrors: string[] = [];

  for (const [i, r] of rows.entries()) {
    const studentId = (r.studentId ?? r.StudentID ?? r.id ?? "").trim();
    const name = (r.name ?? r.Name ?? "").trim();
    if (!studentId || !name) {
      rowErrors.push(`Row ${i + 2}: missing studentId or name`);
      continue;
    }
    const residence = /hostel/i.test(r.residence ?? r.type ?? "") ? "HOSTEL" : "DAY_SCHOLAR";
    const data = {
      name,
      department: (r.department ?? "General").trim() || "General",
      year: toNumber(r.year, 1),
      residence,
      hostel: (r.hostel ?? "").trim() || null,
      email: (r.email ?? "").trim() || null,
    };
    const existing = await prisma.student.findUnique({ where: { studentId } });
    if (existing) {
      await prisma.student.update({ where: { studentId }, data });
      updated++;
    } else {
      await prisma.student.create({ data: { studentId, ...data } });
      created++;
    }
  }

  refresh();
  if (rowErrors.length && !created && !updated) fail(path, `Import failed. ${rowErrors.slice(0, 3).join(" · ")}`);
  success(path, `Imported students — ${created} added, ${updated} updated${rowErrors.length ? `, ${rowErrors.length} skipped` : ""}.`);
}

export async function importAttendanceCsv(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/students");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) fail(path, "Please choose a CSV file.");
  const text = await (file as File).text();
  const { rows } = parseCsv<Record<string, string>>(text);
  if (!rows.length) fail(path, "No rows found in the file.");

  const students = await prisma.student.findMany({ select: { id: true, studentId: true } });
  const byStudentId = new Map(students.map((s) => [s.studentId.toLowerCase(), s.id]));

  let ok = 0;
  const errors: string[] = [];
  for (const [i, r] of rows.entries()) {
    const sid = (r.studentId ?? r.StudentID ?? "").trim().toLowerCase();
    const date = toDate(r.date ?? r.Date);
    const id = byStudentId.get(sid);
    if (!id || !date) {
      errors.push(`Row ${i + 2}: unknown student or invalid date`);
      continue;
    }
    const present = toBool(r.present ?? r.Present, true);
    const day = startOfDay(date);
    const data = {
      present,
      breakfast: present && toBool(r.breakfast, false),
      lunch: present && toBool(r.lunch, true),
      snacks: present && toBool(r.snacks, false),
      dinner: present && toBool(r.dinner, true),
      location: (r.location ?? "").trim() || null,
    };
    await prisma.attendance.upsert({
      where: { studentId_date: { studentId: id, date: day } },
      update: data,
      create: { studentId: id, date: day, ...data },
    });
    ok++;
  }

  refresh();
  if (!ok) fail(path, `No attendance rows imported. ${errors.slice(0, 3).join(" · ")}`);
  success(path, `Imported ${ok} attendance records${errors.length ? `, ${errors.length} skipped` : ""}.`);
}
