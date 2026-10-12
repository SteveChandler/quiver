import { fireEvent, render, screen } from "@testing-library/react";
import { WaterQualityBadge, type WaterQuality } from "@/components/beach-detail/water-quality-badge";

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
    expect(screen.getByRole("link", { name: /County of San Diego/ })).toHaveAttribute("href", "https://www.sdbeachinfo.com/");
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
  expect(screen.getByText(/runoff after rain/i)).toHaveTextContent(/storm drains and river mouths/);
  expect(screen.getByText(/runoff after rain/i)).toHaveTextContent(/check again in 72 hours/);
  expect(screen.queryByText(/elevated bacteria/i)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /County of San Diego/ })).toHaveAttribute("href", "https://www.sdbeachinfo.com/");
});
