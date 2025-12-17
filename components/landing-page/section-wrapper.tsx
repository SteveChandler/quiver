import { ReactNode } from "react";

interface SectionWrapperProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  maxWidth?: "4xl" | "6xl" | "7xl";
  centerContent?: boolean;
  "data-testid"?: string;
}

const MAX_WIDTH_CLASS: Record<
  NonNullable<SectionWrapperProps["maxWidth"]>,
  string
> = {
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export function SectionWrapper({
  children,
  className = "py-20 px-4",
  title,
  subtitle,
  titleClassName = "text-4xl md:text-5xl font-roboto font-bold text-dark-grey mb-4",
  subtitleClassName = "text-xl font-open-sans text-gray-600 max-w-2xl mx-auto",
  maxWidth = "6xl",
  centerContent = false,
  "data-testid": testId,
}: SectionWrapperProps) {
  const containerClass = `${MAX_WIDTH_CLASS[maxWidth]} mx-auto`;
  const contentClass = centerContent ? "text-center" : "";

  return (
    <section className={className} data-testid={testId}>
      <div className={containerClass}>
        {(title || subtitle) && (
          <div className={`${contentClass} mb-12 animate-fade-in-up`}>
            {title && <h2 className={titleClassName}>{title}</h2>}
            {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}
