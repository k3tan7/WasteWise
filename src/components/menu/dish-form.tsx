"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/form-ui";
import { DISH_CATEGORIES } from "@/lib/constants";

type Ingredient = { id: string; name: string; unit: string };
type RecipeRow = { ingredientId: string; quantityPerServing: string; unit: string };

export type DishDraft = {
  id?: string;
  name?: string;
  category?: string;
  description?: string | null;
  portionSizeG?: number;
  estCostPerServing?: number;
  instructions?: string | null;
  recipe?: { ingredientId: string; quantityPerServing: number; unit: string }[];
};

export function DishForm({
  action,
  ingredients,
  redirectTo,
  dish,
  submitLabel = "Save dish",
}: {
  action: (fd: FormData) => void | Promise<void>;
  ingredients: Ingredient[];
  redirectTo: string;
  dish?: DishDraft;
  submitLabel?: string;
}) {
  const [rows, setRows] = useState<RecipeRow[]>(
    (dish?.recipe ?? []).map((r) => ({
      ingredientId: r.ingredientId,
      quantityPerServing: String(r.quantityPerServing),
      unit: r.unit,
    }))
  );

  const recipeJson = JSON.stringify(
    rows
      .filter((r) => r.ingredientId && Number(r.quantityPerServing) > 0)
      .map((r) => ({ ingredientId: r.ingredientId, quantityPerServing: Number(r.quantityPerServing), unit: r.unit }))
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="recipe" value={recipeJson} />
      {dish?.id && <input type="hidden" name="id" value={dish.id} />}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Dish name" className="col-span-2">
          <Input name="name" required defaultValue={dish?.name ?? ""} placeholder="Paneer Curry" />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue={dish?.category ?? "MAIN"}>
            {DISH_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Portion size (g)">
          <Input name="portionSizeG" type="number" min={1} defaultValue={dish?.portionSizeG ?? 150} />
        </Field>
        <Field label="Estimated cost / serving" className="col-span-2">
          <Input name="estCostPerServing" type="number" min={0} step="0.5" defaultValue={dish?.estCostPerServing ?? 10} />
        </Field>
        <Field label="Description (optional)" className="col-span-2">
          <Textarea name="description" defaultValue={dish?.description ?? ""} className="min-h-[56px]" />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-ink-800">Recipe — ingredient per serving</p>
          <button
            type="button"
            onClick={() => setRows((r) => [...r, { ingredientId: ingredients[0]?.id ?? "", quantityPerServing: "", unit: ingredients[0]?.unit ?? "kg" }])}
            className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] font-medium text-ink-700 hover:bg-ink-50"
          >
            <Plus className="h-3 w-3" /> Add ingredient
          </button>
        </div>
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-ink-200 px-3 py-4 text-center text-[11px] text-ink-400">
            No ingredients yet. Adding a recipe lets the system calculate ingredient requirements and purchases.
          </p>
        )}
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={row.ingredientId}
                onChange={(e) => {
                  const val = e.target.value;
                  const ing = ingredients.find((i) => i.id === val);
                  setRows((r) => r.map((x, i) => (i === idx ? { ...x, ingredientId: val, unit: ing?.unit ?? x.unit } : x)));
                }}
                className="flex-1"
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                step="0.001"
                min="0"
                placeholder="qty/serving"
                value={row.quantityPerServing}
                onChange={(e) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, quantityPerServing: e.target.value } : x)))}
                className="w-28"
              />
              <span className="w-8 text-[11px] text-ink-400">{row.unit}</span>
              <button
                type="button"
                onClick={() => setRows((r) => r.filter((_, i) => i !== idx))}
                className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Field label="Preparation notes (optional)">
        <Textarea name="instructions" defaultValue={dish?.instructions ?? ""} className="min-h-[48px]" />
      </Field>

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
