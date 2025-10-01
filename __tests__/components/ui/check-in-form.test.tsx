import { describe, it, expect, beforeEach, vi } from "../../setup/vitest-shim";
import { render, waitFor } from "@testing-library/react";

const submitCheckInMock = vi.fn();

vi.mock("@/actions/check-in-actions", () => ({
  submitCheckIn: (...args: any[]) => submitCheckInMock(...args),
}));

const latestProps: { current: any } = { current: null };
vi.mock("@/components/intel/intel-post-form", () => {
  const React = require("react");
  return {
    __esModule: true,
    IntelPostForm: vi.fn((props: any) => {
      latestProps.current = props;
      return React.createElement("div", { "data-testid": "intel-post-form" });
    }),
  };
});

const { CheckInDialog } = require("@/components/ui/check-in-form");

describe("CheckInDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitCheckInMock.mockReset();
    latestProps.current = null;
  });

  it("invokes submitCheckIn via beforeSubmit", async () => {
    submitCheckInMock.mockImplementation(() =>
      Promise.resolve({ success: true })
    );

    render(
      <CheckInDialog
        isOpen
        beachId="beach-123"
        beachName="Ocean"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => expect(latestProps.current).toBeTruthy());
    const props = latestProps.current;
    await props.beforeSubmit?.({
      values: {
        wave_height: 3,
        wind_speed: 10,
        wind_direction: "NW",
        water_temp: 70,
        crowd_level: 4,
        description: "Fun session",
        forecast_accuracy: "accurate",
      },
      location: { latitude: 32.7, longitude: -117.2 },
      beachId: "beach-123",
    });

    expect(submitCheckInMock).toHaveBeenCalledWith("beach-123", {
      wave_height: 3,
      wind_speed: 10,
      wind_direction: "NW",
      water_temp: 70,
      crowd_level: 4,
      vibe: "Fun session",
      forecast_accuracy_rating: "accurate",
    });
  });

  it("propagates onSuccess after IntelPostForm success", async () => {
    submitCheckInMock.mockImplementation(() =>
      Promise.resolve({ success: true })
    );
    const onSuccess = vi.fn();

    render(
      <CheckInDialog
        isOpen
        beachId="beach-123"
        beachName="Ocean"
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => expect(latestProps.current).toBeTruthy());
    const props = latestProps.current;
    await props.beforeSubmit?.({
      values: { forecast_accuracy: "accurate" },
      location: { latitude: 0, longitude: 0 },
    });
    props.onSuccess?.(null);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("throws when submitCheckIn fails", async () => {
    submitCheckInMock.mockImplementation(() =>
      Promise.resolve({ success: false, error: "fail" })
    );

    render(
      <CheckInDialog
        isOpen
        beachId="beach-123"
        beachName="Ocean"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => expect(latestProps.current).toBeTruthy());
    const props = latestProps.current;
    await expect(
      props.beforeSubmit?.({
        values: { forecast_accuracy: "accurate" },
        location: { latitude: 0, longitude: 0 },
      })
    ).rejects.toThrow("fail");
  });

  it("calls onClose when IntelPostForm invokes onClose", async () => {
    submitCheckInMock.mockImplementation(() =>
      Promise.resolve({ success: true })
    );
    const onClose = vi.fn();

    render(
      <CheckInDialog
        isOpen
        beachId="beach-123"
        beachName="Ocean"
        onClose={onClose}
      />
    );

    await waitFor(() => expect(latestProps.current).toBeTruthy());
    latestProps.current.onClose?.();

    expect(onClose).toHaveBeenCalled();
  });
});
