import { pushTitle } from "@/lib/notifications/copy/push-title";

it.each([
  ["x - - y", "x y"],
  ["A  -  B", "A B"],
  ["Beach –, 8 to 9 AM", "Beach, 8 to 9 AM"],
  ["--", ""],
  ["  Beach — – -- - North  ", "Beach North"],
  ["Beach--, 8 to 9 AM", "Beach, 8 to 9 AM"],
  ["Beach—North", "Beach North"],
  ["Beach - , 8 to 9 AM", "Beach, 8 to 9 AM"],
  ["  Beach\t\n North   ", "Beach North"],
  ["Beach--)", "Beach)"],
  ["Beach —)”", "Beach)”"],
  ["Cardiff--by-the-Sea", "Cardiff--by-the-Sea"],
  ["Cardiff-by-the-Sea", "Cardiff-by-the-Sea"],
  ["A well-known break", "A well-known break"],
  ["Beach - North", "Beach North"],
])("normalizes title %j to %j", (input, expected) => {
  expect(pushTitle(input)).toBe(expected);
  expect(pushTitle(pushTitle(input))).toBe(expected);
});
