import React from "react";
import { render, screen } from "@testing-library/react";
import { useWatch, type Control } from "react-hook-form";
import "@testing-library/jest-dom";
import { EditProfileForm } from "@/components/edit-profile-form";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock("@/actions/profile-actions", () => ({
  updateProfile: jest.fn(),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-123" },
  }),
}));

jest.mock("@/context/profile-context", () => ({
  useProfileContext: () => ({
    profile: null,
    refreshProfile: jest.fn(),
  }),
}));

jest.mock("@/lib/utils/toast-utils", () => ({
  toastUtils: {
    profile: {
      updated: jest.fn(),
      updateFailed: jest.fn(),
    },
  },
}));

jest.mock("@/lib/data/client", () => ({
  invalidateProfileCache: jest.fn(),
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/hooks/use-scroll-to-element", () => ({
  useScrollToElement: () => ({ current: null }),
}));

jest.mock("@/components/profile/shared/avatar-upload", () => ({
  AvatarUpload: () => <div data-testid="avatar-upload" />,
}));

jest.mock("@/components/profile/shared/basic-info-fields", () => ({
  BasicInfoFields: () => <div data-testid="basic-info-fields" />,
}));

jest.mock("@/components/profile/shared/surf-info-fields", () => ({
  SurfInfoFields: () => <div data-testid="surf-info-fields" />,
}));

function MockNotificationsSection({ control }: { control: Control<any> }) {
  const pushEnabled = useWatch({ control, name: "notif_push_enabled" });
  return <div data-testid="notif-push-value">{String(pushEnabled)}</div>;
}

jest.mock("@/components/profile/notifications-section", () => ({
  NotificationsSection: MockNotificationsSection,
}));

describe("EditProfileForm", () => {
  it("defaults notif_push_enabled to false when initial data is missing the field", () => {
    render(
      <EditProfileForm
        initialData={{
          full_name: "Test User",
        }}
      />
    );

    expect(screen.getByTestId("notif-push-value")).toHaveTextContent("false");
  });
});
