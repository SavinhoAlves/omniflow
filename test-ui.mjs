import { chromium } from "playwright";
import { mkdir } from "fs/promises";

const BASE = "http://localhost:3000";
const SHOTS = "./ui-screenshots";
const COMPANY = "empresa-demonstrativa";
const EMAIL   = "tenant@omniflow.local";
const PASS    = "123456";

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function ready() {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
}

// Login
await page.goto(BASE);
await ready();
await page.fill('input[name="companySlug"]', COMPANY);
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 8000 }).catch(() => {});
await ready();

const pages = [
  ["dashboard",    "/dashboard"],
  ["conversations","/conversations"],
  ["channels",     "/whatsapp"],
  ["departments",  "/departments"],
  ["users",        "/users"],
  ["workflows",    "/workflows"],
  ["reports",      "/reports"],
  ["settings",     "/settings"],
];

for (const [name, path] of pages) {
  await page.goto(BASE + path);
  await ready();

  if (name === "conversations") {
    // Click first conversation to open the chat + info panel
    const firstConv = page.locator('button.w-full.flex.items-start').first();
    if (await firstConv.count() > 0) {
      await firstConv.click();
      await page.waitForTimeout(1200);
    }
  }

  await shot(name);
  console.log("📸", name);
}

await browser.close();
