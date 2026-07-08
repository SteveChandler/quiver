import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AlertsManagementPage } from "@/components/alerts/alerts-management-page";
import { useAuth } from "@/context/auth-context";

jest.mock("@/context/auth-context");
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));
jest.mock("@/components/alerts/condition-builder", () => ({
  ConditionBuilder: ({ conditions, onChange }: any) => (
    <div data-testid="condition-builder">
      <button
        type="button"
        onClick={() => onChange({ ...conditions, wind_speed_max_kt: 4 })}
      >
        Set clean wind
      </button>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...conditions,
            swell_height_min: 4,
            swell_height_max: 2,
          })
        }
      >
        Set invalid wave range
      </button>
    </div>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const rule = {
  id: "rule-1",
  user_id: "user-1",
  beach_id: "beach-1",
  name: "Small clean longboard waves - Bolsa Chica",
  preset_type: null,
  conditions: {
    swell_height_min: 1,
    swell_height_max: 3,
    wind_speed_max_kt: 5,
  },
  notify_email: false,
  notify_push: true,
  enabled: true,
  last_matched_at: null,
  auto_created_at: null,
  created_at: "2026-05-21T00:00:00Z",
  updated_at: "2026-05-21T00:00:00Z",
  beaches: {
    name: "Bolsa Chica",
    slug: "bolsa-chica",
    timezone: "America/Los_Angeles",
  },
};

const beachDetail = {
  id: "beach-1",
  name: "Bolsa Chica",
  slug: "bolsa-chica",
  lat: 33.695,
  lon: -118.047,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: 80,
  wind_offshore_tol_deg: 45,
  aspect_deg: 230,
  preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 4,
  preferred_tide_direction: "rising",
  swell_window_center_deg: 215,
  swell_window_halfwidth_deg: 35,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchWithRules(rules: unknown[] = [rule]) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url === "/api/alerts/rules" && method === "GET") {
      return jsonResponse({ data: rules });
    }
    if (url.startsWith("/api/beaches/search")) {
      return jsonResponse({
        data: [
          {
            id: "beach-1",
            name: "Bolsa Chica",
            slug: "bolsa-chica",
            city: "Huntington Beach",
            state: "CA",
          },
        ],
      });
    }
    if (url === "/api/beaches/beach-1") {
      return jsonResponse({ data: { beach: beachDetail } });
    }
    if (url === "/api/alerts/rules" && method === "POST") {
      return jsonResponse({ data: { ...rule, id: "created-rule" } }, 201);
    }
    if (url === "/api/alerts/rules/rule-1" && method === "PATCH") {
      return jsonResponse({ data: rule });
    }
    if (url === "/api/alerts/rules/rule-1" && method === "DELETE") {
      return jsonResponse({ ok: true });
    }

    throw new Error(`Unexpected fetch ${method} ${url}`);
  });

  global.fetch = fetchMock as jest.MockedFunction<typeof fetch>;
  return fetchMock;
}

