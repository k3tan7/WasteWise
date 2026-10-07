import { ChefHat, Copy, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { createDish, createMenu, deleteDish, deleteMenu, duplicateMenu, duplicatePreviousDay, updateDish } from "@/actions/menu";
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
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { ConfirmButton, Flash, Modal, SubmitButton } from "@/components/form-ui";
import { DishForm } from "@/components/menu/dish-form";
import { addDays, fmtDate, num, startOfDay, toISODate } from "@/lib/utils";
import { MEAL_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu" };

const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SNACKS: "Snacks", DINNER: "Dinner" };

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER"]);
  const sp = await searchParams;
  const tab = sp.tab === "dishes" ? "dishes" : "menus";
  const from = sp.from ? startOfDay(new Date(sp.from)) : startOfDay(new Date());

  const [dishes, ingredients, menus] = await Promise.all([
    prisma.dish.findMany({
      orderBy: { name: "asc" },
      include: { recipe: { include: { items: { include: { ingredient: true } } } }, _count: { select: { menuItems: true } } },
    }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
    prisma.menu.findMany({
      where: { date: { gte: from, lte: addDays(from, 6) } },
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
      include: { items: { include: { dish: true } } },
    }),
  ]);

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ tab, from: toISODate(from), ...overrides });
    return `/menu?${p.toString()}`;
  };

  const menuDays = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  return (
    <div>
      <PageHeader
        title="Menu management"
        description="Every dish links to its recipe, which links to ingredients, inventory and purchasing. Menus drive the whole demand → requirement chain."
        actions={
          <Modal
            trigger={<><Plus className="h-3.5 w-3.5" /> New menu</>}
            title="Create or update a menu"
            description="Selecting an existing date + meal replaces that menu."
            wide
          >
            <form action={createMenu} className="space-y-4">
              <input type="hidden" name="redirectTo" value={qs({})} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <Input name="date" type="date" required defaultValue={toISODate(from)} />
                </Field>
                <Field label="Meal">
                  <Select name="mealType" defaultValue="LUNCH">
                    {MEAL_TYPES.map((m) => (
                      <option key={m} value={m}>
                        {MEAL_LABEL[m]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Menu name (optional)" className="col-span-2">
                  <Input name="name" placeholder="Monday Lunch" />
                </Field>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-ink-600">Dishes on this menu</p>
                <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-ink-200 p-3">
                  {dishes.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" name="dishIds" value={d.id} />
                      <span className="truncate">{d.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="published" defaultChecked /> Publish menu
              </label>
              <div className="flex justify-end">
                <SubmitButton>Save menu</SubmitButton>
              </div>
            </form>
          </Modal>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      <div className="mb-5 flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1 text-xs">
        <LinkButton href={qs({ tab: "menus" })} variant={tab === "menus" ? "primary" : "ghost"} size="sm">
          Menus
        </LinkButton>
        <LinkButton href={qs({ tab: "dishes" })} variant={tab === "dishes" ? "primary" : "ghost"} size="sm">
          Dishes & recipes ({dishes.length})
        </LinkButton>
        <div className="ml-auto flex items-center gap-2 pr-1">
          <form className="flex items-center gap-2">
            <input type="hidden" name="tab" value={tab} />
            <Input type="date" name="from" defaultValue={toISODate(from)} className="h-8 w-36 text-xs" />
            <SubmitButton variant="secondary" size="sm">
              Go
            </SubmitButton>
          </form>
        </div>
      </div>

      {tab === "menus" ? (
        <div className="space-y-4">
          {menus.length === 0 && (
            <EmptyState
              title="No menus scheduled"
              description="Create a menu for this week to drive demand predictions and purchase planning."
              icon={<ChefHat className="h-6 w-6" />}
              action={
                <Modal trigger={<><Plus className="h-3.5 w-3.5" /> New menu</>} title="Create a menu" wide>
                  <form action={createMenu} className="space-y-3">
                    <input type="hidden" name="redirectTo" value={qs({})} />
                    <Field label="Date">
                      <Input name="date" type="date" required defaultValue={toISODate(from)} />
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
                    <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-ink-200 p-3">
                      {dishes.map((d) => (
                        <label key={d.id} className="flex items-center gap-2 text-xs">
                          <input type="checkbox" name="dishIds" value={d.id} /> {d.name}
                        </label>
                      ))}
                    </div>
                    <SubmitButton>Save menu</SubmitButton>
                  </form>
                </Modal>
              }
            />
          )}
          {menuDays.map((day) => {
            const dayMenus = menus.filter((m) => toISODate(m.date) === toISODate(day));
            if (!dayMenus.length) return null;
            return (
              <Card key={toISODate(day)}>
                <CardHeader>
                  <CardTitle>{fmtDate(day, { weekday: "long", month: "short", day: "numeric" })}</CardTitle>
                  <div className="flex gap-2">
                    <form action={duplicatePreviousDay}>
                      <input type="hidden" name="redirectTo" value={qs({})} />
                      <input type="hidden" name="date" value={toISODate(day)} />
                      <input type="hidden" name="mealType" value="LUNCH" />
                      <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                        <Copy className="h-3 w-3" /> Copy prev. day
                      </SubmitButton>
                    </form>
                  </div>
                </CardHeader>
                <CardBody className="pt-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {dayMenus.map((m) => (
                      <div key={m.id} className="rounded-xl border border-ink-200 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-ink-800">{MEAL_LABEL[m.mealType] ?? m.mealType}</p>
                          <div className="flex items-center gap-1">
                            {m.published ? <Badge variant="success">Published</Badge> : <Badge>Draft</Badge>}
                            <form action={deleteMenu}>
                              <input type="hidden" name="redirectTo" value={qs({})} />
                              <input type="hidden" name="id" value={m.id} />
                              <ConfirmButton message="Delete this menu?">Delete</ConfirmButton>
                            </form>
                          </div>
                        </div>
                        <ul className="mt-2 space-y-0.5">
                          {m.items.map((i) => (
                            <li key={i.id} className="text-[11px] text-ink-600">
                              · {i.dish.name}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex gap-1.5">
                          {MEAL_TYPES.filter((mt) => mt !== m.mealType).map((mt) => (
                            <form key={mt} action={duplicateMenu}>
                              <input type="hidden" name="redirectTo" value={qs({})} />
                              <input type="hidden" name="sourceId" value={m.id} />
                              <input type="hidden" name="targetMealType" value={mt} />
                              <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                                → {mt.slice(0, 3)}
                              </SubmitButton>
                            </form>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Dishes & recipes</CardTitle>
            <Modal trigger={<><Plus className="h-3.5 w-3.5" /> New dish</>} title="Create a dish" wide>
              <DishForm action={createDish} ingredients={ingredients} redirectTo={qs({ tab: "dishes" })} />
            </Modal>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Dish</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Portion</Th>
                  <Th className="text-right">Cost</Th>
                  <Th>Recipe</Th>
                  <Th className="text-right">Avg waste</Th>
                  <Th className="text-right">On menus</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((d) => (
                  <Tr key={d.id}>
                    <Td className="font-medium text-ink-800">{d.name}</Td>
                    <Td>
                      <Badge>{d.category}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{d.portionSizeG} g</Td>
                    <Td className="text-right tabular-nums">₹{d.estCostPerServing}</Td>
                    <Td>
                      {(() => {
                        // Purchasing can only be finalised when the recipe is complete.
                        const problems: string[] = [];
                        if (!d.recipe) problems.push("no recipe");
                        else {
                          if (!d.recipe.items.length) problems.push("no ingredients");
                          if (!d.recipe.standardYield || d.recipe.standardYield <= 0) problems.push("no yield");
                          const bad = d.recipe.items.filter((it) => !(it.quantityPerServing > 0) || !it.unit);
                          if (bad.length) problems.push(`${bad.length} item(s) without quantity/unit`);
                        }
                        return problems.length === 0 ? (
                          <Badge variant="success">{d.recipe?.items.length ?? 0} ingredients · complete</Badge>
                        ) : (
                          <Badge variant="danger">⚠ incomplete — {problems.join(", ")}</Badge>
                        );
                      })()}
                    </Td>
                    <Td className="text-right tabular-nums">{d.historicalWastePct.toFixed(1)}%</Td>
                    <Td className="text-right tabular-nums">{d._count.menuItems}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Modal trigger="Edit" variant="secondary" size="sm" title={`Edit ${d.name}`} wide>
                          <DishForm
                            action={updateDish}
                            ingredients={ingredients}
                            redirectTo={qs({ tab: "dishes" })}
                            submitLabel="Update dish"
                            dish={{
                              id: d.id,
                              name: d.name,
                              category: d.category,
                              description: d.description,
                              portionSizeG: d.portionSizeG,
                              estCostPerServing: d.estCostPerServing,
                              instructions: d.recipe?.instructions ?? null,
                              recipe: (d.recipe?.items ?? []).map((r) => ({
                                ingredientId: r.ingredientId,
                                quantityPerServing: r.quantityPerServing,
                                unit: r.unit,
                              })),
                            }}
                          />
                        </Modal>
                        <form action={deleteDish}>
                          <input type="hidden" name="redirectTo" value={qs({ tab: "dishes" })} />
                          <input type="hidden" name="id" value={d.id} />
                          <ConfirmButton message={`Delete ${d.name}? Dishes used on menus cannot be deleted.`}>Delete</ConfirmButton>
                        </form>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <CardBody className="pt-0 text-[11px] text-ink-400">
            Historical consumption and waste per dish are updated automatically as meals are completed — {num(dishes.length)} dishes tracked.
          </CardBody>
        </Card>
      )}
    </div>
  );
}
