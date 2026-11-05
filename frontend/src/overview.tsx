import type { Overview as OverviewData, User } from "./types";

export function Empty({
  icon = "✣",
  title,
  text,
  action,
  onClick,
}: {
  icon?: string;
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

export function Overview({
  data,
  user,
  navigate,
}: {
  data: OverviewData | null;
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
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(
              (day, index) => (
                <div
                  className={
                    index === (new Date().getDay() + 6) % 7
                      ? "day today"
                      : "day"
                  }
                  key={day}
                >
                  <small>{day}</small>
                  <b>{index + 2}</b>
                </div>
              ),
            )}
          </div>
          <Empty
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
