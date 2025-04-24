import { existsSync, mkdirSync } from "fs";
import { Jimp } from "jimp";
import { homedir } from "os";
import { join } from "path";
import { chromium } from "playwright";
import { cwd } from "process";

const browserCacheDir = join(
  homedir(),
  "playwright",
  "chromium",
  `session-${Date.now()}`
);
const sharedBrowserOptions = {
  headless: true,
  handleSIGTERM: false,
};
const sharedContextOptions = {
  deviceScaleFactor: 1,
  viewport: { width: 1920, height: 1080 },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.26 Safari/537.36",
  timeZoneId: "America/Los_Angeles",
  locale: "en-US",
};

const extPath = `${join(cwd(), "darkreader")}`;

const chromeArgs = [
  `--disable-extensions-except=${extPath}`,
  "--headless=new",
  // "--no-first-run",
  // "--renderer-process-limit=4",
  // "--disable-site-isolation-for-policy",
  // "--disable-site-isolation-trials",
  // "--autoplay-policy=user-gesture-required",
  // "--disable-add-to-shelf",
  // "--disable-desktop-notifications",
  // "--use-fake-device-for-media-stream",
  // "--use-fake-ui-for-media-stream",
  // "--ignore-gpu-blocklist",
  // "--use-gl=angle",
  // "--use-angle=gl-egl",
  // "--force-device-scale-factor=1",
  // "--device-scale-factor=1",
  // "--window-size=1920,1080",
];

async function main() {
  if (!existsSync(join(extPath, "manifest.json"))) {
    throw new Error("darkreader extension not found");
  }
  console.log("loading extension from", extPath);

  if (!existsSync(browserCacheDir)) {
    mkdirSync(browserCacheDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(browserCacheDir, {
    ...sharedBrowserOptions,
    ...sharedContextOptions,
    ignoreDefaultArgs: [
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
    ],
    args: chromeArgs,
    baseURL: "https://google.com",
  });
  const page = context.pages()[0]!;
  await page.goto("https://google.com", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForEvent("load");
  await page.waitForTimeout(10_000);

  const buff1 = await page.screenshot({
    type: "jpeg",
    scale: "css",
    timeout: 3_000,
  });
  const image1 = await Jimp.fromBuffer(buff1);
  const dim1 = {
    width: image1.width,
    height: image1.height,
  };
  console.log("done 1st screenshot", Date.now());

  await page.waitForTimeout(5_000);
  const buff2 = await page.screenshot({
    type: "jpeg",
    scale: "css",
    timeout: 3_000,
  });
  const image2 = await Jimp.fromBuffer(buff2);
  const dim2 = {
    width: image2.width,
    height: image2.height,
  };
  console.log("done 2nd screenshot", Date.now());

  if (dim1.width !== dim2.width || dim1.height !== dim2.height) {
    throw new Error(
      `screenshots are different sizes: ${dim1.width}x${dim1.height} vs ${dim2.width}x${dim2.height}`
    );
  }
  if (dim1.width !== 1920 || dim1.height !== 1080) {
    throw new Error(
      `screenshots are the wrong size: ${dim1.width}x${dim1.height}`
    );
  }
  process.exit(0);
}

void main();
