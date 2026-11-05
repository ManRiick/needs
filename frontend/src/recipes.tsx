import { useEffect, useState } from "react";
import { request } from "./api";
import { DishForm } from "./recipe-form";
import type { Dish, MealEntry } from "./types";

function Empty({
  title,
  text,
  action,
  onClick,
}: {
  title: string;
  text: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">✣</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="text-action" onClick={onClick}>
          {action} →
        </button>
      )}
    </div>
  );
}

function formatMealDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? "Date inconnue"
    : date.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
}

export function DishesPage({
  token,
  groupId,
  currentUserId,
  back,
}: {
  token: string;
  groupId: string;
  currentUserId: string;
  back: () => void;
}) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Dish | null>(null);
  const [editing, setEditing] = useState<Dish | undefined>();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const load = () =>
    request<Dish[]>(`/groups/${groupId}/dishes`, token)
      .then(setDishes)
      .catch((reason: Error) => setError(reason.message));
  useEffect(() => {
    void load();
  }, [groupId, token]);
  if (creating || editing)
    return (
      <DishForm
        token={token}
        groupId={groupId}
        initialDish={editing}
        onCancel={() => {
          setCreating(false);
          setEditing(undefined);
        }}
        onSaved={async () => {
          setCreating(false);
          setEditing(undefined);
          await load();
        }}
      />
    );
  const visible = dishes.filter((dish) =>
    dish.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="dish-library">
      <button className="back-link" onClick={back}>
        ← Vue d'ensemble
      </button>
      <div className="page-heading">
        <div>
          <p className="kicker">Family Hub / Bibliothèque</p>
          <h1>
            Plats<span className="heading-dot">.</span>
          </h1>
          <p className="muted">Vos recettes familiales, prêtes à retrouver.</p>
        </div>
        <button
          className="primary-button library-create"
          onClick={() => setCreating(true)}
        >
          + Créer un plat
        </button>
      </div>
      <input
        className="library-search"
        placeholder="Rechercher un plat"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error && <p className="form-message">{error}</p>}
      {!visible.length ? (
        <Empty
          title="Aucun plat enregistré"
          text="Créez votre première recette pour commencer votre bibliothèque."
          action="Créer un plat"
          onClick={() => setCreating(true)}
        />
      ) : (
        <div className="dish-card-grid">
          {visible.map((dish) => (
            <button
              className="dish-card"
              key={dish.id}
              onClick={() => setSelected(dish)}
            >
              <span className="dish-card-mark">✣</span>
              <strong>{dish.name}</strong>
              <small>
                {dish.ingredients.length} ingrédient
                {dish.ingredients.length > 1 ? "s" : ""} ·{" "}
                {dish.preparationTime ?? 0} min de préparation
              </small>
              <small>
                {dish.creatorFirstName
                  ? `Par ${dish.creatorFirstName} ${dish.creatorLastName ?? ""}`
                  : "Recette familiale"}
              </small>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="dish-detail">
          <button className="back-link" onClick={() => setSelected(null)}>
            ← Bibliothèque
          </button>
          <p className="kicker">Recette</p>
          <h2>{selected.name}</h2>
          <p className="muted">
            {selected.description || "Une recette partagée avec le groupe."}
          </p>
          <div className="detail-meta">
            <span>{selected.servings ?? 1} portion(s)</span>
            <span>
              {(selected.preparationTime ?? 0) + (selected.cookingTime ?? 0)}{" "}
              min au total
            </span>
            <span>Créé par {selected.creatorFirstName ?? "un membre"}</span>
          </div>
          {selected.createdBy === currentUserId && (
            <button
              className="outline-button"
              onClick={() => {
                setEditing(selected);
                setSelected(null);
              }}
            >
              Modifier ce plat
            </button>
          )}
          <h3>Ingrédients</h3>
          <div className="detail-ingredients">
            {selected.ingredients.map((item) => (
              <div key={item.id}>
                <span>{item.name}</span>
                <b>
                  {item.quantity} {item.unit ?? ""}
                </b>
                {item.notes && <small>{item.notes}</small>}
              </div>
            ))}
          </div>
          <h3>Préparation</h3>
          <ol className="steps-list">
            {(selected.steps ?? []).map((step) => (
              <li key={step.id}>
                <span>{step.description}</span>
                {step.durationMinutes != null && (
                  <small>{step.durationMinutes} min</small>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function WeeklyMenu({
  token,
  groupId,
  back,
  onNavigate,
}: {
  token: string;
  groupId: string;
  back: () => void;
  onNavigate: (page: string) => void;
}) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mealType, setMealType] = useState("dinner");
  const [dishId, setDishId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const load = () =>
    Promise.all([
      request<Dish[]>(`/groups/${groupId}/dishes`, token),
      request<{ entries: MealEntry[] }>(`/groups/${groupId}/meal-plan`, token),
    ])
      .then(([nextDishes, menu]) => {
        setDishes(nextDishes);
        setEntries(menu.entries);
        setDishId(nextDishes[0]?.id ?? "");
      })
      .catch((reason: Error) => setError(reason.message));
  useEffect(() => {
    void load();
  }, [groupId, token]);
  if (creating)
    return (
      <DishForm
        token={token}
        groupId={groupId}
        onCancel={() => setCreating(false)}
        onSaved={async (dish) => {
          await request(`/groups/${groupId}/meal-plan/entries`, token, {
            method: "POST",
            body: JSON.stringify({ dishId: dish.id, date, mealType }),
          });
          setCreating(false);
          await load();
        }}
      />
    );
  async function addDish() {
    if (!dishId) return;
    try {
      await request(`/groups/${groupId}/meal-plan/entries`, token, {
        method: "POST",
        body: JSON.stringify({ dishId, date, mealType }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ajout impossible.");
    }
  }
  return (
    <div className="menu-page">
      <button className="back-link" onClick={back}>
        ← Vue d'ensemble
      </button>
      <div className="page-heading">
        <div>
          <p className="kicker">Family Hub / Organisation</p>
          <h1>
            Menu de la semaine<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Réutilisez vos plats sans recopier les recettes.
          </p>
        </div>
        <button className="outline-button" onClick={() => setCreating(true)}>
          + Créer un plat
        </button>
      </div>
      <section className="menu-add panel">
        <h2>Ajouter au menu</h2>
        <div className="menu-controls">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <select
            value={mealType}
            onChange={(event) => setMealType(event.target.value)}
          >
            <option value="breakfast">Petit-déjeuner</option>
            <option value="lunch">Déjeuner</option>
            <option value="dinner">Dîner</option>
            <option value="snack">Collation</option>
          </select>
          <select
            value={dishId}
            onChange={(event) => setDishId(event.target.value)}
          >
            <option value="">Choisir un plat</option>
            {dishes.map((dish) => (
              <option key={dish.id} value={dish.id}>
                {dish.name}
              </option>
            ))}
          </select>
          <button className="primary-button" onClick={addDish}>
            Ajouter
          </button>
          <button className="text-action" onClick={() => onNavigate("dishes")}>
            Voir la bibliothèque
          </button>
        </div>
        {error && <p className="form-message">{error}</p>}
      </section>
      <section className="menu-entries panel">
        <h2>Plats planifiés</h2>
        {entries.length ? (
          entries.map((entry) => (
            <div className="menu-entry" key={entry.id}>
              <span>{formatMealDate(entry.date)}</span>
              <strong>{entry.dishName}</strong>
              <small>{entry.mealType}</small>
            </div>
          ))
        ) : (
          <Empty
            title="Aucun repas planifié"
            text="Ajoutez un plat existant ou créez-en un directement depuis cette page."
          />
        )}
      </section>
    </div>
  );
}
