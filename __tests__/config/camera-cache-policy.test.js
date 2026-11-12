/** @jest-environment node */
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");

test("retired camera requests stop at the service worker and activation evicts only affected entries", async () => {
  const events = {};
  const keep = { url: "https://www.quiversurf.app/images/beach.jpg" };
  const source = { url: "https://www.quiversurf.app/api/beaches/spot/sources" };
  const thumbnail = { url: "https://www.quiversurf.app/_next/image?url=https%3A%2F%2Fstorage.hdontap.com%2Fa.jpg" };
  const caches = {
    has: jest.fn(async () => true),
    open: jest.fn(async () => ({ keys: async () => [keep, source, thumbnail], delete: remove })),
  };
  const remove = jest.fn();
  const self = { addEventListener: (name, handler) => { events[name] = handler; } };
  runInNewContext(readFileSync("public/camera-cache-policy.js", "utf8"), { self, caches, URL, Response });

  let response;
  const stopImmediatePropagation = jest.fn();
  events.fetch({ request: thumbnail, stopImmediatePropagation, respondWith: (value) => { response = value; } });
  expect(response.status).toBe(410);
  expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);

  let finished;
  events.activate({ waitUntil: (promise) => { finished = promise; } });
  await finished;
  expect(remove).toHaveBeenCalledWith(source);
  expect(remove).toHaveBeenCalledWith(thumbnail);
  expect(remove).not.toHaveBeenCalledWith(keep);
  expect(caches.open.mock.calls).toEqual([["beaches-api"], ["images"]]);
});
