import { spawn } from "node:child_process";

const base = process.argv[2] || "http://127.0.0.1:8765";
const port = 9333;
const profile = "/tmp/zsb-chrome-profile";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

class Page {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    this.errors = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        this.errors.push(message.params.exceptionDetails?.text || "exception");
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        const text = (message.params.args || []).map((arg) => arg.value || arg.description || "").join(" ");
        this.errors.push(text);
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text + " " + (result.exceptionDetails.exception?.description || ""));
    }
    return result.result?.value;
  }

  async text() {
    return this.eval("document.body.innerText");
  }

  async waitFor(snippet, timeout = 10000) {
    const start = Date.now();
    let last = "";
    while (Date.now() - start < timeout) {
      last = await this.text();
      if (last.includes(snippet)) return last;
      await sleep(200);
    }
    throw new Error(`未出现「${snippet}」\n${last.slice(0, 700)}`);
  }

  async goto(url) {
    await this.send("Page.navigate", { url });
    await sleep(400);
  }

  async click(snippet) {
    const found = await this.eval(`(() => {
      const needle = ${JSON.stringify(snippet)};
      const nodes = [...document.querySelectorAll("button, a, label, summary")];
      const node = nodes.find((item) => (item.innerText || "").includes(needle));
      if (!node) return false;
      node.click();
      return true;
    })()`);
    if (!found) throw new Error(`点不到「${snippet}」`);
  }
}

const chrome = spawn("google-chrome", [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank"
], { stdio: "ignore" });

