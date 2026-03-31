export function HowToWaveConverterSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Convert Wave Heights Between Measurement Systems",
    description:
      "A guide to understanding and converting wave heights between face height (feet), face height (meters), Hawaiian scale, and back/trough height.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Know your starting measurement",
        text: "Identify what scale your wave height is in. Most surf forecasts use face height in feet (the height of the wave face as you'd see it while surfing). Hawaiian scale reports waves at roughly half the face height.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Convert to face height (feet)",
        text: "If starting from meters, multiply by 3.281 to get feet. If starting from Hawaiian scale, multiply by 2 to get approximate face height in feet. Face height in feet is the standard base unit.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Convert to your target unit",
        text: "From face height in feet: multiply by 0.3048 for meters, divide by 2 for Hawaiian scale, or multiply by 0.7 for back/trough height.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Use the reference table",
        text: "Compare your result to common surf descriptions: knee high (2ft / 0.6m / 1 Hawaiian), waist high (3ft / 0.9m / 1.5 Hawaiian), head high (5-6ft / 1.5-1.8m / 2.5-3 Hawaiian), overhead (7-8ft / 2.1-2.4m / 3.5-4 Hawaiian).",
      },
    ],
    tool: [
      {
        "@type": "HowToTool",
        name: "Wave Height Converter",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
