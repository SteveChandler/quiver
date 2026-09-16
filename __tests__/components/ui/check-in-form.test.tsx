import { render, waitFor } from "@testing-library/react";

const mockSubmitCheckIn = jest.fn();

jest.mock("@/actions/check-in-actions", () => ({
  submitCheckIn: (...args: any[]) => mockSubmitCheckIn(...args),
}));

const mockLatestProps: { current: any } = { current: null };
jest.mock("@/components/intel/intel-post-form", () => {
  const React = require("react");
  return {
    __esModule: true,
    IntelPostForm: jest.fn((props: any) => {
      mockLatestProps.current = props;
      return React.createElement("div", { "data-testid": "intel-post-form" });
    }),
  };
});

import { CheckInDialog } from "@/components/ui/check-in-form";

describe("CheckInDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitCheckIn.mockReset();
    mockLatestProps.current = null;
  });

  it("invokes submitCheckIn via beforeSubmit", async () => {
    mockSubmitCheckIn.mockImplementation(() =>
      Promise.resolve({ success: true })
    );

    render(
      <CheckInDialog
        isOpen
        beachId="beach-123"
        beachName="Ocean"
        onClose={jest.fn()}
      />
    );

    await waitFor(() => expect(mockLatestProps.current).toBeTruthy());
    const props = mockLatestProps.current;
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
      location: { lat: 32.7, lon: -117.2 },
      beachId: "beach-123",
    });

    expect(mockSubmitCheckIn).toHaveBeenCalledWith("beach-123", {
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
    mockSubmitCheckIn.mockImplementation(() =>
      Promise.resolve({ success: true })
    );
    const onSuccess = jest.fn();

    render(
      <CheckInDialog
        isOpen
        beachId="beach-123"
        beachName="Ocean"
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => expect(mockLatestProps.current).toBeTruthy());
    const props = mockLatestProps.current;
    await props.beforeSubmit?.({
      values: { forecast_accuracy: "accurate" },
      location: { lat: 0, lon: 0 },
    });
    props.onSuccess?.(null);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("throws when submitCheckIn fails", async () => {
    mockSubmitCheckIn.mockImplementation(() =>
      Promise.resolve({ success: false, error: "fail" })
    );

    render(
      <CheckInDialog
        isOpen
        beachId="beach-123"
        beachName="Ocean"
        onClose={jest.fn()}
      />
    );

    await waitFor(() => expect(mockLatestProps.current).toBeTruthy());
    const props = mockLatestProps.current;
    await expect(
      props.beforeSubmit?.({
        values: { forecast_accuracy: "accurate" },
        location: { lat: 0, lon: 0 },
      })
    ).rejects.toThrow("fail");
  });

  it("calls onClose when IntelPostForm invokes onClose", async () => {
    mockSubmitCheckIn.mockImplementation(() =>
      Promise.resolve({ success: true })
    );
    const onClose = jest.fn();

    render(
      <CheckInDialog
        isOpen
        beachId="beach-123"
        beachName="Ocean"
        onClose={onClose}
      />
    );

    await waitFor(() => expect(mockLatestProps.current).toBeTruthy());
    mockLatestProps.current.onClose?.();

    expect(onClose).toHaveBeenCalled();
  });
});
