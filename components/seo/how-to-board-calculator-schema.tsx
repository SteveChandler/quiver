export function HowToBoardCalculatorSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Choose the Right Surfboard Volume",
    description:
      "A step-by-step guide to calculating the right surfboard volume (liters) based on your weight, skill level, fitness, and the waves you ride.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Convert your weight to kilograms",
        text: "The formula uses kilograms. If you weigh in pounds, divide by 2.205. For example, 180 lbs ÷ 2.205 = 81.6 kg.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Choose your skill level multiplier",
        text: "Your skill level multiplier determines how much volume you need relative to your weight. Beginner: 0.55. Intermediate: 0.45. Advanced: 0.38. Expert: 0.34. Beginners need more volume for stability and paddle power.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Apply fitness and wave size adjustments",
        text: "Multiply by your fitness factor (normal: 1.0, athletic: 0.95, very fit: 0.90) and your wave size preference (small: 1.05, medium: 1.0, large: 0.95). Fitter surfers and those riding bigger waves can handle less volume.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Calculate recommended volume",
        text: "Multiply weight(kg) × skill multiplier × fitness factor × wave size factor = recommended volume in liters. Add or subtract 10–15% for the acceptable range.",
      },
      {
        "@type": "HowToStep",
        position: 5,
        name: "Choose your board type",
        text: "Match the volume to a board shape: high volume (55L+) → longboard or foamie; mid-range (35–55L) → funboard or fish; lower volume (20–35L) → shortboard or step-up. Factor in the waves you typically surf.",
      },
    ],
    tool: [
      {
        "@type": "HowToTool",
        name: "Surfboard Volume Calculator",
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
