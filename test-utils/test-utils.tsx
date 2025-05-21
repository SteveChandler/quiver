import React, { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";

// Create a type for the router context
export type AppRouterInstance = {
  push: (href: string) => void;
  replace: (href: string) => void;
  prefetch: (href: string) => void;
  back: () => void;
  forward: () => void;
};

// Create a mock router context
export const RouterContext = React.createContext<AppRouterInstance>({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
});

// Provider component to wrap around your tests
export function AppRouterProvider({ children }: { children: ReactNode }) {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  };

  return (
    <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
  );
}

// Custom render method that includes the AppRouterProvider
export function renderWithAppRouter(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, {
    wrapper: AppRouterProvider,
    ...options,
  });
}
