import { fireEvent, render, screen } from "@testing-library/react";
import { WaterQualityBadge, type WaterQuality } from "@/components/beach-detail/water-quality-badge";
import { applyRainfallNotice } from "@/lib/services/water-quality/rainfall-runoff";

const sample: WaterQuality = {
  beach_id: "d291411d-d331-4bf1-ad1a-302da3c69de0", status: "advisory",
  latest_enterococcus: 220, latest_fecal_coliform: 34, latest_sample_date: "2026-08-11",
  exceedance_count_30d: 1, total_samples_30d: 16,
  status_reason: "Enterococcus 220 CFU/100mL exceeds STV of 130", status_changed_at: null,
};

it.each(["clear", "advisory", "closure", "unavailable"] as const)(
  "shows current county %s without historical evidence", (county) => {
    const { container } = render(<WaterQualityBadge waterQuality={{ ...sample,
      status: county === "clear" ? "unknown" : county === "closure" ? "closure" : "advisory",
      county_advisory_status: county,
      county_checked_at: county === "unavailable" ? undefined : "2026-09-04T03:00:00Z",
    }} />);
    expect(container.firstChild).toHaveClass("bg-paper", "text-ink", "border-ink/20", "shadow-sm");
    expect((container.firstChild as HTMLElement).className).not.toMatch(/gradient|backdrop-blur|shadow-lg/);
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveClass("text-ink");
    expect(toggle).toHaveClass(county === "advisory" || county === "closure" ? "border-destructive/40" : "border-ink/20");
    fireEvent.click(toggle);
    expect(screen.queryByRole("link", { name: /County of San Diego/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/San Diego County .* checked/) !== null)
      .toBe(county === "advisory" || county === "closure");
    expect(screen.queryByText(/220|Enterococcus|Fecal Coliform|Latest sample|30-day exceedances|CEDEN/)).not.toBeInTheDocument();
    expect(screen.queryByText("No current county advisory") !== null).toBe(county === "clear");
    expect(screen.queryByText("County status unavailable") !== null).toBe(county === "unavailable");
    expect(screen.queryByText("Water Quality: Good")).not.toBeInTheDocument();
  },
);

it("keeps historical sample details and source attribution behind the toggle", () => {
  render(<WaterQualityBadge waterQuality={sample} beachState="HI" />);
  const toggle = screen.getByRole("button", { name: /Water Advisory/ });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Enterococcus:").parentElement).toHaveTextContent("Enterococcus: 220 CFU/100mL");
  expect(screen.getByText("30-day exceedances:").parentElement).toHaveTextContent("1 of 16 samples exceeded EPA limits");
  expect(screen.getByRole("link", { name: /Hawaii DOH Clean Water Branch/ })).toHaveAttribute("href", "https://health.hawaii.gov/cwb/");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("30-day exceedances:")).not.toBeInTheDocument();
});

it("names a County general advisory as rain runoff, not elevated bacteria", () => {
  render(<WaterQualityBadge waterQuality={{ ...sample, status: "advisory",
    county_advisory_status: "advisory", county_advisory_kind: "general",
    county_checked_at: "2026-10-12T18:00:00Z" }} />);
  const toggle = screen.getByRole("button", { name: /Rain Advisory/ });
  fireEvent.click(toggle);
  expect(screen.getByText("County rain advisory · runoff after rain")).toBeInTheDocument();
  expect(screen.queryByText(/elevated bacteria/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /County of San Diego/ })).not.toBeInTheDocument();
});

it("keeps an expired general-only County advisory hidden despite fresh wet rainfall", () => {
  const now = new Date("2026-10-14T20:30:43Z");
  const expired: WaterQuality = { ...sample, status: "unknown", county_general_expired: true };
  const overlaid = applyRainfallNotice(expired, {
    cluster_id: "laguna_san_clemente", window_end: now.toISOString(), total_in: 1.2,
    station_totals: { KNFG: 1.2 },
  }, now);
  expect(overlaid).toBe(expired);
  expect(overlaid.status).toBe("unknown");
  expect(overlaid).not.toHaveProperty("rain_runoff");
  const { container } = render(<WaterQualityBadge waterQuality={overlaid} />);
  expect(container).toBeEmptyDOMElement();
});

it("labels a rainfall notice as a precaution with its gauges, not a sample result", () => {
  render(<WaterQualityBadge waterQuality={{ ...sample,
    status_reason: "Runoff after rain: 0.38 in fell nearby in the last 72 hours. Avoid those areas and check again in 72 hours.",
    rain_runoff: { total_in: 0.38, window_end: "2026-10-12T14:00:00Z", stations: ["KLGB", "KSNA"] },
  }} />);
  fireEvent.click(screen.getByRole("button", { name: /Rain runoff advisory/ }));
  expect(screen.getByText(/0\.38 in fell nearby/)).toBeInTheDocument();
  expect(screen.getByText(/KLGB, KSNA/)).toHaveTextContent("This is a precaution, not a water sample.");
  expect(screen.queryByText("Reason:")).not.toBeInTheDocument();
  expect(screen.queryByText("Water Quality: Good")).not.toBeInTheDocument();
});

it("lets a County general advisory outrank a rainfall notice", () => {
  render(<WaterQualityBadge waterQuality={{ ...sample, status: "advisory",
    county_advisory_status: "advisory", county_advisory_kind: "general", county_checked_at: "2026-10-12T18:00:00Z",
    rain_runoff: { total_in: 0.38, window_end: "2026-10-12T14:00:00Z", stations: ["KSAN"] } }} />);
  expect(screen.getByRole("button", { name: /Rain Advisory/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Rain runoff advisory/ })).not.toBeInTheDocument();
});

it("shows stored rain event start and end times in the expanded card", () => {
  render(<WaterQualityBadge waterQuality={{ ...sample, status: "advisory",
    status_reason: "Runoff after rain nearby.", rain_runoff: { stations: ["KLGB"],
      started_at: "2026-10-16T13:00:00Z", last_rain_at: "2026-10-16T13:00:00Z",
      expires_at: "2026-10-19T13:00:00Z" } }} />);
  fireEvent.click(screen.getByRole("button", { name: /Rain runoff advisory/ }));
  expect(screen.getByText(/Rain advisory since Fri 6 AM/)).toBeInTheDocument();
  expect(screen.queryByText(/for the 72 hours to/)).not.toBeInTheDocument();
});
