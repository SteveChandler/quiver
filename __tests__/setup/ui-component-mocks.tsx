import React from "react";

// Mock Card UI components from @/components/ui/card
export const mockCardComponents = () => {
  jest.mock("@/components/ui/card", () => ({
    Card: ({ children, className }: any) => (
      <div className={className} data-testid="card">{children}</div>
    ),
    CardContent: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    CardHeader: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    CardTitle: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
  }));
};

// Mock all lucide-react icons using a Proxy for on-demand icon creation
export const mockLucideIcons = () => {
  jest.mock("lucide-react", () => {
    return new Proxy({}, {
      get: (_target: any, prop: string) => {
        if (prop === '__esModule') return true;
        // Convert PascalCase to kebab-case for test IDs
        const testId = prop.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') + '-icon';
        const Icon = (props: any) => React.createElement('svg', { 'data-testid': testId, ...props });
        Icon.displayName = prop;
        return Icon;
      },
    });
  });
};

// Mock next/link
export const mockNextLink = () => {
  jest.mock("next/link", () => {
    const Link = ({ children, href, ...props }: any) => React.createElement('a', { href, ...props }, children);
    Link.displayName = 'Link';
    return Link;
  });
};

// Mock next/image
export const mockNextImage = () => {
  jest.mock("next/image", () => ({
    __esModule: true,
    default: (props: any) => React.createElement('img', props),
  }));
};

// Mock cn utility from @/lib/utils
export const mockCnUtil = () => {
  jest.mock("@/lib/utils", () => ({
    cn: jest.fn((...args: any[]) => args.flat().filter(Boolean).join(" ")),
  }));
};
