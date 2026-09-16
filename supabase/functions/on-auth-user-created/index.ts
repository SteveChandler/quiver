// Auth webhooks must never bypass lifecycle reservations and contact policy.
Deno.serve(() => new Response(JSON.stringify({
  status: "retired",
  replacement: "/api/cron/email-lifecycle",
  sent: 0,
}), {
  status: 410,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
}));
