import { Thermometer, Wind, Waves, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

interface MeasurementProps {
  value: number | string;
  unit?: string;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  variant?: "default" | "compact" | "large";
}

export function Measurement({
  value,
  unit,
  label,
  icon,
  className,
  variant = "default",
}: MeasurementProps) {
  const sizes = {
    compact: "text-xs",
    default: "text-sm",
    large: "text-base",
  };

  const iconSizes = {
    compact: "h-3 w-3",
    default: "h-4 w-4",
    large: "h-5 w-5",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {icon && (
        <span className={cn("text-muted-foreground", iconSizes[variant])}>
          {icon}
        </span>
      )}
      <span className={cn(sizes[variant])}>
        {label}:{" "}
        <strong>
          {value}
          {unit}
        </strong>
      </span>
    </div>
  );
}

// Specific measurement components
export function TemperatureMeasurement({
  value,
  type = "water",
  variant = "default",
  className,
}: {
  value: number;
  type?: "water" | "air";
  variant?: "default" | "compact" | "large";
  className?: string;
}) {
  const color = type === "water" ? "text-blue-500" : "text-orange-500";
  const label = type === "water" ? "Water" : "Air";

  return (
    <Measurement
      value={value}
      unit="°"
      label={label}
      icon={<Thermometer className={color} />}
      variant={variant}
      className={className}
    />
  );
}

export function WindMeasurement({
  speed,
  direction,
  gust,
  variant = "default",
  className,
}: {
  speed: number;
  direction?: string;
  gust?: number;
  variant?: "default" | "compact" | "large";
  className?: string;
}) {
  const windText = `${speed}mph${direction ? ` (${direction})` : ""}${
    gust ? ` ${gust}mph gusts` : ""
  }`;

  return (
    <Measurement
      value={windText}
      label="Wind"
      icon={<Wind className="text-gray-600" />}
      variant={variant}
      className={className}
    />
  );
}

export function WaveMeasurement({
  height,
  period,
  variant = "default",
  className,
}: {
  height: number;
  period?: number;
  variant?: "default" | "compact" | "large";
  className?: string;
}) {
  const waveText = `${height}ft${period ? ` ${period}s period` : ""}`;

  return (
    <Measurement
      value={waveText}
      label="Waves"
      icon={<Waves className="text-blue-600" />}
      variant={variant}
      className={className}
    />
  );
}

export function PressureMeasurement({
  value,
  variant = "default",
  className,
}: {
  value: number;
  variant?: "default" | "compact" | "large";
  className?: string;
}) {
  return (
    <Measurement
      value={value}
      unit=" mb"
      label="Pressure"
      icon={<Gauge className="text-purple-600" />}
      variant={variant}
      className={className}
    />
  );
}