let page;
try {
  let list = [];
  for (let i = 0; i < 40 && !list.length; i += 1) {
    try { list = await getJson(`http://127.0.0.1:${port}/json/list`); } catch { await sleep(200); }
  }
  const target = list.find((item) => item.type === "page");
  if (!target) throw new Error("没有打开浏览器页面");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  page = new Page(ws);
  await page.send("Runtime.enable");
  await page.send("Page.enable");
  await page.send("Network.enable");

  const checks = [];
  const check = (name, ok) => {
    checks.push(`${ok ? "通过" : "失败"} ${name}`);
    if (!ok) throw new Error(checks.at(-1));
  };

  async function openOld(path, snippet) {
    page.errors = [];
    await page.goto(`${base}/${path}`);
    const text = await page.waitFor(snippet);
    const status = await page.eval("document.contentType || document.contentType");
    check(`${path} 含「${snippet}」`, text.includes(snippet));
    check(`${path} 无页面脚本异常`, page.errors.filter((item) => item && !item.includes("favicon")).length === 0);
    return status;
  }

  await openOld("index.html", "学习工作台");
  check("首页仍有高等数学卡片", (await page.text()).includes("高等数学"));
  check("首页仍有网页设计卡片", (await page.text()).includes("网页设计"));
  await openOld("gs/index.html", "高等数学");
  await openOld("jsj/index.html", "计算机基础");
  await openOld("c/index.html", "C语言");
  await openOld("yy/index.html", "英语");
  await openOld("wy/index.html", "网页设计");

  page.errors = [];
  await page.goto(`${base}/study/index.html#/home`);
  await page.waitFor("七科 · 7");
  check("工作台显示七科", (await page.text()).includes("七科 · 7"));

  await page.goto(`${base}/study/index.html#/subject/database`);
  await page.waitFor("暂无科目页");
  const dbHtml = await page.eval("document.body.innerHTML");
  check("数据库页没有失效链接", !dbHtml.includes('href="null"') && (await page.text()).includes("还没有章节"));

  await page.goto(`${base}/study/index.html#/subject/web_design`);
  await page.waitFor("打开原科目页");
  const webHref = await page.eval(`(() => {
    const node = [...document.querySelectorAll("a")].find((anchor) => (anchor.textContent || "").includes("打开原科目页"));
    return node ? node.href : "";
  })()`);
  check("网页设计原页链接指向 wy", webHref.includes("wy/index.html") && !webHref.startsWith("/wy"));

  await page.goto(`${base}/study/index.html#/subjects?q=${encodeURIComponent("洛必达")}`);
  await page.waitFor("两个重要极限");
  check("搜索洛必达命中已有视频标题", (await page.text()).includes("两个重要极限"));

  await page.goto(`${base}/study/index.html#/topic/c.identifier_sample`);
  await page.waitFor("待添加");
  check("没有视频的知识点显示待添加", (await page.text()).includes("待添加"));

  await page.goto(`${base}/study/index.html#/topic/math.domain`);
  await page.waitFor("暂无定位");
  const videoSrc = await page.eval(`document.querySelector("video")?.getAttribute("src") || ""`);
  const hasStart = await page.eval(`!!document.querySelector("video")?.getAttribute("src")?.includes("#t=")`);
  check("定义域视频使用已有文件", videoSrc.includes("gs/videos/1.mp4"));
  check("视频地址不是站点根绝对路径", !videoSrc.startsWith("/gs"));
  check("未写入虚构的时间锚", hasStart === false && (await page.text()).includes("暂无定位"));
  check("导图含定义域", (await page.eval(`document.querySelector("svg.mindmap")?.textContent || ""`)).includes("定义域"));
  const jumped = await page.eval(`(() => {
    const text = [...document.querySelectorAll("svg.mindmap text")].find((node) => node.textContent.includes("函数性质"));
    const group = text?.closest("g");
    if (!group) return false;
    group.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    return location.hash;
  })()`);
  check("导图点击进入对应知识点", String(jumped).includes("/topic/math.function_properties"));
  await page.waitFor("函数性质");

  await page.goto(`${base}/study/index.html#/quiz/q_sample_math_domain_001`);
  await page.waitFor("一次一题");
  const before = await page.eval("document.body.innerHTML");
  check("提交前页面不含解析", !before.includes("对任意实数都有定义"));
  await page.click("f(x) = 1/x");
  await page.click("提交答案");
  await page.waitFor("对任意实数都有定义");
  await page.click("不会想一步步学");
  await page.waitFor("作答编号");
  const firstText = await page.text();
  const firstId = (firstText.match(/作答编号\s+(\S+)/) || [])[1];
  check("第一次提交生成编号", Boolean(firstId));
  check("答错进入错题说明", firstText.includes("错题档案"));

  await page.goto(`${base}/study/index.html#/mistakes`);
  await page.waitFor("示例 · 1");
  check("错题本把示例单独列出", (await page.text()).includes("示例 · 1"));

  await page.click("重练");
  await page.waitFor("重练开始前不显示上次答案");
  const retryHtml = await page.eval("document.body.innerHTML");
  check("重练作答前不显示解析", !retryHtml.includes("对任意实数都有定义"));
  await page.click("f(x) = x²");
  await page.click("提交答案");
  await page.waitFor("对任意实数都有定义");
  await page.click("答对但不理解");
  await page.waitFor("共 2 条");
  const secondText = await page.text();
  check("重练后仍保留首次编号", secondText.includes(firstId) && secondText.includes("共 2 条"));

  await page.send("Page.reload", { ignoreCache: true });
  await page.waitFor("共 2 条");
  check("刷新后记录还在", (await page.text()).includes(firstId));

  const counts = await page.eval(`new Promise((resolve, reject) => {
    const request = indexedDB.open("zsb-study");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(["attempts", "mistake_entries"], "readonly");
      const attempts = tx.objectStore("attempts").getAll();
      const mistakes = tx.objectStore("mistake_entries").getAll();
      tx.oncomplete = () => resolve(JSON.stringify({
        attempts: attempts.result.length,
        first: mistakes.result[0] && mistakes.result[0].first_attempt_id,
        ids: mistakes.result[0] && mistakes.result[0].attempt_ids,
        category: mistakes.result[0] && mistakes.result[0].category,
        firstCategory: mistakes.result[0] && mistakes.result[0].first_category
      }));
    };
  })`);
  const stored = JSON.parse(counts);
  check("IndexedDB 有两条作答", stored.attempts === 2);
  check("错题档案保留第一次", stored.first === firstId && stored.ids.length === 2);
  check("答错与答对但不理解分开记录", stored.firstCategory === "wrong" && stored.category === "not_understood");

  await page.goto(`${base}/study/index.html#/topic/math.domain`);
  await page.waitFor("保存笔记");
  await page.eval(`document.querySelector("textarea[name=body]").value = "浏览器验收笔记"`);
  await page.click("保存笔记");
  await page.waitFor("上次保存");
  await page.send("Page.reload", { ignoreCache: true });
  await page.waitFor("上次保存");
  const noteBody = await page.eval(`document.querySelector("textarea[name=body]")?.value || ""`);
  check("刷新后笔记还在", noteBody.includes("浏览器验收笔记"));

  await page.goto(`${base}/study/index.html#/settings`);
  await page.waitFor("导出备份");
  const exported = await page.eval(`(async () => {
    const mod = await import(new URL("../assets/js/core/backup.js", location.href).href);
    window.__bundle = await mod.exportBundle();
    return JSON.stringify({
      schema: window.__bundle.schema_version,
      attempts: window.__bundle.stores.attempts.map((item) => item.id),
      notes: window.__bundle.stores.note_entries.map((item) => item.body)
    });
  })()`);
  const snapshot = JSON.parse(exported);
  check("导出包含两条作答和笔记", snapshot.attempts.length === 2 && snapshot.notes.some((body) => body.includes("浏览器验收笔记")));
  await page.click("清空本机学习记录");
  await page.click("再次点击确认清空");
  await page.waitFor("本机学习记录已清空");
  const afterWipe = await page.eval(`(async () => {
    const mod = await import(new URL("../assets/js/core/backup.js", location.href).href);
    const bundle = await mod.exportBundle();
    return bundle.stores.attempts.length + bundle.stores.note_entries.length;
  })()`);
  check("清空后作答和笔记不在库里", afterWipe === 0);
  await page.eval(`(() => {
    const input = [...document.querySelectorAll("input.file-input")].find((node) => node.closest("label")?.textContent.includes("导入学习备份"));
    const file = new File([JSON.stringify(window.__bundle)], "zsb-study-backup.json", { type: "application/json" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  await page.waitFor("导入完成");
  const restored = await page.eval(`(async () => {
    const mod = await import(new URL("../assets/js/core/backup.js", location.href).href);
    const bundle = await mod.exportBundle();
    return JSON.stringify({
      attempts: bundle.stores.attempts.map((item) => item.id).sort(),
      first: (bundle.stores.mistake_entries[0] || {}).first_attempt_id,
      note: (bundle.stores.note_entries[0] || {}).body || ""
    });
  })()`);
  const back = JSON.parse(restored);
  check("导入恢复作答编号与首次错误", JSON.stringify(back.attempts) === JSON.stringify([...snapshot.attempts].sort()) && back.first === firstId);
  check("导入恢复笔记", back.note.includes("浏览器验收笔记"));

  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await page.goto(`${base}/study/index.html#/home`);
  await page.waitFor("七科 · 7");
  const mobile = await page.eval(`(() => {
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const targets = [...document.querySelectorAll(".bottom-nav a, .bottom-nav button, .topbar .btn")]
      .map((node) => node.getBoundingClientRect().height);
    return JSON.stringify({ overflow, targets });
  })()`);
  const layout = JSON.parse(mobile);
  check("390px 宽没有横向溢出", layout.overflow <= 1);
  check("390px 导航触摸目标至少 44px", layout.targets.length > 0 && layout.targets.every((height) => height >= 44));
  await page.send("Emulation.clearDeviceMetricsOverride");

  await page.goto(`${base}/study/index.html#/ai`);
  await page.waitFor("即将开放");
  await page.goto(`${base}/study/index.html#/ocr`);
  await page.waitFor("即将开放");
  await page.goto(`${base}/tower/index.html`);
  await page.waitFor("进入该科目");
  const towerText = await page.text();
  check("指挥塔进入科目", towerText.includes("七层学习空间") && towerText.includes("进入该科目"));
  check("指挥塔不再出现实现说明", !towerText.includes("没有机器人") && !towerText.includes("尚未实现"));

  console.log(checks.join("\n"));
  console.log("BROWSER_SMOKE_OK");
} catch (error) {
  console.error(error?.stack || error);
  if (page) console.error("CONSOLE", page.errors);
  process.exitCode = 1;
} finally {
  chrome.kill("SIGKILL");
  await sleep(200);
}
