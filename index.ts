import { chromium } from "playwright";

async function test() {
  console.log("starting", Date.now());
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://google.com");
  console.log("done", Date.now());
  await context.close();
  await browser.close();
}

async function main() {
  for (let i = 0; i < 25; i++) {
    await test();
  }
}

void main();
