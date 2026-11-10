import {
  fetchBoardClassesByUser,
  fetchUserBoardClasses,
  orderBoardClasses,
} from "@/lib/profile/board-classes";
import { createTableClient } from "@/__tests__/helpers/table-client";

function row(n: number, user_id: string, board_type: string | null) {
  return { id: `b${String(n).padStart(5, "0")}`, user_id, board_type };
}

const boom = { data: null, error: { message: "boom" } };

function page(rows: unknown[]) {
  return { data: rows, error: null };
}

function userIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `u${index}`);
}

describe("fetchUserBoardClasses", () => {
  it("keeps Week Scout's single-user mapping", async () => {
    const { client } = createTableClient({
      rows: {
        boards: ["Soft Top", "longboard_2_plus_1", "softboard", "mystery", null].map(
          (boardType, index) => row(index, "u0", boardType)
        ),
      },
    });

    await expect(fetchUserBoardClasses(client, "u0")).resolves.toEqual(["foamie", "longboard"]);
  });

  it("returns [] when the single read fails", async () => {
    const { client } = createTableClient({ queue: { boards: [boom] } });

    await expect(fetchUserBoardClasses(client, "u0")).resolves.toEqual([]);
  });
});

describe("fetchBoardClassesByUser", () => {
  it("splits 250 users into chunks of 100 and pages past 1000 rows", async () => {
    const fullPage = Array.from({ length: 1000 }, (_, index) => row(index, "u0", "longboard"));
    const { client, inCalls, rangeCalls } = createTableClient({
      queue: {
        boards: [
          page(fullPage),
          page([row(1000, "u0", "longboard"), row(1001, "u1", "softboard"), row(1002, "u99", "mid-length")]),
          page([]),
          page([]),
        ],
      },
    });

    const result = await fetchBoardClassesByUser(client, userIds(250));

    expect(inCalls.map((values) => values.length)).toEqual([100, 100, 100, 50]);
    expect(rangeCalls).toEqual([[0, 999], [1000, 1999], [0, 999], [0, 999]]);
    expect(result.get("u0")).toEqual(["longboard"]);
    expect(result.get("u99")).toEqual(["mid-length"]);
    expect(result.get("u200")).toEqual([]);
    expect(result.size).toBe(250);
  });

  it("gives a user with no board rows an empty list", async () => {
    const { client } = createTableClient({
      rows: { boards: [row(1, "u1", "longboard")] },
    });

    const result = await fetchBoardClassesByUser(client, ["u1", "u2"]);

    expect(result.get("u1")).toEqual(["longboard"]);
    expect(result.get("u2")).toEqual([]);
  });

  it("gives the users of a failed chunk an empty list and does not throw", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = createTableClient({
      queue: { boards: [page([row(1, "u0", "longboard")]), boom] },
    });

    try {
      const result = await fetchBoardClassesByUser(client, userIds(150));

      expect(result.get("u0")).toEqual(["longboard"]);
      expect(result.get("u120")).toEqual([]);
      expect(result.size).toBe(150);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("[board-classes] batch read failed"),
        "boom"
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("gives the same class order whatever the board ids", async () => {
    const read = async (boardTypes: string[]) => {
      const { client } = createTableClient({
        rows: { boards: boardTypes.map((boardType, index) => row(index, "u0", boardType)) },
      });
      return (await fetchBoardClassesByUser(client, ["u0"])).get("u0");
    };

    await expect(read(["shortboard", "fish", "longboard"])).resolves.toEqual([
      "longboard",
      "fish",
      "shortboard",
    ]);
    await expect(read(["longboard", "shortboard", "fish"])).resolves.toEqual([
      "longboard",
      "fish",
      "shortboard",
    ]);
  });

  it("makes no query for no users", async () => {
    const { client, from } = createTableClient();

    await expect(fetchBoardClassesByUser(client, [])).resolves.toEqual(new Map());
    expect(from).not.toHaveBeenCalled();
  });
});

describe("orderBoardClasses", () => {
  it("makes the single read match the batch read whatever the row order", async () => {
    const boardTypes = ["shortboard", "fish", "longboard"];
    for (const rows of [boardTypes, [...boardTypes].reverse()]) {
      const single = createTableClient({
        rows: { boards: rows.map((boardType, index) => row(index, "u0", boardType)) },
      });
      const batch = createTableClient({
        rows: { boards: rows.map((boardType, index) => row(index, "u0", boardType)) },
      });

      const singleClasses = await fetchUserBoardClasses(single.client, "u0");
      const batchClasses = (await fetchBoardClassesByUser(batch.client, ["u0"])).get("u0");

      // precondition: the single read keeps row order, so the two reads differ without the helper
      expect(singleClasses).toEqual(rows);
      expect(orderBoardClasses(singleClasses)).toEqual(["longboard", "fish", "shortboard"]);
      expect(orderBoardClasses(singleClasses)).toEqual(batchClasses);
    }
  });

  it("dedupes and keeps the BOARD_CLASSES order", () => {
    expect(orderBoardClasses(["shortboard", "foamie", "shortboard", "longboard"])).toEqual([
      "foamie",
      "longboard",
      "shortboard",
    ]);
  });
});
