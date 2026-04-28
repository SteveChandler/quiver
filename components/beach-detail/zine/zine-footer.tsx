interface ZineFooterProps {
  city?: string | null;
  state?: string | null;
}

export function ZineFooter({ city, state }: ZineFooterProps) {
  const location = [city, state].filter(Boolean).join(", ");
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  return (
    <footer className="zine-footer">
      <span>Quiver · Field Guide{location ? ` · ${location}` : ""}</span>
      <span>Updated {today}</span>
      <span style={{ fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.06em" }}>QUIVER //</span>
    </footer>
  );
}
