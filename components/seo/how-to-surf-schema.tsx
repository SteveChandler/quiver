interface HowToSurfSchemaProps {
  beachName: string;
  waterTemp?: number | null;
  bestTide?: string | null;
  accessTips?: string | null;
  localEtiquette?: string | null;
}

export function HowToSurfSchema({
  beachName,
  waterTemp,
  bestTide,
  accessTips,
  localEtiquette,
}: HowToSurfSchemaProps) {
  type HowToStep = {
    "@type": "HowToStep";
    position: number;
    name: string;
    text: string;
  };

  const steps: HowToStep[] = [];
  let position = 1;

  steps.push({
    "@type": "HowToStep",
    position: position++,
    name: `Check conditions at ${beachName}`,
    text: `Review the latest surf report including wave height, wind direction, and tide for ${beachName} before heading out.`,
  });

  if (waterTemp != null) {
    steps.push({
      "@type": "HowToStep",
      position: position++,
      name: "Choose your gear",
      text: `Water temperature is currently around ${waterTemp}°F. Choose your wetsuit thickness accordingly — a 3/2mm for temps above 62°F, 4/3mm for 55-62°F, or 5/4mm for below 55°F.`,
    });
  }

  if (bestTide) {
    steps.push({
      "@type": "HowToStep",
      position: position++,
      name: "Time your session",
      text: `The preferred tide at ${beachName} is ${bestTide}. Check the tide chart for optimal windows.`,
    });
  }

  if (accessTips) {
    steps.push({
      "@type": "HowToStep",
      position: position++,
      name: "Find the lineup",
      text: `Access tips for ${beachName}: ${accessTips}`,
    });
  }

  steps.push({
    "@type": "HowToStep",
    position: position++,
    name: "Know the etiquette",
    text: localEtiquette
      ? localEtiquette
      : "Respect the lineup, don't drop in on other surfers, and be mindful of swimmers and other ocean users.",
  });

  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to Surf at ${beachName}`,
    description: `A guide to surfing at ${beachName} with real-time conditions data.`,
    step: steps,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
