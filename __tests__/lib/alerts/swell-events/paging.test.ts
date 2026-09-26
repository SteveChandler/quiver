import { readAllPages } from "@/lib/alerts/swell-events/paging";

function server(total: number, cap: number) {
  const calls: Array<[number, number]> = [];
  const fetchPage = jest.fn(async (offset: number, limit: number) => {
    calls.push([offset, limit]);
    const count = Math.max(0, Math.min(limit, cap, total - offset));
    return Array.from({ length: count }, (_, index) => offset + index);
  });
  return { fetchPage, calls };
}

describe("readAllPages", () => {
  it("stops on a short page once the first page showed the cap", async () => {
    const { fetchPage, calls } = server(2500, 5000);
    const rows = await readAllPages(fetchPage, 1000);
    expect(rows).toHaveLength(2500);
    expect(calls).toEqual([[0, 1000], [1000, 1000], [2000, 1000]]);
  });

  it("reads everything under a server cap smaller than the page size", async () => {
    const { fetchPage, calls } = server(950, 400);
    const rows = await readAllPages(fetchPage, 1000);
    expect(rows).toEqual(Array.from({ length: 950 }, (_, index) => index));
    expect(calls.map(([offset]) => offset)).toEqual([0, 400, 800]);
  });

  it("confirms a short first page with one empty read", async () => {
    const { fetchPage, calls } = server(30, 1000);
    expect(await readAllPages(fetchPage, 1000)).toHaveLength(30);
    expect(calls).toEqual([[0, 1000], [30, 1000]]);
  });
});
