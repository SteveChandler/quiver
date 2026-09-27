/**
 * @jest-environment node
 */

const fs = require("node:fs");
const path = require("node:path");

// The app's email confirmation lands here with session tokens in the URL
// fragment. It must stay a static file that no third-party script can read.
describe("public/app-confirmed.html", () => {
  const html = fs.readFileSync(
    path.join(process.cwd(), "public", "app-confirmed.html"),
    "utf8",
  );
  const script = html.slice(html.lastIndexOf("<script>"), html.lastIndexOf("</script>"));

  it("loads no external or analytics scripts", () => {
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/posthog|sentry|gtag|googletagmanager|_vercel\/insights|<link[^>]+stylesheet/i);
    expect(html.match(/<script>/g)).toHaveLength(1);
  });

  it("clears the tokens from the address bar before using them", () => {
    const cleared = script.indexOf("history.replaceState");
    expect(cleared).toBeGreaterThan(-1);
    expect(cleared).toBeLessThan(script.indexOf("new URLSearchParams"));
    expect(cleared).toBeLessThan(script.indexOf("quiver://auth/callback"));
  });

  it("only hands the tokens to the app on a phone", () => {
    expect(script).toMatch(/if \(!onPhone\) return;[\s\S]*open\.href = 'quiver:\/\/auth\/callback'/);
  });

  it("stays out of search and never sends a referrer", () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
  });
});
