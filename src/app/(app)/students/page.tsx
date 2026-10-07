import { CalendarCheck, Download, Plus, Search, Upload, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getAttendanceSummary } from "@/lib/analytics";
import { getSettings, participationBaseline } from "@/lib/settings";
import {
  createStudent,
  deleteStudent,
  importAttendanceCsv,
  importStudentsCsv,
  bulkMarkAttendance,
  setAttendance,
  toggleStudentActive,
  updateStudent,
} from "@/actions/students";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Stat,
  Table,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";
import { ConfirmButton, Flash, Modal, SubmitButton } from "@/components/form-ui";
import { num, startOfDay, toISODate } from "@/lib/utils";
import { MEAL_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Students & Attendance" };

const PAGE_SIZE = 20;

function StudentFormFields({ student }: { student?: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Student ID" className="col-span-2">
        <Input name="studentId" required defaultValue={(student?.studentId as string) ?? ""} placeholder="RIT2026CSE0001" disabled={!!student} />
      </Field>
      <Field label="Full name" className="col-span-2">
        <Input name="name" required defaultValue={(student?.name as string) ?? ""} placeholder="Aarav Sharma" />
      </Field>
      <Field label="Department">
        <Input name="department" defaultValue={(student?.department as string) ?? "CSE"} />
      </Field>
      <Field label="Year">
        <Input name="year" type="number" min={1} max={6} defaultValue={(student?.year as number) ?? 1} />
      </Field>
      <Field label="Residence">
        <Select name="residence" defaultValue={(student?.residence as string) ?? "HOSTEL"}>
          <option value="HOSTEL">Hostel</option>
          <option value="DAY_SCHOLAR">Day Scholar</option>
        </Select>
      </Field>
      <Field label="Hostel (optional)">
        <Input name="hostel" defaultValue={(student?.hostel as string) ?? ""} placeholder="Ganga" />
      </Field>
      <Field label="Email (optional)" className="col-span-2">
        <Input name="email" type="email" defaultValue={(student?.email as string) ?? ""} />
      </Field>
    </div>
  );
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER"]);
  const sp = await searchParams;
  const date = sp.date ? startOfDay(new Date(sp.date)) : startOfDay(new Date());
  const dateISO = toISODate(date);
  const q = (sp.q ?? "").trim();
  const dept = sp.dept ?? "";
  const residence = sp.res ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(q ? { OR: [{ name: { contains: q } }, { studentId: { contains: q } }] } : {}),
    ...(dept ? { department: dept } : {}),
    ...(residence ? { residence } : {}),
  };

  const [settings, summary, students, filteredCount, departments, attendanceRows] = await Promise.all([
    getSettings(),
    getAttendanceSummary(date),
    prisma.student.findMany({ where, orderBy: { studentId: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.student.count({ where }),
    prisma.student.findMany({ select: { department: true }, distinct: ["department"], orderBy: { department: "asc" } }),
    prisma.attendance.findMany({ where: { date }, select: { studentId: true, present: true, breakfast: true, lunch: true, snacks: true, dinner: true } }),
  ]);

  const attByStudent = new Map(attendanceRows.map((a) => [a.studentId, a]));
  const pages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  const rates = Object.fromEntries(MEAL_TYPES.map((m) => [m, participationBaseline(settings, m)]));
  const expectedLunch = Math.round((summary.present * rates.LUNCH) / 100);
  const expectedDinner = Math.round((summary.present * rates.DINNER) / 100);

  const qs = (overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const base = { date: dateISO, q, dept, res: residence, page, ...overrides };
    for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/students?${p.toString()}`;
  };

  const importTemplate = "studentId,name,department,year,residence,hostel,email";

  return (
    <div>
      <PageHeader
        title="Students & Attendance"
        description="Attendance feeds directly into the demand prediction engine. Record present students and their meal participation for any date."
        actions={
          <>
            <Modal trigger={<><Upload className="h-3.5 w-3.5" /> Import CSV</>} variant="secondary" title="Import students or attendance">
              <div className="space-y-5">
                <form action={importStudentsCsv} className="space-y-3">
                  <input type="hidden" name="redirectTo" value={qs({})} />
                  <div>
                    <p className="text-xs font-semibold text-ink-800">Students CSV</p>
                    <p className="mb-2 text-[11px] text-ink-500">Columns: {importTemplate}</p>
                    <input type="file" name="file" accept=".csv" required className="block w-full text-xs" />
                  </div>
                  <SubmitButton variant="secondary">Import students</SubmitButton>
                </form>
                <div className="border-t border-ink-100 pt-4">
                  <form action={importAttendanceCsv} className="space-y-3">
                    <input type="hidden" name="redirectTo" value={qs({})} />
                    <div>
                      <p className="text-xs font-semibold text-ink-800">Attendance CSV</p>
                      <p className="mb-2 text-[11px] text-ink-500">Columns: studentId,date,present,lunch,dinner,breakfast,snacks,location</p>
                      <input type="file" name="file" accept=".csv" required className="block w-full text-xs" />
                    </div>
                    <SubmitButton variant="secondary">Import attendance</SubmitButton>
                  </form>
                </div>
              </div>
            </Modal>
            <Modal trigger={<><Plus className="h-3.5 w-3.5" /> Add student</>} title="Add a student">
              <form action={createStudent} className="space-y-4">
                <input type="hidden" name="redirectTo" value={qs({})} />
                <StudentFormFields />
                <div className="flex justify-end gap-2">
                  <SubmitButton>Save student</SubmitButton>
                </div>
              </form>
            </Modal>
          </>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      {/* Attendance overview */}
      <Card className="mb-6">
        <CardHeader>
          <div>
            <CardTitle>Attendance overview</CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">Data for {dateISO}</p>
          </div>
          <form className="flex items-center gap-2">
            <input type="hidden" name="page" value="1" />
            <Input type="date" name="date" defaultValue={dateISO} className="h-8 w-40 text-xs" />
            <button className={buttonClass("secondary", "sm")} type="submit">
              View date
            </button>
          </form>
        </CardHeader>
        <CardBody className="pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total students" value={num(summary.enrolled)} />
            <Stat label="Present" value={num(summary.present)} tone="brand" />
            <Stat label="Absent" value={num(summary.absent)} />
            <Stat label="Hostel" value={num(summary.hostel)} />
            <Stat label="Day scholars" value={num(summary.dayScholar)} />
            <Stat
              label="Expected lunch"
              value={num(expectedLunch)}
              hint={`${rates.LUNCH}% historical participation`}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
              <p className="text-xs font-medium text-ink-700">Meal participation recorded</p>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {MEAL_TYPES.map((m) => (
                  <div key={m}>
                    <p className="text-sm font-semibold tabular-nums text-ink-900">{num(summary.participants[m])}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">{m}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-ink-200 bg-brand-50/60 p-4">
              <p className="text-xs font-medium text-brand-800">Predicted participation (from history)</p>
              <p className="mt-1 text-[11px] text-brand-700">
                Lunch ≈ <strong>{num(expectedLunch)}</strong> · Dinner ≈ <strong>{num(expectedDinner)}</strong> students. These
                rates become inputs to the demand prediction engine.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={bulkMarkAttendance}>
                  <input type="hidden" name="redirectTo" value={qs({})} />
                  <input type="hidden" name="date" value={dateISO} />
                  <input type="hidden" name="present" value="true" />
                  <SubmitButton variant="secondary" size="sm">
                    <CalendarCheck className="h-3.5 w-3.5" /> Mark all present
                  </SubmitButton>
                </form>
                <form action={bulkMarkAttendance}>
                  <input type="hidden" name="redirectTo" value={qs({})} />
                  <input type="hidden" name="date" value={dateISO} />
                  <input type="hidden" name="present" value="false" />
                  <ConfirmButton variant="secondary" message="Mark every student absent for this date? This replaces existing attendance.">
                    Mark all absent
                  </ConfirmButton>
                </form>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Student list */}
      <Card>
        <CardHeader>
          <CardTitle>Students ({num(filteredCount)})</CardTitle>
          <form className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="date" value={dateISO} />
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-ink-400" />
              <Input name="q" defaultValue={q} placeholder="Search name or ID" className="h-8 w-48 pl-7 text-xs" />
            </div>
            <Select name="dept" defaultValue={dept} className="h-8 w-32 text-xs">
              <option value="">All depts</option>
              {departments.map((d) => (
                <option key={d.department} value={d.department}>
                  {d.department}
                </option>
              ))}
            </Select>
            <Select name="res" defaultValue={residence} className="h-8 w-32 text-xs">
              <option value="">All</option>
              <option value="HOSTEL">Hostel</option>
              <option value="DAY_SCHOLAR">Day scholar</option>
            </Select>
            <button className={buttonClass("secondary", "sm")} type="submit">
              Filter
            </button>
          </form>
        </CardHeader>

        {students.length === 0 ? (
          <CardBody>
            <EmptyState
              title="No students match your filters"
              description="Try clearing the search or import a students CSV."
              icon={<Users className="h-6 w-6" />}
            />
          </CardBody>
        ) : (
          <>
            <div className="mt-3">
              <Table>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Dept / Year</Th>
                    <Th>Residence</Th>
                    <Th>Today</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const att = attByStudent.get(s.id);
                    return (
                      <Tr key={s.id}>
                        <Td>
                          <div className="font-medium text-ink-800">{s.name}</div>
                          <div className="font-mono text-[11px] text-ink-400">{s.studentId}</div>
                        </Td>
                        <Td>
                          {s.department} · Y{s.year}
                        </Td>
                        <Td>
                          {s.residence === "HOSTEL" ? (
                            <span>Hostel{s.hostel ? ` · ${s.hostel}` : ""}</span>
                          ) : (
                            <span>Day scholar</span>
                          )}
                        </Td>
                        <Td>
                          {att?.present ? (
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="success">Present</Badge>
                              {att.lunch && <Badge variant="info">Lunch</Badge>}
                              {att.dinner && <Badge variant="purple">Dinner</Badge>}
                            </div>
                          ) : (
                            <Badge variant="neutral">Absent</Badge>
                          )}
                        </Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Modal
                              trigger="Attendance"
                              variant="secondary"
                              size="sm"
                              title={`Attendance — ${s.name}`}
                              description={`Set presence and meal participation for ${dateISO}`}
                            >
                              <form action={setAttendance} className="space-y-3">
                                <input type="hidden" name="redirectTo" value={qs({})} />
                                <input type="hidden" name="studentId" value={s.id} />
                                <input type="hidden" name="date" value={dateISO} />
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" name="present" defaultChecked={att?.present ?? false} /> Present
                                </label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {MEAL_TYPES.map((m) => (
                                    <label key={m} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        name={m.toLowerCase()}
                                        defaultChecked={
                                          (att?.[m.toLowerCase() as "lunch" | "dinner" | "breakfast" | "snacks"] as boolean) ?? false
                                        }
                                      />
                                      {m.charAt(0) + m.slice(1).toLowerCase()}
                                    </label>
                                  ))}
                                </div>
                                <Field label="Location (optional)">
                                  <Input name="location" defaultValue={(att as { location?: string } | undefined)?.location ?? ""} />
                                </Field>
                                <div className="flex justify-end">
                                  <SubmitButton>Save attendance</SubmitButton>
                                </div>
                              </form>
                            </Modal>
                            <Modal trigger="Edit" variant="ghost" size="sm" title={`Edit ${s.name}`}>
                              <form action={updateStudent} className="space-y-4">
                                <input type="hidden" name="redirectTo" value={qs({})} />
                                <input type="hidden" name="id" value={s.id} />
                                <StudentFormFields student={s as unknown as Record<string, unknown>} />
                                <div className="flex justify-end">
                                  <SubmitButton>Save changes</SubmitButton>
                                </div>
                              </form>
                            </Modal>
                            <form action={toggleStudentActive}>
                              <input type="hidden" name="redirectTo" value={qs({})} />
                              <input type="hidden" name="id" value={s.id} />
                              <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                                {s.active ? "Deactivate" : "Activate"}
                              </SubmitButton>
                            </form>
                            <form action={deleteStudent}>
                              <input type="hidden" name="redirectTo" value={qs({})} />
                              <input type="hidden" name="id" value={s.id} />
                              <ConfirmButton message={`Delete ${s.name}? This also removes their attendance history.`}>Delete</ConfirmButton>
                            </form>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-5 py-4 text-xs text-ink-500">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <LinkButton href={qs({ page: Math.max(1, page - 1) })} variant="secondary" size="sm">
                  Previous
                </LinkButton>
                <LinkButton href={qs({ page: Math.min(pages, page + 1) })} variant="secondary" size="sm">
                  Next
                </LinkButton>
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-400">
        <Download className="h-3.5 w-3.5" />
        CSV import supports bulk onboarding. Attendance syncs with the demand prediction engine automatically.
      </div>
    </div>
  );
}
