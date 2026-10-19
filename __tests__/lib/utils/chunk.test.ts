import { chunk } from "@/lib/utils/chunk";

it("keeps item order and the refresh route's nonpositive-size fallback", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunk([], 2)).toEqual([]);
  expect(chunk([1, 2], 0)).toEqual([[1, 2]]);
});
