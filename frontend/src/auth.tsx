import { FormEvent, useState } from "react";
import { request } from "./api";
import type { Family, Theme, User } from "./types";

// Affiche champ
export function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

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

// Affiche authentification
export function Auth({
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
  const update = (key: keyof typeof form) => (value: string) =>
    setForm({ ...form, [key]: value });
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
export function NoFamily({
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
          Family Hub devient l'endroit où votre famille se retrouve pour
          décider, partager et avancer.
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
