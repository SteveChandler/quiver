import { notFound, redirect } from "next/navigation";
import { isNextRouterSignal } from "@/lib/utils/next-router-signal";

function thrownBy(fn: () => never): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("isNextRouterSignal", () => {
  it("recognises what the installed Next throws from notFound() and redirect()", () => {
    expect(isNextRouterSignal(thrownBy(() => notFound()))).toBe(true);
    expect(isNextRouterSignal(thrownBy(() => redirect("/map")))).toBe(true);
  });

  it("keeps recognising the legacy NEXT_NOT_FOUND digest", () => {
    expect(isNextRouterSignal({ digest: "NEXT_NOT_FOUND" })).toBe(true);
  });

  it("does not swallow ordinary errors", () => {
    expect(isNextRouterSignal(new Error("boom"))).toBe(false);
    expect(isNextRouterSignal(null)).toBe(false);
    expect(isNextRouterSignal({ digest: 42 })).toBe(false);
  });
});
