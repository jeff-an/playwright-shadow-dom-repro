import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { chromium } from "playwright";

const browserCacheDir = join(homedir(), "playwright", "chromium", `session-${Date.now()}`);

const sharedBrowserOptions = {
  headless: true,
  handleSIGTERM: false,
  channel: "chrome",
  chromiumSandbox: false,
}

const sharedContextOptions = {
  deviceScaleFactor: 1,
  viewport: { width: 1920, height: 1080 },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.26 Safari/537.36",
  timeZoneId: "America/Los_Angeles",
  locale: "en-US",
}

const chromeArgs: string[] = [
  // resource optimization
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--renderer-process-limit=2",

  // disable out of process frames, which prevent us from being able to get iframe content reliably
  // see: https://www.chromium.org/developers/design-documents/oop-iframes/
  // and: https://github.com/puppeteer/puppeteer/issues/2548
  "--disable-site-isolation-for-policy",
  "--disable-site-isolation-trials",

  // https://jtway.co/optimize-your-chrome-options-for-testing-to-get-x1-25-impact-4f19f071bf45
  "--autoplay-policy=user-gesture-required",
  "--disable-add-to-shelf",
  "--disable-desktop-notifications",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",

  // enable hardeware acceleration
  // https://github.com/microsoft/playwright/issues/11627
  // https://github.com/microsoft/playwright/issues/11627
  "--ignore-gpu-blocklist",
  "--use-gl=angle",
  "--use-angle=gl-egl",
];

async function test() {
  if (!existsSync(browserCacheDir)) {
    mkdirSync(browserCacheDir, { recursive: true });
  }

  const browser = await chromium.launch(
    {
      ...sharedBrowserOptions,
      args: chromeArgs,
    },
  );
  const context = await browser.newContext(sharedContextOptions);
  const page = await context.newPage()
  const cdpSession = await context.newCDPSession(page)
  cdpSession.on("Inspector.targetCrashed", (payload) => {
    console.log("Inspector.targetCrashed", payload);
    process.exit(1)
  })
  
  await page.goto("https://google.com")

  await page.goto(
    "https://clip.opus.pro/dashboard/404",
    {
      waitUntil: "domcontentloaded"
    }
  );

  const [upperBound, leftBound, width, height, devicePixelRatio] =
  await page.evaluate(() => {
    return [
      window.scrollY,
      window.scrollX,
      window.screen.width,
      window.screen.height,
      window.devicePixelRatio,
    ];
  });
  console.log("got viewport deets")

  await cdpSession.send("Page.captureScreenshot", { format: "jpeg" })
  console.log("screenshot captured")

  const [html, a11y] = await Promise.all([
    page.evaluate(() => {
    const bodyCopy = document.body.cloneNode(true) as HTMLElement
    const allElements = bodyCopy.getElementsByTagName("*");
    return bodyCopy.outerHTML;
  }, { timeout: 5000 }),
    (async () => {
      await page.evaluate(() => {
        const stack: Element[] = [document.body];
        let currentId = 1;
    
        while (stack.length > 0) {
          const element = stack.pop();
          if (!element) {
            continue;
          }
    
          element.setAttribute("data-momentic-id", `${currentId}`);
          element.setAttribute("aria-keyshortcuts", `${currentId}`);
          currentId++;
    
          if (element.shadowRoot) {
            for (const node of element.shadowRoot.children) {
              stack.push(node);
            }
          }
    
          if (element.children) {
            for (let i = element.children.length - 1; i >= 0; i--) {
              stack.push(element.children[i]);
            }
          }
        }
      })
      await cdpSession.send("Accessibility.enable")
      const { node: root } = await cdpSession.send("Accessibility.getRootAXNode")
      const rootBackendId = root.backendDOMNodeId
      const { nodes } = await cdpSession.send("Accessibility.queryAXTree", {
        backendNodeId: rootBackendId
      })
      return nodes;
    })()
  ])
  console.log("raw html received", html.length)
  console.log("a11y tree received", a11y.length)
}

async function main() {
  for (let i = 0; i < 25; i++) {
    await test();
  }
}

void main();
