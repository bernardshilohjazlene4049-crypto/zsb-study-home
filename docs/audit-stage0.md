# 阶段 0 审计

审计日期：2026-11-05。范围是仓库 `zsb-study-home` 在加入学习工作台之前的静态站，以及本轮为阶段 0 / 阶段 1 新增的入口。需求稿里「网页设计建设中」已经过时，以仓库里真实文件为准。

## 目录清单

旧站仍在原路径，本轮没有重命名或删除：

| 路径 | 现状 |
| --- | --- |
| `index.html` | 首页，浅色 Liquid Glass。科目卡片仍指向各科目页。 |
| `style.css`、`mobile.css`、`mobile.js` | 科目页共用样式和底部导航。本轮未改。 |
| `gs/` | 高等数学。`gs/index.html` 为第一章；`gs/videos/1.mp4`–`5.mp4`、`gs/mindmap.html`、`gs/practice.html` 以及 `gs/pvideos/` 逐题视频都还在。 |
| `jsj/` | 计算机基础。`jsj/index.html` 为 Excel 第四章；`jsj/videos/4.1.mp4`–`4.7.mp4`、`jsj/mm.html` 都还在。 |
| `c/` | C 语言。`c/index.html` 已上线，页面自己写明正式题库建设中，并有图片示例。 |
| `yy/` | 英语。`yy/index.html` 含专题三至六、6 集视频和导图。 |
| `wy/` | 网页设计。`wy/index.html` 已上线，含 HTML / HTML5 / CSS / JS 课页和第 2 章视频。 |
| `shots/` | 旧截图，未改。 |

仓库中没有 `database/`、`network/` 或计算机网络、数据库的独立 `index.html`。这两科在新目录里是 `status: "building"`，`homeUrl: null`，页面不放链接。

本轮新增，不替换旧入口：

- `study/index.html`：学习工作台。
- `tower/index.html`：阶段 5 占位，链回工作台和旧首页。
- `assets/css/tokens.css`、`assets/css/study.css`：只作用于新页面。
- `assets/js/core/`：IndexedDB、事件名、schema、备份、路径。
- `assets/js/features/`：目录、知识点、视频、导图、练习、错题。
- `assets/js/adapters/status.js`：AI / 识题 / 同步 / 实验室的未连接状态。
- `assets/js/app.js`、`assets/js/bridge-api.js`。
- `study-bridge.js`：可选桥。旧科目页没有引用它。
- `config/site.json`、`data/subjects.json`、`data/topics.json`、`data/resources.json`、`data/video-anchors.json`、`data/questions/sample.json`。
- `docs/audit-stage0.md`、`docs/stage1-验收.md`、`tests/`。

## 旧路由

这些地址继续由原来的文件提供，工作台只是多出来的入口：

- `/index.html`，以及页内 `#subjects`、`#progress`、`#method`
- `gs/index.html`、`gs/mindmap.html`、`gs/practice.html`
- `jsj/index.html`、`jsj/mm.html`
- `c/index.html`
- `yy/index.html`
- `wy/index.html`，以及 `wy/html/`、`wy/html5/`、`wy/css/`、`wy/js/`、`wy/examples/`、`wy/reference/`
- 科目页底部导航仍由 `mobile.js` 指向上述旧页

首页新增三处可逆链接，都是相对路径 `study/index.html`，文案为「学习工作台」：顶栏、首屏文字按钮、科目索引说明。科目卡片没有拆掉。科目页导航和 `mobile.js` 底部六栏没有加项，避免把旧导航挤坏。

`gs/practice.html` 里的逐题视频和讲义题没有抄进新题库。C 语言那 5 张图片题也没有做 OCR 或转写。新题只有 `data/questions/sample.json`，`provenance.kind` 都是 `sample`。

## 兼容风险

- 首页 `index.html` 使用页内样式；科目页使用 `style.css` 的绿色主题。新工作台样式只写在 `assets/css/`，不改 `style.css`。
- 首页小屏顶栏原来是单行。加入「学习工作台」后，窄屏改为换行，链接最小高度 44px。桌面科目卡片布局未改。
- `study-bridge.js` 未挂到旧页。旧页不调用它也能独立打开；需要时由页面自行引用。
- 示例题答案在公开 JSON 里。练习页提交前不把解析放进页面，但不能阻止查看源码。正式题的未公开答案不应提交进仓库。
- 视频锚点全部 `verified: false`，文件里没有 `start_sec` / `end_sec`。播放器从片头播放，并写明「暂无定位」。`gs/pvideos/` 数量很多，本轮没有逐条登记秒点。
- 目录是站点导航草案，`verified` 不是官方考纲。搜索「洛必达」会命中高数第 4 集标题里已有的「洛必达衔接」，没有新造章节。
- 学习记录在浏览器 IndexedDB `zsb-study`，学习者固定为 `local-guest`。换浏览器、清站点数据或无痕模式都不会带着记录。没有云同步。
- 可选第 8 科「数字电子技术」默认关闭，开关只写 `localStorage`，不改已有记录，也不计入七科。

## base path 策略

站点部署在 `https://bernardshilohjazlene4049-crypto.github.io/zsb-study-home/`。新页面禁止写以 `/` 开头的站点根路径。

- 文档之间用相对地址，例如首页 `study/index.html`，工作台回到首页由模块位置解析。
- `assets/js/core/paths.js` 的 `siteUrl()` 用 `new URL("../../../", import.meta.url)` 得到仓库根，再拼接仓库相对路径。
- `study-bridge.js` 用 `document.currentScript.src` 找仓库根。
- 数据文件里的视频、封面、原页面都是仓库相对路径，例如 `gs/videos/1.mp4`。
- 本地用仓库根提供静态文件，以及用上一层目录模拟 `/zsb-study-home/` 前缀，两条路径下的页面、视频和原科目链接都能打开。见 `docs/stage1-验收.md`。
