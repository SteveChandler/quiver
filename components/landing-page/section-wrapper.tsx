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
}

export function SectionWrapper({
  children,
  className = "py-20 px-4",
  title,
  subtitle,
  titleClassName = "text-4xl md:text-5xl font-roboto font-bold text-dark-grey mb-4",
  subtitleClassName = "text-xl font-open-sans text-gray-600 max-w-2xl mx-auto",
  maxWidth = "6xl",
  centerContent = false,
}: SectionWrapperProps) {
  const containerClass = `max-w-${maxWidth} mx-auto`;
  const contentClass = centerContent ? "text-center" : "";

  return (
    <section className={className}>
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
