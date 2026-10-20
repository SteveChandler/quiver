import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WATCH_CONTRACT } from "@/lib/watch/contract";

it("keeps the checked-in watch contract mirror in sync; update both and bump contractVersion when a value changes", () => {
  const mirror = JSON.parse(readFileSync(join(process.cwd(), "lib/watch/watch-contract.json"), "utf8"));
  expect(mirror).toEqual(WATCH_CONTRACT);
});
