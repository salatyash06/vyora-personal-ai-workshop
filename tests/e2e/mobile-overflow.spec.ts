import { expect, test, type Page } from "@playwright/test";

// The local backend is replaced by in-test route handlers, so no real service is needed.
const API = "http://127.0.0.1:8000/api";
const now = new Date().toISOString();

async function mockBackend(page: Page) {
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
  await page.route(`${API}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    if (path.endsWith("/status"))
      return route.fulfill(
        json({ ok: true, model: "llama3.1:8b", model_loaded: true, ai_reachable: true, speech_model_ready: true, busy: false, voice_busy: false, voice_stage: "idle", speaking: false, speech_error: null }),
      );
    if (path.endsWith("/system")) return route.fulfill(json({ cpu_percent: 5, ram_percent: 40, battery_percent: null, plugged_in: null }));
    if (path.endsWith("/audio/devices")) return route.fulfill(json([]));
    if (path.endsWith("/notes")) return route.fulfill(json([]));
    if (path.includes("/messages"))
      return route.fulfill(
        json([{ id: 1, role: "assistant", content: "A".repeat(400) + " https://example.com/" + "x".repeat(200), created_at: now }]),
      );
    if (path.endsWith("/conversations"))
      return route.fulfill(json([{ id: 1, title: "A very long conversation title ".repeat(6), updated_at: now }]));
    return route.fulfill(json({ ok: true }));
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

for (const width of [390, 768]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockBackend(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expectNoHorizontalOverflow(page);

    await page.getByLabel(/token/i).fill("test-token");
    await page.getByRole("button", { name: /connect/i }).click();
    await expect(page.getByRole("heading", { name: "Assistant" })).toBeVisible();
    await page.getByRole("textbox").first().fill("W".repeat(300));
    await expectNoHorizontalOverflow(page);

    for (const path of ["/notes", "/settings"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expectNoHorizontalOverflow(page);
    }
  });
}
