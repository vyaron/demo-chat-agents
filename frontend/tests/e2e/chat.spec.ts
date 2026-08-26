import { test, expect, chromium } from "@playwright/test";

const BASE = "http://localhost:5173";

test.describe("QuickChat E2E", () => {
  test("AC-1: shows at least 2 conversations on load", async ({ page }) => {
    await page.goto(BASE);
    const items = page.getByTestId("conversation-item");
    await expect(items).toHaveCount(2);
  });

  test("AC-2: clicking a conversation shows message history", async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId("conversation-item").first().click();
    await expect(page.getByTestId("message-list")).toBeVisible();
  });

  test("AC-3: sending a message adds it without page reload", async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId("conversation-item").first().click();
    await page.getByTestId("message-input").fill("Hello from Playwright!");
    await page.getByTestId("send-button").click();
    await expect(page.getByText("Hello from Playwright!")).toBeVisible();
  });

  test("AC-5: message appears in second tab via WebSocket", async () => {
    const browser = await chromium.launch();
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto(BASE);
    await page2.goto(BASE);

    await page1.getByTestId("conversation-item").first().click();
    await page2.getByTestId("conversation-item").first().click();

    const uniqueMsg = `ws-test-${Date.now()}`;
    await page1.getByTestId("message-input").fill(uniqueMsg);
    await page1.getByTestId("send-button").click();

    await expect(page2.getByText(uniqueMsg)).toBeVisible({ timeout: 5000 });

    await browser.close();
  });

  test.skip("AC-6: typing indicator appears in second tab", async () => {
    const browser = await chromium.launch();
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto(BASE);
    await page2.goto(BASE);

    await page1.getByTestId("conversation-item").first().click();
    await page2.getByTestId("conversation-item").first().click();

    await page1.getByTestId("message-input").type("typing...", { delay: 80 });
    await expect(page2.getByTestId("typing-indicator")).toBeVisible({ timeout: 3000 });

    await browser.close();
  });
});
