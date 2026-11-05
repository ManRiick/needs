import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { API, request } from "./api";
import { Auth, NoFamily } from "./auth";
import { Shell } from "./shell";
import type { Family, Overview, Theme, User } from "./types";
import "./styles.css";

const TOKEN = "xyz_access_token";
const GROUP = "family_hub_active_group";
const THEME = "family_hub_theme";

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
    const socket = io(`${API.replace(/\/api\/?$/, "")}/realtime`, {
      auth: { token },
      transports: ["websocket"],
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);

  const toggleTheme = () =>
    setTheme((current) => (current === "light" ? "dark" : "light"));
  const logout = () => {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(GROUP);
    setToken(null);
    setUser(null);
  };
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
