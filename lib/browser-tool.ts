import { tool } from "ai";
import { z } from "zod";
import { browserEvents, setBrowserOpen, startRecording, recordFrame, stopRecording } from "./browser-events";

// ---------------------------------------------------------------------------
// Singleton browser + page
// ---------------------------------------------------------------------------

let _browser: import("playwright").Browser | null = null;
let _page: import("playwright").Page | null = null;

async function getPage() {
  if (_page && _browser?.isConnected()) return _page;

  const { chromium } = await import("playwright");
  _browser = await chromium.launch({ headless: true });
  const context = await _browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  _page = await context.newPage();

  // Start CDP screencast for live streaming
  startScreencast(_page).catch(() => {});

  startRecording();
  setBrowserOpen(true);
  browserEvents.emit("open");
  return _page;
}

async function startScreencast(page: import("playwright").Page) {
  const cdp = await page.context().newCDPSession(page);
  cdp.on("Page.screencastFrame", (params: { data: string; sessionId: number }) => {
    browserEvents.emit("frame", params.data);
    recordFrame(params.data);
    cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 60,
    maxWidth: 1280,
    maxHeight: 800,
    everyNthFrame: 2,
  });
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
    _page = null;
    stopRecording();
    setBrowserOpen(false);
    browserEvents.emit("close");
  }
}

async function screenshot(): Promise<string> {
  const page = await getPage();
  const buf = await page.screenshot({ type: "png", fullPage: false });
  return buf.toString("base64");
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const browserTool = tool({
  description: `Control a sandboxed Chromium browser. The user sees a LIVE preview of the browser in real-time, so you do NOT need to take screenshots for them. Use "read" to get page content for yourself. Actions:
- "navigate": Go to a URL
- "screenshot": Capture the current view (user already sees this live — rarely needed)
- "click": Click an element by CSS selector
- "type": Type text into an element by CSS selector
- "scroll": Scroll the page (direction: "up" or "down")
- "read": Extract text content from the page or a specific selector. Use this to get data from pages.
- "evaluate": Run arbitrary JavaScript in the page and return the result
- "close": Close the browser session`,
  inputSchema: z.object({
    action: z.enum([
      "navigate",
      "screenshot",
      "click",
      "type",
      "scroll",
      "read",
      "evaluate",
      "close",
    ]),
    url: z.string().optional().describe("URL to navigate to"),
    selector: z.string().optional().describe("CSS selector for click/type/read"),
    text: z.string().optional().describe("Text to type into the element"),
    direction: z.enum(["up", "down"]).optional().describe("Scroll direction"),
    script: z.string().optional().describe("JavaScript to evaluate in the page"),
  }),
  execute: async (input) => {
    try {
      switch (input.action) {
        case "navigate": {
          if (!input.url) return { error: "url is required" };
          const page = await getPage();
          await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.waitForTimeout(1000);
          const title = await page.title();
          return { message: `Navigated to ${input.url}`, title };
        }
        case "screenshot": {
          await screenshot();
          return { message: "Screenshot taken — the user can see the live browser preview." };
        }
        case "click": {
          if (!input.selector) return { error: "selector is required" };
          const page = await getPage();
          await page.click(input.selector, { timeout: 5000 });
          await page.waitForTimeout(500);
          return { message: `Clicked "${input.selector}"` };
        }
        case "type": {
          if (!input.selector) return { error: "selector is required" };
          if (!input.text) return { error: "text is required" };
          const page = await getPage();
          await page.fill(input.selector, input.text, { timeout: 5000 });
          return { message: `Typed into "${input.selector}"` };
        }
        case "scroll": {
          const page = await getPage();
          const delta = input.direction === "up" ? -500 : 500;
          await page.mouse.wheel(0, delta);
          await page.waitForTimeout(300);
          return { message: `Scrolled ${input.direction ?? "down"}` };
        }
        case "read": {
          const page = await getPage();
          let content: string;
          if (input.selector) {
            content = await page.locator(input.selector).first().textContent({ timeout: 5000 }).then((t) => t ?? "");
          } else {
            content = await page.evaluate(() => document.body.innerText);
          }
          if (content.length > 8000) content = content.slice(0, 8000) + "\n...(truncated)";
          const title = await page.title();
          const url = page.url();
          return { title, url, content };
        }
        case "evaluate": {
          if (!input.script) return { error: "script is required" };
          const page = await getPage();
          const result = await page.evaluate(input.script);
          return { result: JSON.stringify(result, null, 2) };
        }
        case "close": {
          await closeBrowser();
          return { message: "Browser closed" };
        }
      }
    } catch (err) {
      return { error: String(err) };
    }
  },
});
