import { chromium } from "playwright";

async function main() {
  console.log("starting", Date.now());
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(
    "https://usa.gov"
  );
  console.log("done", Date.now());
  process.exit(0);
}

void main();

