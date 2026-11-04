import { FormEvent, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./styles.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const TOKEN = "xyz_access_token";
const GROUP = "family_hub_active_group";
const THEME = "family_hub_theme";
type Theme = "light" | "dark";
type User = { id: string; email: string; firstName: string; lastName: string };
type Family = { id: string; name: string; code?: string; role: string };
type Overview = {
  group: Family;
  lists: {
    id: string;
    name: string;
    itemCount: number;
    completedCount: number;
  }[];
  members: { id: string; firstName: string; lastName: string; role: string }[];
};
type Product = { id: string; name: string; category: string };
type Unit = { id: string; name: string; abbreviation: string };
type RecipeIngredient = Product & {
  quantity: string;
  unitId: string;
  notes: string;
};
type Dish = {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  ingredients: (Product & {
    quantity: number;
    unitId?: string;
    notes?: string;
  })[];
};

// Envoie requête
async function request<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...options?.headers,
    },
  });
  const data = (await response.json()) as T & { message?: string | string[] };
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(" ")
        : (data.message ?? "Une erreur est survenue."),
    );
  return data;
}

// Affiche application
function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN));
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME);
    return saved === "dark" || saved === "light" ? saved : "light";
  });
  const [user, setUser] = useState<User | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [active, setActive] = useState<Family | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const pathParts = location.pathname.split("/");
  const [page, setPage] = useState(
    pathParts[pathParts.length - 1] || "overview",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME, theme);
  }, [theme]);

  // Change thème
  const toggleTheme = () =>
    setTheme((current) => (current === "light" ? "dark" : "light"));

  useEffect(() => {
    if (!token) return;
    request<{ user: User }>("/auth/me", token)
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem(TOKEN);
        setToken(null);
      });
  }, [token]);
  useEffect(() => {
    if (!token || !user) return;
    request<Family[]>("/groups", token)
      .then((items) => {
        setFamilies(items);
        const saved = localStorage.getItem(GROUP);
        setActive(items.find((item) => item.id === saved) ?? items[0] ?? null);
      })
      .catch((error: Error) => setMessage(error.message));
  }, [token, user]);
  useEffect(() => {
    if (!token || !active) return;
    localStorage.setItem(GROUP, active.id);
    request<Overview>(`/groups/${active.id}/overview`, token)
      .then(setOverview)
      .catch((error: Error) => setMessage(error.message));
  }, [token, active]);
  useEffect(() => {
    if (!token) return;
    const socket = io(API.replace(/\/api\/?$/, "") + "/realtime", {
      auth: { token },
      transports: ["websocket"],
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Ferme session
  const logout = () => {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(GROUP);
    setToken(null);
    setUser(null);
  };
  // Change page
  const navigate = (next: string) => {
    setPage(next);
    history.pushState({}, "", `/groups/${active?.id ?? ""}/${next}`);
  };
  if (!token || !user)
    return (
      <Auth
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogin={(nextToken, nextUser) => {
          localStorage.setItem(TOKEN, nextToken);
          setToken(nextToken);
          setUser(nextUser);
        }}
      />
    );
  if (!families.length)
    return (
      <NoFamily
        token={token}
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onCreated={(family) => {
          setFamilies([family]);
          setActive(family);
        }}
        onLogout={logout}
      />
    );
  return (
    <Shell
      token={token}
      user={user}
      families={families}
      active={active ?? families[0]}
      overview={overview}
      page={page}
      message={message}
      onMessage={setMessage}
      onFamily={(family) => {
        setActive(family);
        navigate("overview");
      }}
      onNavigate={navigate}
      onLogout={logout}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

// Affiche champ
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
// Affiche authentification
function Auth({
  theme,
  onToggleTheme,
  onLogin,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onLogin: (token: string, user: User) => void;
}) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
  });
  const [error, setError] = useState("");
  // Met à jour formulaire
  const update = (key: keyof typeof form) => (value: string) =>
    setForm({ ...form, [key]: value });
  // Soumet authentification
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (register) {
        await request("/auth/register", "", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setRegister(false);
        setError("Compte créé. Connecte-toi maintenant.");
      } else {
        const result = await request<{ accessToken: string; user: User }>(
          "/auth/login",
          "",
          {
            method: "POST",
            body: JSON.stringify({
              email: form.email,
              password: form.password,
            }),
          },
        );
        onLogin(result.accessToken, result.user);
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "La connexion a échoué.",
      );
    }
  }
  return (
    <main className="auth-page">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <section className="auth-story">
        <span className="brand">
          family<span>hub</span>
        </span>
        <p className="kicker">L'organisation, ensemble</p>
        <h1>La maison tourne mieux quand tout le monde voit la même chose.</h1>
        <p className="story-copy">
          Menus, courses, tâches et idées partagées dans un espace calme, pensé
          pour la vraie vie.
        </p>
        <div className="story-note">
          ✦{" "}
          <span>Un espace privé pour les petites victoires du quotidien.</span>
        </div>
      </section>
      <section className="auth-panel">
        <p className="kicker">{register ? "Nouveau départ" : "Bon retour"}</p>
        <h2>{register ? "Créer ton espace" : "Ravi de te revoir"}</h2>
        <p className="muted">
          {register
            ? "Quelques détails et c'est parti."
            : "Connecte-toi pour retrouver ta famille."}
        </p>
        <form onSubmit={submit}>
          {register && (
            <div className="name-fields">
              <Field
                label="Prénom"
                value={form.firstName}
                onChange={update("firstName")}
              />
              <Field
                label="Nom"
                value={form.lastName}
                onChange={update("lastName")}
              />
            </div>
          )}
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={update("email")}
          />
          <Field
            label="Mot de passe"
            type="password"
            value={form.password}
            onChange={update("password")}
          />
          <button className="primary-button">
            {register ? "Créer mon compte" : "Se connecter"}
            <span>→</span>
          </button>
          <p className="form-message">{error}</p>
        </form>
        <button className="link-button" onClick={() => setRegister(!register)}>
          {register ? "J'ai déjà un compte" : "Créer un compte"}
        </button>
      </section>
    </main>
  );
}

// Affiche accueil
function NoFamily({
  token,
  user,
  theme,
  onToggleTheme,
  onCreated,
  onLogout,
}: {
  token: string;
  user: User;
  theme: Theme;
  onToggleTheme: () => void;
  onCreated: (family: Family) => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  // Crée groupe
  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const family = await request<Family>("/groups", token, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setCreatedCode(family.code ?? "");
      onCreated(family);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Création impossible.",
      );
    }
  }
  // Rejoint groupe
  async function join(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      onCreated(
        await request<Family>("/groups/join", token, {
          method: "POST",
          body: JSON.stringify({ code }),
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Impossible de rejoindre ce groupe.",
      );
    }
  }
  return (
    <main className="welcome-page">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <button className="quiet-button" onClick={onLogout}>
        Se déconnecter
      </button>
      <div className="welcome-content">
        <span className="welcome-mark">✦</span>
        <p className="kicker">Bienvenue, {user.firstName}</p>
        <h1>On commence par créer votre maison.</h1>
        <p className="lead">
          XYZ devient l'endroit où votre famille se retrouve pour décider,
          partager et avancer.
        </p>
        <div className="group-actions">
          <form className="create-group" onSubmit={create}>
            <h2>Créer un groupe</h2>
            <Field label="Nom du groupe" value={name} onChange={setName} />
            <button className="primary-button">
              Créer le groupe <span>→</span>
            </button>
            {createdCode && (
              <p className="code-note">
                Code à partager : <strong>{createdCode}</strong>
              </p>
            )}
          </form>
          <div className="action-divider">
            <span>ou</span>
          </div>
          <form className="join-group" onSubmit={join}>
            <h2>Rejoindre un groupe</h2>
            <Field
              label="Code du groupe"
              value={code}
              onChange={(value) => setCode(value.toUpperCase())}
            />
            <button className="secondary-button">
              Rejoindre le groupe <span>→</span>
            </button>
          </form>
        </div>
        <p className="form-message">{error}</p>
      </div>
    </main>
  );
}

const nav = [
  { id: "overview", icon: "⌂", label: "Vue d'ensemble" },
  { id: "meals", icon: "◌", label: "Menus de la semaine" },
  { id: "shopping", icon: "□", label: "Liste de courses" },
  { id: "lists", icon: "☷", label: "Toutes les listes" },
  { id: "tasks", icon: "✓", label: "Tâches" },
  { id: "movies", icon: "▷", label: "Films & séries" },
  { id: "books", icon: "▤", label: "Livres" },
  { id: "calendar", icon: "▦", label: "Calendrier" },
];
// Affiche interface
function Shell({
  token,
  user,
  families,
  theme,
  onToggleTheme,
  active,
  overview,
  page,
  message,
  onMessage,
  onFamily,
  onNavigate,
  onLogout,
}: {
  token: string;
  user: User;
  families: Family[];
  theme: Theme;
  onToggleTheme: () => void;
  active: Family;
  overview: Overview | null;
  page: string;
  message: string;
  onMessage: (value: string) => void;
  onFamily: (family: Family) => void;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="sidebar-top">
          <span className="brand">
            family<span>hub</span>
          </span>
          <button className="close-sidebar" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
        <FamilySwitcher
          families={families}
          active={active}
          onSelect={onFamily}
        />
        <nav>
          {nav.map((item) => (
            <button
              className={page === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setOpen(false);
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => onNavigate("members")}>
            <span>◉</span>Membres du groupe
          </button>
          <button className="nav-item" onClick={() => onNavigate("settings")}>
            <span>⚙</span>Paramètres
          </button>
          <button className="profile" onClick={onLogout}>
            <span className="avatar">
              {user.firstName[0]}
              {user.lastName[0]}
            </span>
            <span>
              <b>
                {user.firstName} {user.lastName}
              </b>
              <small>Se déconnecter</small>
            </span>
            <span>↗</span>
          </button>
        </div>
      </aside>
      <div
        className={open ? "mobile-scrim visible" : "mobile-scrim"}
        onClick={() => setOpen(false)}
      />
      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)}>
            ☰
          </button>
          <div className="breadcrumb">
            <span>XYZ</span>
            <b>/</b>
            <strong>{active.name}</strong>
          </div>
          <div className="top-actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button className="icon-button">?</button>
            <button className="user-avatar">{user.firstName[0]}</button>
          </div>
        </header>
        {message && (
          <div className="error-banner">
            {message}
            <button onClick={() => onMessage("")}>×</button>
          </div>
        )}
        <div className="content">
          {page === "overview" ? (
            <Overview data={overview} user={user} navigate={onNavigate} />
          ) : (
            <Module
              page={page}
              back={() => onNavigate("overview")}
              token={token}
              groupId={active.id}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// Affiche thème
function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Activer le mode ${theme === "light" ? "sombre" : "clair"}`}
      title={`Mode ${theme === "light" ? "sombre" : "clair"}`}
    >
      {theme === "light" ? "☾" : "☀"}
    </button>
  );
}

// Change groupe
function FamilySwitcher({
  families,
  active,
  onSelect,
}: {
  families: Family[];
  active: Family;
  onSelect: (family: Family) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group-switcher">
      <button className="active-group" onClick={() => setOpen(!open)}>
        <span className="group-icon">⌂</span>
        <span>
          <small>Groupe actif · {active.code ?? "code indisponible"}</small>
          <b>{active.name}</b>
        </span>
        <span className="chevron">⌄</span>
      </button>
      {open && (
        <div className="group-menu">
          {families.map((family) => (
            <button
              key={family.id}
              onClick={() => {
                onSelect(family);
                setOpen(false);
              }}
            >
              ⌂ {family.name}
              {family.id === active.id && <b>✓</b>}
            </button>
          ))}
          <button className="new-group" disabled>
            + Créer un groupe
          </button>
        </div>
      )}
    </div>
  );
}
// Affiche aperçu
function Overview({
  data,
  user,
  navigate,
}: {
  data: Overview | null;
  user: User;
  navigate: (page: string) => void;
}) {
  const remaining =
    data?.lists.reduce(
      (sum, list) => sum + list.itemCount - list.completedCount,
      0,
    ) ?? 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="kicker">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1>
            Bonjour, {user.firstName}
            <span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Voici ce qui se passe dans {data?.group.name ?? "votre groupe"}.
          </p>
        </div>
        <button className="outline-button" onClick={() => navigate("calendar")}>
          + Ajouter un événement
        </button>
      </div>
      <section className="quick-stats">
        <Stat
          label="À faire"
          value="—"
          hint="Les tâches arrivent bientôt"
          tone="coral"
        />
        <Stat
          label="Courses"
          value={String(remaining)}
          hint="articles à prévoir"
          tone="sage"
        />
        <Stat
          label="Cette semaine"
          value="0"
          hint="repas planifiés"
          tone="gold"
        />
      </section>
      <div className="overview-grid">
        <Panel
          title="Menu de la semaine"
          action="Voir le menu"
          onClick={() => navigate("meals")}
        >
          <div className="week-strip">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day, i) => (
              <div
                className={
                  i === (new Date().getDay() + 6) % 7 ? "day today" : "day"
                }
                key={day}
              >
                <small>{day}</small>
                <b>{i + 2}</b>
              </div>
            ))}
          </div>
          <Empty
            icon="✣"
            title="Aucun repas planifié"
            text="Ajoutez vos repas de la semaine pour que tout le monde sache ce qui est prévu."
            action="Planifier un repas"
            onClick={() => navigate("meals")}
          />
        </Panel>
        <Panel
          title="Activité récente"
          action="Tout voir"
          onClick={() => navigate("lists")}
        >
          <Empty
            icon="◌"
            title="Votre espace est prêt"
            text="Les activités de votre groupe apparaîtront ici."
          />
        </Panel>
      </div>
      <Panel
        title="Vos listes"
        action="Voir toutes les listes"
        onClick={() => navigate("lists")}
      >
        {data?.lists.length ? (
          data.lists.map((list) => (
            <div className="list-row" key={list.id}>
              <span className="list-symbol">□</span>
              <span>
                <b>{list.name}</b>
                <small>
                  {list.itemCount - list.completedCount} élément(s) restant(s)
                </small>
              </span>
              <span>→</span>
            </div>
          ))
        ) : (
          <Empty
            icon="☷"
            title="Créez votre première liste"
            text="Courses, sorties, cadeaux : gardez tout au même endroit."
            action="Créer une liste"
            onClick={() => navigate("lists")}
          />
        )}
      </Panel>
    </>
  );
}
// Affiche panneau
function Panel({
  title,
  action,
  onClick,
  children,
}: {
  title: string;
  action: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>{title}</h2>
        <button onClick={onClick}>{action} →</button>
      </div>
      {children}
    </section>
  );
}
// Affiche statistique
function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className={`stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}
// Affiche vide
function Empty({
  icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: string;
  title: string;
  text: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
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
// Affiche module
function Module({
  page,
  back,
  token,
  groupId,
}: {
  page: string;
  back: () => void;
  token: string;
  groupId: string;
}) {
  const item = nav.find((entry) => entry.id === page);
  if (page === "meals")
    return <Meals token={token} groupId={groupId} back={back} />;
  return (
    <div className="module-page">
      <button className="back-link" onClick={back}>
        ← Vue d'ensemble
      </button>
      <p className="kicker">XYZ / {item?.label ?? "Espace groupe"}</p>
      <h1>{item?.label ?? "Espace groupe"}</h1>
      <div className="module-placeholder">
        <span>✦</span>
        <h2>Cette pièce se prépare.</h2>
        <p>
          La navigation est prête. Ce module sera connecté dès que ses endpoints
          backend seront disponibles.
        </p>
      </div>
    </div>
  );
}

// Affiche recettes
function Meals({
  token,
  groupId,
  back,
}: {
  token: string;
  groupId: string;
  back: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [category, setCategory] = useState("other");

  useEffect(() => {
    request<Unit[]>("/products/units", token)
      .then(setUnits)
      .catch((reason: Error) => setError(reason.message));
  }, [token]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      request<Product[]>(
        `/products?search=${encodeURIComponent(search)}`,
        token,
      )
        .then(setProducts)
        .catch((reason: Error) => setError(reason.message));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search, token]);
  // Charge plats
  const loadDishes = () =>
    request<Dish[]>(`/dishes/group/${groupId}`, token)
      .then(setDishes)
      .catch((reason: Error) => setError(reason.message));
  useEffect(() => {
    void loadDishes();
  }, [groupId, token]);

  // Ajoute ingrédient
  const addIngredient = (product: Product) => {
    if (ingredients.some((ingredient) => ingredient.id === product.id)) return;
    setIngredients([
      ...ingredients,
      { ...product, quantity: "", unitId: units[0]?.id ?? "", notes: "" },
    ]);
    setSearch("");
  };
  // Crée ingrédient
  const createProduct = async () => {
    if (!search.trim()) return;
    try {
      const product = await request<Product>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: search, category }),
      });
      addIngredient(product);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Création impossible.",
      );
    }
  };
  // Modifie ingrédient
  const updateIngredient = (
    id: string,
    field: "quantity" | "unitId" | "notes",
    value: string,
  ) =>
    setIngredients(
      ingredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, [field]: value } : ingredient,
      ),
    );
  // Enregistre recette
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved("");
    try {
      await request(
        editingId
          ? `/dishes/${editingId}?groupId=${groupId}`
          : `/dishes/group/${groupId}`,
        token,
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({
            name,
            description,
            instructions,
            ingredients: ingredients.map(({ id, quantity, unitId, notes }) => ({
              productId: id,
              quantity: Number(quantity),
              unitId: unitId || undefined,
              notes,
            })),
          }),
        },
      );
      setSaved(
        editingId
          ? "Plat modifié dans votre groupe."
          : "Plat enregistré dans votre groupe.",
      );
      setName("");
      setDescription("");
      setInstructions("");
      setIngredients([]);
      setEditingId(null);
      void loadDishes();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Enregistrement impossible.",
      );
    } finally {
      setLoading(false);
    }
  }
  const suggestions = search.trim() ? products : [];
  // Edite recette
  const editDish = (dish: Dish) => {
    setEditingId(dish.id);
    setName(dish.name);
    setDescription(dish.description ?? "");
    setInstructions(dish.instructions ?? "");
    setIngredients(
      dish.ingredients.map((ingredient) => ({
        ...ingredient,
        quantity: String(ingredient.quantity),
        unitId: ingredient.unitId ?? "",
        notes: ingredient.notes ?? "",
      })),
    );
    setSaved("");
  };
  return (
    <div className="recipe-page">
      <button className="back-link" onClick={back}>
        ← Vue d'ensemble
      </button>
      <p className="kicker">XYZ / Menus</p>
      <div className="page-heading">
        <div>
          <h1>
            Créer un plat<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Composez une recette avec le catalogue partagé.
          </p>
        </div>
      </div>
      {dishes.length > 0 && (
        <section className="dish-list">
          <p className="kicker">Vos plats</p>
          {dishes.map((dish) => (
            <div className="dish-list-row" key={dish.id}>
              <strong>{dish.name}</strong>
              <span>
                {dish.ingredients.length} ingrédient
                {dish.ingredients.length > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                className="text-action"
                onClick={() => editDish(dish)}
              >
                Modifier
              </button>
            </div>
          ))}
        </section>
      )}
      <form className="recipe-form" onSubmit={submit}>
        <section className="recipe-section">
          <p className="kicker">01 · Informations générales</p>
          <div className="recipe-fields">
            <Field
              label={editingId ? "Nom du plat modifié" : "Nom du plat"}
              value={name}
              onChange={setName}
            />
            <Field
              label="Description"
              value={description}
              onChange={setDescription}
            />
          </div>
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
                <span>Aucun ingrédient trouvé. Ajouter « {search} » ?</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="other">Autre</option>
                  <option value="vegetables">Légumes</option>
                  <option value="fruits">Fruits</option>
                  <option value="dairy">Produits laitiers et œufs</option>
                  <option value="meat-fish">Viandes et poissons</option>
                  <option value="starches">Féculents</option>
                  <option value="grocery">Épicerie</option>
                  <option value="herbs-spices">Herbes et épices</option>
                </select>
                <button
                  type="button"
                  className="text-action"
                  onClick={createProduct}
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
                  aria-label={`Quantité de ${ingredient.name}`}
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
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
                  aria-label={`Unité de ${ingredient.name}`}
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
                  aria-label={`Note pour ${ingredient.name}`}
                  placeholder="Note (facultatif)"
                  value={ingredient.notes}
                  onChange={(event) =>
                    updateIngredient(ingredient.id, "notes", event.target.value)
                  }
                />
                <button
                  type="button"
                  className="remove-ingredient"
                  aria-label={`Supprimer ${ingredient.name}`}
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
          <label className="field">
            <span>Instructions</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={5}
            />
          </label>
        </section>
        {error && <p className="form-message">{error}</p>}
        {saved && <p className="success-message">{saved}</p>}
        <button
          className="primary-button recipe-submit"
          disabled={loading || !name.trim()}
        >
          {loading
            ? "Enregistrement…"
            : editingId
              ? "Enregistrer les modifications"
              : "Enregistrer le plat"}
          <span>→</span>
        </button>
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
