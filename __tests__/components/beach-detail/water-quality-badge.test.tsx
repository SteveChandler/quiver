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
    render(<WaterQualityBadge waterQuality={{ ...sample,
      status: county === "clear" ? "unknown" : county === "closure" ? "closure" : "advisory",
      county_advisory_status: county,
      county_checked_at: county === "unavailable" ? undefined : "2026-09-04T03:00:00Z",
    }} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("link", { name: /County of San Diego/ })).toHaveAttribute("href", "https://www.sdbeachinfo.com/");
    expect(screen.queryByText(/220|Enterococcus|Fecal Coliform|Latest sample|30-day exceedances|CEDEN/)).not.toBeInTheDocument();
    if (county === "clear") expect(screen.getByText("No current county advisory")).toBeInTheDocument();
    if (county === "unavailable") expect(screen.getByText("County status unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Water Quality: Good")).not.toBeInTheDocument();
  },
);
