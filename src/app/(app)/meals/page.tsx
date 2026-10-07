import { Plus, Sparkles, UtensilsCrossed } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getAttendanceSummary } from "@/lib/analytics";
import { completeMeal, createMeal, deleteMeal, generateMealPrediction } from "@/actions/meals";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
  Textarea,
} from "@/components/ui";
import { ConfirmButton, Flash, Modal, SubmitButton } from "@/components/form-ui";
import { kg, num, startOfDay, toISODate } from "@/lib/utils";
import { MEAL_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meals" };

const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SNACKS: "Snacks", DINNER: "Dinner" };

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER"]);
  const sp = await searchParams;
  const date = sp.date ? startOfDay(new Date(sp.date)) : startOfDay(new Date());
  const dateISO = toISODate(date);

  const [meals, menus, attendance, settings] = await Promise.all([
    prisma.meal.findMany({
      where: { date },
      orderBy: { mealType: "asc" },
      include: { menu: { include: { items: { include: { dish: true } } } } },
    }),
    prisma.menu.findMany({ where: { date }, include: { items: { include: { dish: true } } } }),
    getAttendanceSummary(date),
    prisma.campusSetting.findMany(),
  ]);
  void settings;

  const qs = `/meals?date=${dateISO}`;

  return (
    <div>
      <PageHeader
        title="Meal operations"
        description="Plan a meal, generate its demand forecast, then record what was actually prepared, consumed and wasted."
        actions={
          <>
            <form className="flex items-center gap-2">
              <Input type="date" name="date" defaultValue={dateISO} className="h-9 w-40 text-xs" />
              <SubmitButton variant="secondary">View</SubmitButton>
            </form>
            <Modal
              trigger={<><Plus className="h-3.5 w-3.5" /> Add meal</>}
              title="Add a meal"
              description="Create a meal slot and link it to a menu."
            >
              <form action={createMeal} className="space-y-3">
                <input type="hidden" name="redirectTo" value={qs} />
                <Field label="Date">
                  <Input name="date" type="date" required defaultValue={dateISO} />
                </Field>
                <Field label="Meal">
                  <Select name="mealType">
                    {MEAL_TYPES.map((m) => (
                      <option key={m} value={m}>
                        {MEAL_LABEL[m]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Menu (optional)">
                  <Select name="menuId">
                    <option value="">— none —</option>
                    {menus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {MEAL_LABEL[m.mealType]} · {m.items.length} dishes
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Expected students" hint={`Students present today: ${attendance.present}`}>
                  <Input name="expectedStudents" type="number" min={0} defaultValue={attendance.present} />
                </Field>
                <div className="flex justify-end">
                  <SubmitButton>Create meal</SubmitButton>
                </div>
              </form>
            </Modal>
          </>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MEAL_TYPES.map((m) => {
          const meal = meals.find((x) => x.mealType === m);
          return (
            <Card key={m} className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{MEAL_LABEL[m]}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">
                {meal ? num(meal.actualConsumption ?? meal.predictedConsumption) : "—"}
              </p>
              <p className="text-[11px] text-ink-400">
                {meal ? (meal.status === "COMPLETED" ? "completed" : "planned") : "not created"}
              </p>
            </Card>
          );
        })}
      </div>

      {meals.length === 0 ? (
        <EmptyState
          title="No meals for this date"
          description="Create meal slots (breakfast, lunch, snacks, dinner) to start forecasting and tracking."
          icon={<UtensilsCrossed className="h-6 w-6" />}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {meals.map((m) => {
            const variance =
              m.predictedConsumption && m.actualConsumption
                ? ((m.actualConsumption - m.predictedConsumption) / m.predictedConsumption) * 100
                : null;
            return (
              <Card key={m.id}>
                <CardHeader>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>{MEAL_LABEL[m.mealType] ?? m.mealType}</CardTitle>
                      <Badge variant={m.status === "COMPLETED" ? "success" : "info"}>{m.status}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-500">
                      {m.menu?.items.map((i) => i.dish.name).join(" · ") || "No menu linked"}
                    </p>
                  </div>
                  <form action={deleteMeal}>
                    <input type="hidden" name="redirectTo" value={qs} />
                    <input type="hidden" name="id" value={m.id} />
                    <ConfirmButton message="Delete this meal and its waste links?">Delete</ConfirmButton>
                  </form>
                </CardHeader>
                <CardBody className="pt-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-indigo-50 py-2.5">
                      <p className="text-sm font-semibold tabular-nums text-indigo-700">{num(m.predictedConsumption)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-indigo-500">Predicted</p>
                    </div>
                    <div className="rounded-xl bg-brand-50 py-2.5">
                      <p className="text-sm font-semibold tabular-nums text-brand-700">{num(m.recommendedPrep)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-brand-600">Recommended</p>
                    </div>
                    <div className="rounded-xl bg-ink-50 py-2.5">
                      <p className="text-sm font-semibold tabular-nums text-ink-800">{num(m.actualPrep)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-ink-400">Prepared</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-ink-500">Actual consumption</span>
                    <span className="text-right tabular-nums text-ink-800">{num(m.actualConsumption)}</span>
                    <span className="text-ink-500">Unserved food</span>
                    <span className="text-right tabular-nums text-ink-800">{kg(m.unservedKg)}</span>
                    <span className="text-ink-500">Plate waste</span>
                    <span className="text-right tabular-nums text-ink-800">{kg(m.plateWasteKg)}</span>
                    <span className="text-ink-500">Total food waste</span>
                    <span className="text-right tabular-nums text-ink-800">{kg(m.totalWasteKg)}</span>
                    {variance !== null && (
                      <>
                        <span className="text-ink-500">Demand variance</span>
                        <span className={`text-right tabular-nums ${variance < 0 ? "text-red-600" : "text-brand-700"}`}>
                          {variance > 0 ? "+" : ""}
                          {variance.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={generateMealPrediction}>
                      <input type="hidden" name="redirectTo" value={qs} />
                      <input type="hidden" name="mealId" value={m.id} />
                      <SubmitButton variant="secondary" size="sm" pendingLabel="Forecasting…">
                        <Sparkles className="h-3.5 w-3.5" /> {m.predictedConsumption ? "Re-forecast" : "Generate forecast"}
                      </SubmitButton>
                    </form>
                    <Modal
                      trigger="Complete meal"
                      size="sm"
                      title={`Complete ${MEAL_LABEL[m.mealType]}`}
                      description="Record actual preparation, consumption and waste."
                    >
                      <form action={completeMeal} className="space-y-3">
                        <input type="hidden" name="redirectTo" value={qs} />
                        <input type="hidden" name="mealId" value={m.id} />
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Quantity prepared">
                            <Input name="actualPrep" type="number" min={0} defaultValue={m.actualPrep ?? m.recommendedPrep ?? 0} required />
                          </Field>
                          <Field label="Meals consumed">
                            <Input name="actualConsumption" type="number" min={0} defaultValue={m.actualConsumption ?? m.predictedConsumption ?? 0} required />
                          </Field>
                          <Field label="Unserved food (kg)">
                            <Input name="unservedKg" type="number" min={0} step="0.1" defaultValue={m.unservedKg ?? 0} />
                          </Field>
                          <Field label="Plate waste (kg)">
                            <Input name="plateWasteKg" type="number" min={0} step="0.1" defaultValue={m.plateWasteKg ?? 0} />
                          </Field>
                        </div>
                        <Field label="Notes (optional)">
                          <Textarea name="notes" defaultValue={m.notes ?? ""} className="min-h-[48px]" />
                        </Field>
                        <p className="text-[11px] text-ink-400">
                          Saving closes the prediction learning loop: the forecast error is stored against this meal to improve
                          future forecasts.
                        </p>
                        <div className="flex justify-end">
                          <SubmitButton>Save & complete</SubmitButton>
                        </div>
                      </form>
                    </Modal>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Meal log — {dateISO}</CardTitle>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Meal</Th>
                <Th className="text-right">Expected</Th>
                <Th className="text-right">Predicted</Th>
                <Th className="text-right">Recommended</Th>
                <Th className="text-right">Prepared</Th>
                <Th className="text-right">Consumed</Th>
                <Th className="text-right">Waste</Th>
              </tr>
            </thead>
            <tbody>
              {meals.map((m) => (
                <Tr key={m.id}>
                  <Td className="font-medium text-ink-800">{MEAL_LABEL[m.mealType]}</Td>
                  <Td className="text-right tabular-nums">{num(m.expectedStudents)}</Td>
                  <Td className="text-right tabular-nums">{num(m.predictedConsumption)}</Td>
                  <Td className="text-right tabular-nums">{num(m.recommendedPrep)}</Td>
                  <Td className="text-right tabular-nums">{num(m.actualPrep)}</Td>
                  <Td className="text-right tabular-nums">{num(m.actualConsumption)}</Td>
                  <Td className="text-right tabular-nums">{kg(m.totalWasteKg)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
