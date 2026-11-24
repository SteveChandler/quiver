/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

type BackgroundHandler = (payload: unknown) => unknown;

function loadServiceWorker(): { handler: BackgroundHandler; shown: Array<{ title: string; options: { body?: string } }> } {
  let handler: BackgroundHandler | null = null;
  const shown: Array<{ title: string; options: { body?: string } }> = [];
  const self = {
    registration: {
      showNotification: (title: string, options: { body?: string }) => {
        shown.push({ title, options });
        return Promise.resolve();
      },
    },
    addEventListener: () => undefined,
  };
  const firebase = {
    initializeApp: () => undefined,
    messaging: () => ({ onBackgroundMessage: (fn: BackgroundHandler) => { handler = fn; } }),
  };
  const source = readFileSync(path.join(process.cwd(), "public/firebase-messaging-sw.js"), "utf8");
  vm.runInNewContext(source, {
    importScripts: () => undefined,
    firebase,
    self,
    clients: {},
    console: { log: () => undefined, warn: () => undefined, error: () => undefined },
  });
  if (!handler) throw new Error("service worker registered no background handler");
  return { handler, shown };
}

describe("firebase-messaging-sw background messages", () => {
  it("shows a follow push with no body as its title alone, never 'New notification'", async () => {
    const { handler, shown } = loadServiceWorker();

    await handler({ notification: { title: "Kai followed you", body: "" }, data: { type: "follow" } });

    expect(shown).toEqual([expect.objectContaining({ title: "Kai followed you" })]);
    expect(shown[0].options.body).toBe("");
  });
});
