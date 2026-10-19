import { importStartedAt } from "@/lib/sessions/imports/import-start-time";

it.each([
  { value: null, expected: null },
  { value: [], expected: null },
  { value: "2026-10-17T12:00:00Z", expected: null },
  { value: {}, expected: null },
  { value: { inWaterStart: "water", startedAt: "header" }, expected: "water" },
  { value: { inWaterStart: null, startedAt: "header" }, expected: "header" },
  { value: { startedAt: "header" }, expected: "header" },
  { value: { inWaterStart: 42, startedAt: "header" }, expected: null },
  { value: { inWaterStart: "", startedAt: "header" }, expected: "" },
])("reads an import start from stored summary/header: $value", ({ value, expected }) => {
  expect(importStartedAt(value)).toBe(expected);
});