describe("AlertsManagementPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "test@example.com" } as any,
      session: null as any,
      isLoading: false,
      isAuthenticated: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);
  });

  it("shows a sign-in path instead of the loader when signed out", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null as any,
      isLoading: false,
      isAuthenticated: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);
    const fetchMock = jest.fn();
    global.fetch = fetchMock as jest.MockedFunction<typeof fetch>;

    render(<AlertsManagementPage />);

    expect(screen.getByTestId("alerts-auth-required")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /sign in for condition alerts/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^sign in$/i })).toHaveAttribute(
      "href",
      "/auth/sign-in?redirectTo=/alerts",
    );
    expect(
      screen.getByRole("link", { name: /create account/i }),
    ).toHaveAttribute("href", "/auth/sign-up?redirectTo=/alerts");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("groups condition rules by beach and keeps similarity alerts out of the list", async () => {
    mockFetchWithRules([
      rule,
      {
        ...rule,
        id: "similarity-rule",
        name: "Similar to your best at Bolsa",
        preset_type: "similarity_match",
      },
    ]);

    render(<AlertsManagementPage />);

    expect(await screen.findByText("Bolsa Chica")).toBeInTheDocument();
    expect(screen.getByText("Small clean longboard waves - Bolsa Chica")).toBeInTheDocument();
    expect(screen.getByText("1-3 ft")).toBeInTheDocument();
    expect(screen.getByText("<= 5 kt wind")).toBeInTheDocument();
    expect(screen.queryByText("Similar to your best at Bolsa")).not.toBeInTheDocument();
  });

  it("renders the compact empty state when there are no condition rules", async () => {
    mockFetchWithRules([]);

    render(<AlertsManagementPage />);

    expect(
      await screen.findByRole(
        "heading",
        { name: "No condition alerts yet" },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search Bolsa, Huntington...")).toBeInTheDocument();
  });

  it("fetches full beach metadata before creating the longboard condition alert", async () => {
    const fetchMock = mockFetchWithRules([]);

    render(<AlertsManagementPage />);

    fireEvent.change(screen.getByPlaceholderText("Search Bolsa, Huntington..."), {
      target: { value: "Bolsa" },
    });

    const beachButton = await screen.findByRole("button", { name: /bolsa chica/i });
    fireEvent.click(beachButton);

    expect(await screen.findByTestId("alert-editor-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("alert-editor-save"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/alerts/rules",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const detailIndex = fetchMock.mock.calls.findIndex(([url]) => url === "/api/beaches/beach-1");
    const createIndex = fetchMock.mock.calls.findIndex(
      ([url, init]) => url === "/api/alerts/rules" && init?.method === "POST",
    );
    expect(detailIndex).toBeGreaterThan(-1);
    expect(createIndex).toBeGreaterThan(detailIndex);

    const createBody = JSON.parse(
      fetchMock.mock.calls[createIndex][1]?.body as string,
    ) as Record<string, unknown>;
    expect(createBody).toMatchObject({
      beach_id: "beach-1",
      name: "Small clean longboard waves - Bolsa Chica",
      preset_type: null,
      notify_push: true,
      notify_email: false,
      conditions: {
        swell_height_min: 1,
        swell_height_max: 3,
        wind_speed_max_kt: 5,
      },
    });
  });

  it("updates enabled state through the rule PATCH endpoint", async () => {
    const fetchMock = mockFetchWithRules([rule]);

    render(<AlertsManagementPage />);

    const row = await screen.findByTestId("alert-rule-rule-1");
    fireEvent.click(within(row).getByLabelText("Pause alert"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/alerts/rules/rule-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/alerts/rules/rule-1" && init?.method === "PATCH",
    );
    expect(JSON.parse(patchCall?.[1]?.body as string)).toEqual({ enabled: false });
  });

  it("fetches full beach metadata before editing a rule", async () => {
    const fetchMock = mockFetchWithRules([rule]);

    render(<AlertsManagementPage />);

    const row = await screen.findByTestId("alert-rule-rule-1");
    fireEvent.click(within(row).getByLabelText("Edit alert"));

    expect(await screen.findByTestId("alert-editor-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Set clean wind"));
    fireEvent.click(screen.getByTestId("alert-editor-save"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/alerts/rules/rule-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const detailIndex = fetchMock.mock.calls.findIndex(([url]) => url === "/api/beaches/beach-1");
    const patchIndex = fetchMock.mock.calls.findIndex(
      ([url, init]) => url === "/api/alerts/rules/rule-1" && init?.method === "PATCH",
    );
    expect(detailIndex).toBeGreaterThan(-1);
    expect(patchIndex).toBeGreaterThan(detailIndex);

    const updateBody = JSON.parse(fetchMock.mock.calls[patchIndex][1]?.body as string);
    expect(updateBody.conditions).toMatchObject({ wind_speed_max_kt: 4 });
  });

  it("blocks saving impossible wave ranges", async () => {
    const fetchMock = mockFetchWithRules([]);

    render(<AlertsManagementPage />);

    fireEvent.change(screen.getByPlaceholderText("Search Bolsa, Huntington..."), {
      target: { value: "Bolsa" },
    });

    const beachButton = await screen.findByRole("button", { name: /bolsa chica/i });
    fireEvent.click(beachButton);

    expect(await screen.findByTestId("alert-editor-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Set invalid wave range"));
    fireEvent.click(screen.getByTestId("alert-editor-save"));

    expect(
      await screen.findByText("Minimum wave height must be below the maximum."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => url === "/api/alerts/rules" && init?.method === "POST",
      ),
    ).toBe(false);
  });

  it("deletes a rule through the DELETE endpoint", async () => {
    const fetchMock = mockFetchWithRules([rule]);
    jest.spyOn(window, "confirm").mockReturnValue(true);

    render(<AlertsManagementPage />);

    const row = await screen.findByTestId("alert-rule-rule-1");
    fireEvent.click(within(row).getByLabelText("Delete alert"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/alerts/rules/rule-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
