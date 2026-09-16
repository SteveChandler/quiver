import { act, render, screen, waitFor } from "@testing-library/react";
import { RipCurrentWarning } from "@/components/beach-detail/rip-current-warning";
import { createClient } from "@/lib/supabase/client";
import { apiCache } from "@/lib/utils/request-cache";
import live from "@/__tests__/fixtures/rip-current-live-20260907.json";

const props = { beachId: live.risk.beach_id, localDate: live.risk.valid_date, timezone: live.timezone };
const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn() };
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(live.observedAt));
  jest.clearAllMocks();
  apiCache.clear();
  jest.spyOn(createClient(), "from").mockReturnValue(query as never);
  query.maybeSingle.mockResolvedValue({ data: live.risk, error: null });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it("shows the captured live high-risk evidence without a disclosure click", async () => {
  render(<RipCurrentWarning {...props} />);
  expect(await screen.findByText("High rip-current risk")).toBeVisible();
  expect(screen.getByRole("complementary", { name: "Rip-current conditions" })).toHaveTextContent("NWS Surf Zone Forecast · Valid 2026-09-07 · Source updated Mon, Sep 7 5:40 AM");
  expect(query.eq).toHaveBeenCalledWith("beach_id", props.beachId);
  expect(query.eq).toHaveBeenCalledWith("valid_date", props.localDate);
  expect(screen.queryByRole("button")).toBeNull();
});

it.each([
  ["moderate", "Moderate rip-current risk"],
  ["high", "High rip-current risk"],
])("shows %s risk", async (risk_level, label) => {
  query.maybeSingle.mockResolvedValue({ data: { ...live.risk, risk_level }, error: null });
  render(<RipCurrentWarning {...props} />);
  expect(await screen.findByText(label)).toBeVisible();
});

it.each([
  [{ data: null, error: { message: "source unavailable" } }, "Rip-current update unavailable"],
  [{ data: null, error: null }, "Rip-current report unavailable"],
  [{ data: { ...live.risk, risk_level: "invalid" }, error: null }, "Rip-current update unavailable"],
  [{ data: { ...live.risk, fetched_at: "invalid" }, error: null }, "Rip-current update unavailable"],
  [{ data: { ...live.risk, valid_date: "2026-09-08" }, error: null }, "Rip-current update unavailable"],
])("does not turn a failed, missing or mismatched report into reassurance", async (response, label) => {
  query.maybeSingle.mockResolvedValue(response);
  render(<RipCurrentWarning {...props} />);
  expect(await screen.findByText(label)).toBeVisible();
  expect(screen.queryByText(/Low|High rip-current risk/)).toBeNull();
});

it("discards late results from a previous selected date", async () => {
  let resolveOld!: (value: unknown) => void;
  query.maybeSingle.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  query.maybeSingle.mockResolvedValueOnce({ data: { ...live.risk, valid_date: "2026-09-08", risk_level: "low" }, error: null });
  const view = render(<RipCurrentWarning {...props} />);
  view.rerender(<RipCurrentWarning {...props} localDate="2026-09-08" />);
  await waitFor(() => expect(query.maybeSingle).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  await act(async () => { resolveOld({ data: live.risk, error: null }); });
  expect(screen.queryByText("High rip-current risk")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
});
