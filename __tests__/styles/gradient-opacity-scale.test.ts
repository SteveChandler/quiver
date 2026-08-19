import { execSync } from "child_process";

/**
 * Tailwind v3 only emits an `/<opacity>` modifier when the value exists in the
 * theme's opacity scale (multiples of 5). An off-scale stop like
 * `from-[#252D6B]/92` silently produces no rule, `--tw-gradient-stops` stays
 * undefined, and the ENTIRE gradient collapses to `background-image: none`.
 *
 * That is invisible in review and in typecheck/lint — it shipped a hero whose
 * scrim never rendered, leaving white text unreadable on a bright photo. This
 * pins the scale so a broken gradient fails here instead of in production.
 */
describe("gradient stop opacity modifiers", () => {
  it("only uses opacity values Tailwind actually generates", () => {
    const matches = execSync(
      "grep -rEon '(from|via|to)-(\\[[^]]+\\]|[a-z]+(-[0-9]+)?)/[0-9]+' " +
        "--include='*.tsx' --include='*.ts' app components lib || true",
      { cwd: process.cwd(), encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );

    const offScale = matches
      .split("\n")
      .filter(Boolean)
      // `slide-in-from-left-1/2` and friends are fractions, not opacity modifiers.
      .filter((line) => !/-(left|top|right|bottom)-\d+\/\d+$/.test(line))
      .filter((line) => {
        const opacity = Number(line.slice(line.lastIndexOf("/") + 1));
        return Number.isFinite(opacity) && opacity % 5 !== 0;
      });

    expect(offScale).toEqual([]);
  });
});
