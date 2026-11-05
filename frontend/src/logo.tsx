export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "app-logo compact" : "app-logo"}>
      <img src="/family-hub-logo.svg" alt="Family Hub" />
      {!compact && <span>family<span>hub</span></span>}
    </span>
  );
}
