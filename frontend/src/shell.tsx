import { useState } from "react";
import { Overview } from "./overview";
import { AppLogo } from "./logo";
import { DishesPage, WeeklyMenu } from "./recipes";
import type { Family, Overview as OverviewData, Theme, User } from "./types";

export const nav = [
  { id: "overview", icon: "⌂", label: "Vue d'ensemble" },
  { id: "meals", icon: "◌", label: "Menus de la semaine" },
  { id: "dishes", icon: "✣", label: "Plats" },
  { id: "shopping", icon: "□", label: "Liste de courses" },
  { id: "lists", icon: "☷", label: "Toutes les listes" },
  { id: "tasks", icon: "✓", label: "Tâches" },
  { id: "movies", icon: "▷", label: "Films & séries" },
  { id: "books", icon: "▤", label: "Livres" },
  { id: "calendar", icon: "▦", label: "Calendrier" },
];

export function ThemeToggle({
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

export function Shell({
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
  overview: OverviewData | null;
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
          <AppLogo compact />
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
            <span>Family Hub</span>
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
            <ModulePage
              page={page}
              token={token}
              groupId={active.id}
              currentUserId={user.id}
              back={() => onNavigate("overview")}
              onNavigate={onNavigate}
            />
          )}
        </div>
      </main>
    </div>
  );
}

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

function ModulePage({
  page,
  token,
  groupId,
  currentUserId,
  back,
  onNavigate,
}: {
  page: string;
  token: string;
  groupId: string;
  currentUserId: string;
  back: () => void;
  onNavigate: (page: string) => void;
}) {
  const item = nav.find((entry) => entry.id === page);
  if (page === "dishes")
    return (
      <DishesPage
        token={token}
        groupId={groupId}
        currentUserId={currentUserId}
        back={back}
      />
    );
  if (page === "meals")
    return (
      <WeeklyMenu
        token={token}
        groupId={groupId}
        back={back}
        onNavigate={onNavigate}
      />
    );
  return (
    <div className="module-page">
      <button className="back-link" onClick={back}>
        ← Vue d'ensemble
      </button>
      <p className="kicker">Family Hub / {item?.label ?? "Espace groupe"}</p>
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
