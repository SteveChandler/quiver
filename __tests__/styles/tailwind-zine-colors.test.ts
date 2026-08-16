import postcss from "postcss";
import tailwindcss from "tailwindcss";
import tailwindConfig from "../../tailwind.config";

const expectedZineColors = {
  ink: ["--ink", "#11100D"],
  paper: ["--paper", "#F4EBD8"],
  "paper-shadow": ["--paper-shadow", "#E5D4B3"],
  "paper-deep": ["--paper-deep", "#D9C49C"],
  "stamp-red": ["--stamp-red", "#B91C1C"],
  "stamp-blue": ["--stamp-blue", "#0B3A75"],
  tape: ["--tape", "#C8A46B"],
  "tape-light": ["--tape-light", "#DCC18B"],
  "warning-black": ["--warning-black", "#0A0A08"],
  "hi-yellow": ["--hi-yellow", "#F2C94C"],
  ocean: ["--ocean", "#7FA7B8"],
  "q-twilight": ["--q-twilight", "#252D6B"],
  "q-bg-0": ["--q-bg-0", "#0D1020"],
  "q-bg-1": ["--q-bg-1", "#1A1535"],
  "q-orange": ["--q-orange", "#F78E42"],
  "q-cream": ["--q-cream", "#F5EEDC"],
} as const;

describe("Tailwind zine palette", () => {
  it("maps every zine token to its CSS variable and exact fallback", () => {
    const colors = tailwindConfig.theme?.extend?.colors as Record<string, unknown>;

    for (const [name, [variable, fallback]] of Object.entries(expectedZineColors)) {
      expect(colors[name]).toContain(`var(${variable}, ${fallback})`);
    }
  });

  it("keeps opacity modifiers working for variable-backed colors", async () => {
    const result = await postcss([
      tailwindcss({
        ...tailwindConfig,
        content: [
          {
            raw: '<div class="bg-ink bg-ink/40 text-paper border-q-orange"></div>',
            extension: "html",
          },
        ],
      }),
    ]).process("@tailwind utilities;", { from: undefined });

    expect(result.css).toContain(
      "background-color: color-mix(in srgb, var(--ink, #11100D) calc(0.4 * 100%), transparent)"
    );
    expect(result.css).toContain(
      "color: color-mix(in srgb, var(--paper, #F4EBD8) calc(var(--tw-text-opacity, 1) * 100%), transparent)"
    );
    expect(result.css).toContain(
      "border-color: color-mix(in srgb, var(--q-orange, #F78E42) calc(var(--tw-border-opacity, 1) * 100%), transparent)"
    );
  });
});
