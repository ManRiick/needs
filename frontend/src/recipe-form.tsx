import { FormEvent, useEffect, useState } from "react";
import { request } from "./api";
import { Field } from "./auth";
import type {
  Dish,
  Product,
  RecipeIngredient,
  RecipeStep,
  Unit,
} from "./types";

export function DishForm({
  token,
  groupId,
  initialDish,
  onCancel,
  onSaved,
}: {
  token: string;
  groupId: string;
  initialDish?: Dish;
  onCancel: () => void;
  onSaved: (dish: Dish) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialDish?.name ?? "");
  const [description, setDescription] = useState(
    initialDish?.description ?? "",
  );
  const [category, setCategory] = useState(initialDish?.category ?? "other");
  const [instructions, setInstructions] = useState(
    initialDish?.instructions ?? "",
  );
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initialDish?.ingredients.map((item) => ({
      ...item,
      quantity: String(item.quantity),
      unitId: item.unitId ?? "",
      notes: item.notes ?? "",
    })) ?? [],
  );
  const [steps, setSteps] = useState<RecipeStep[]>(
    initialDish?.steps?.map((step) => ({
      stepNumber: step.stepNumber,
      description: step.description,
      durationMinutes:
        step.durationMinutes == null ? "" : String(step.durationMinutes),
    })) ?? [],
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request<Unit[]>("/products/units", token)
      .then(setUnits)
      .catch((reason: Error) => setError(reason.message));
  }, [token]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () =>
        request<Product[]>(
          `/products?search=${encodeURIComponent(search)}`,
          token,
          { signal: controller.signal },
        )
          .then(setProducts)
          .catch((reason: Error) => {
            if (reason.name !== "AbortError") setError(reason.message);
          }),
      180,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, token]);
  const addIngredient = (product: Product) => {
    if (!ingredients.some((item) => item.id === product.id))
      setIngredients([
        ...ingredients,
        { ...product, quantity: "", unitId: units[0]?.id ?? "", notes: "" },
      ]);
    setSearch("");
  };
  const updateIngredient = (
    id: string,
    field: "quantity" | "unitId" | "notes",
    value: string,
  ) =>
    setIngredients(
      ingredients.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  const updateStep = (index: number, field: keyof RecipeStep, value: string) =>
    setSteps(
      steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: value } : step,
      ),
    );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const dish = await request<Dish>(
        initialDish
          ? `/groups/${groupId}/dishes/${initialDish.id}`
          : `/groups/${groupId}/dishes`,
        token,
        {
          method: initialDish ? "PATCH" : "POST",
          body: JSON.stringify({
            name,
            description,
            category,
            instructions,
            ingredients: ingredients
              .filter((ingredient) => Number(ingredient.quantity) > 0)
              .map(({ id, quantity, unitId, notes }) => ({
                productId: id,
                quantity: Number(quantity),
                unitId: unitId || undefined,
                notes,
              })),
            steps: steps
              .filter((step) => step.description.trim())
              .map((step, index) => ({
                stepNumber: index + 1,
                description: step.description,
                durationMinutes: step.durationMinutes
                  ? Number(step.durationMinutes)
                  : undefined,
              })),
          }),
        },
      );
      await onSaved(dish);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }
  const suggestions = search.trim() ? products : [];
  return (
    <div className="recipe-page">
      <button className="back-link" onClick={onCancel}>
        ← Annuler
      </button>
      <p className="kicker">Family Hub / Plats</p>
      <div className="page-heading">
        <div>
          <h1>
            {initialDish ? "Modifier le plat" : "Créer un plat"}
            <span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Une recette claire, réutilisable dans vos menus.
          </p>
        </div>
      </div>
      <form className="recipe-form" onSubmit={submit}>
        <section className="recipe-section">
          <p className="kicker">01 · Informations générales</p>
          <div className="recipe-fields">
            <Field label="Nom du plat" value={name} onChange={setName} />
            <Field
              label="Description"
              value={description}
              onChange={setDescription}
              required={false}
            />
          </div>
          <label className="field recipe-category">
            <span>Catégorie</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="other">Autre</option>
              <option value="family">Familial</option>
              <option value="quick">Rapide</option>
              <option value="vegetarian">Végétarien</option>
              <option value="dessert">Dessert</option>
            </select>
          </label>
        </section>
        <section className="recipe-section">
          <p className="kicker">02 · Ingrédients</p>
          <label className="field ingredient-search">
            <span>Rechercher dans le catalogue</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex. oeuf, tomate, huile olive"
            />
            {suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => addIngredient(product)}
                  >
                    <strong>{product.name}</strong>
                    <small>{product.category}</small>
                  </button>
                ))}
              </div>
            )}
            {search.trim() && !suggestions.length && (
              <div className="no-suggestion">
                <span>Aucun ingrédient trouvé. Créer « {search} » ?</span>
                <button
                  type="button"
                  className="text-action"
                  onClick={async () => {
                    try {
                      addIngredient(
                        await request<Product>("/products", token, {
                          method: "POST",
                          body: JSON.stringify({
                            name: search,
                            category: "other",
                          }),
                        }),
                      );
                    } catch (reason) {
                      setError(
                        reason instanceof Error
                          ? reason.message
                          : "Création impossible.",
                      );
                    }
                  }}
                >
                  Ajouter
                </button>
              </div>
            )}
          </label>
          <div className="ingredient-list">
            {ingredients.map((ingredient) => (
              <div className="ingredient-row" key={ingredient.id}>
                <strong>{ingredient.name}</strong>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Qté"
                  value={ingredient.quantity}
                  onChange={(event) =>
                    updateIngredient(
                      ingredient.id,
                      "quantity",
                      event.target.value,
                    )
                  }
                />
                <select
                  value={ingredient.unitId}
                  onChange={(event) =>
                    updateIngredient(
                      ingredient.id,
                      "unitId",
                      event.target.value,
                    )
                  }
                >
                  <option value="">Unité</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.abbreviation}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Note (facultatif)"
                  value={ingredient.notes}
                  onChange={(event) =>
                    updateIngredient(ingredient.id, "notes", event.target.value)
                  }
                />
                <button
                  type="button"
                  className="remove-ingredient"
                  onClick={() =>
                    setIngredients(
                      ingredients.filter((item) => item.id !== ingredient.id),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="recipe-section">
          <p className="kicker">03 · Préparation</p>
          <div className="steps-editor">
            {steps.map((step, index) => (
              <div className="step-row" key={index}>
                <b>{index + 1}</b>
                <textarea
                  rows={2}
                  placeholder="Décrivez cette étape"
                  value={step.description}
                  onChange={(event) =>
                    updateStep(index, "description", event.target.value)
                  }
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={step.durationMinutes}
                  onChange={(event) =>
                    updateStep(index, "durationMinutes", event.target.value)
                  }
                />
                <button
                  type="button"
                  className="remove-ingredient"
                  onClick={() =>
                    setSteps(
                      steps.filter((_, stepIndex) => stepIndex !== index),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="text-action"
            onClick={() =>
              setSteps([
                ...steps,
                {
                  stepNumber: steps.length + 1,
                  description: "",
                  durationMinutes: "",
                },
              ])
            }
          >
            + Ajouter une étape
          </button>
          <label className="field">
            <span>Notes de préparation</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={4}
            />
          </label>
        </section>
        {error && <p className="form-message">{error}</p>}
        <button
          className="primary-button recipe-submit"
          disabled={saving || !name.trim()}
        >
          {saving
            ? "Enregistrement…"
            : initialDish
              ? "Enregistrer les modifications"
              : "Enregistrer le plat"}
          <span>→</span>
        </button>
      </form>
    </div>
  );
}
