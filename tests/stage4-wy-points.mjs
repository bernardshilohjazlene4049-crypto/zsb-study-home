import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { directoryTopics, lectureChapterIds, chapterPageNeighbors, tocChapterIds } from "../assets/js/shell/lecture.js";
import { chapterVideos } from "../assets/js/shell/subject.js";
import { buildModel } from "../assets/js/shell/model.js";
import { withResolvedTopics } from "../assets/js/features/records.js";
import { addAnchors, ignoreUi } from "../.github/scripts/search-anchors.mjs";
import { mapLearningTopics } from "../assets/js/features/topic-merges.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const json = path => JSON.parse(read(path));
const ids = ["s11", "s12", "s13", "s-extra", "s21", "s22", "s22b", "s23", "s24"];
const topicIds = ["web.concepts", "web.process", "web.layers", "web.tools", "web.s21", "web.s22", "web.s22b", "web.s23", "web.s24"];
const pathFor = id => `wy/ch${ids.indexOf(id) < 4 ? 1 : 2}/${id}.html`;
const pages = ids.map(pathFor).concat(["wy/ch1/index.html", "wy/ch2/index.html"]);
const norm = s => s.replace(/\s+/g, " ").trim();
const decode = s => s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e];
});
const text = html => norm(decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "")));
// 仅解析本套静态 HTML 的元素边界，支持任意层数的 div/ul/li；不靠非贪婪正则截断嵌套内容。
function nodes(html) {
  const result = [], stack = [], voids = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<\/?[a-z][^>]*>/gi)) {
    if (m[0].startsWith("<!--")) continue;
    const tag = m[0].match(/^<\/?([\w-]+)/)[1].toLowerCase();
    if (m[0].startsWith("</")) {
      const i = stack.findLastIndex(n => n.tag === tag);
      if (i >= 0) { const n = stack[i]; n.raw = html.slice(n.start, m.index + m[0].length); n.inner = html.slice(n.bodyStart, m.index); stack.length = i; }
    } else {
      const attrs = Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
      const n = { tag, attrs, start: m.index, bodyStart: m.index + m[0].length, raw: m[0], inner: "", parent: stack.at(-1) };
      result.push(n);
      if (!voids.has(tag) && !m[0].endsWith("/>")) stack.push(n);
    }
  }
  return result;
}
const has = (n, cls) => (n.attrs.class || "").split(/\s+/).includes(cls);
const parts = (html, cls) => nodes(html).filter(n => has(n, cls));
const byId = (html, id) => nodes(html).find(n => n.attrs.id === id);
const manifest = json("tests/fixtures/wy-entry-manifest.json");
const HAND = "只写 content=10（不写URL）表示每隔10秒刷新当前网页";

test("基线209条文字保留，原有速记标题只按用户要求改名", () => {
  const f = json("tests/fixtures/wy-ch12-legacy-text.json");
  assert.equal(f.baseline, "511d360f0514ba8f1b721643837b663dd6cf7078");
  assert.equal(f.blocks.length, 209);
  const all = pages.map(p => text(read(p))).join(" ");
  const RENAMED = { "自测要点（考前速记）": "自测要点" };
  assert.deepEqual(f.blocks.filter(s => s in RENAMED), Object.keys(RENAMED));
  assert.deepEqual(f.blocks.filter(s => !all.includes(RENAMED[s] ?? s)), []);
  for (const p of pages) assert.doesNotMatch(read(p), /速记/);
});

test("122条照片转写均在原文区；meta批注按任务书迁入s23", () => {
  const f = json("tests/fixtures/wy-ch12-transcript-text.json");
  assert.equal(Object.values(f).flat().length, 122);
  for (const [id, blocks] of Object.entries(f)) {
    const source = parts(read(pathFor(id)), "wy-source").map(n => text(n.inner)).join(" ");
    for (const block of blocks) {
      const actual = id === "s24" && block === HAND ? parts(read(pathFor("s23")), "wy-source").map(n => text(n.inner)).join(" ") : source;
      assert.ok(actual.includes(block), `${id}: ${block}`);
    }
  }
});

test("9张导图节点逐字一致，无添加或遗漏", () => {
  const f = json("tests/fixtures/wy-ch12-mindmap-text.json");
  for (const id of ids) {
    const source = parts(read(pathFor(id)), "wy-mm-src")[0].raw;
    assert.doesNotMatch(source, /〔手写〕/);
    const SR = '<span class="sh-sr">手写批注：</span>';
    const actual = [...source.matchAll(/<li><span(?: class="wy-mm-hand")?>([\s\S]*?)<\/span>(?=<ul|<\/li>)/g)].map(m => text(m[1].replaceAll(SR, "〔手写〕")));
    assert.deepEqual(actual, f[id].map(norm), id);
  }
});

test("40个实际条目各一次；每个原文/整理片段的文本计数与原HTML均保留", () => {
  assert.equal(Object.values(manifest).flat().length, 40);
  for (const id of ids) {
    const html = read(pathFor(id)), entries = parts(html, "wy-entry");
    assert.equal(entries.length, manifest[id].length);
    const sources = parts(html, "wy-source"), supplements = parts(html, "wy-supplement");
    for (const e of manifest[id]) {
      assert.equal(entries.filter(n => n.attrs.id === e.id).length, 1);
      const entry = byId(html, e.id);
      assert.equal(text(nodes(entry.raw).find(n => n.tag === "h2").inner), e.title);
      for (const [key, sections] of [["source", sources], ["supplement", supplements]]) {
        const scope = sections.map(n => n.inner).join("\n");
        for (let raw of e[key]) {
          if (id === "s24" && raw.includes(HAND)) raw = raw.replace(/<span class="wy-hand">[^<]+<\/span>/, "");
          assert.ok(scope.includes(raw), `${id} 原片段缺失: ${text(raw)}`);
          const tag = raw.match(/^<(\w+)/)[1];
          // 同标签/完整文本计数，避免把短词在更大段落里的出现误判为重复。
          assert.equal(nodes(scope).filter(n => n.tag === tag && text(n.raw) === text(raw)).length, 1, `${id} ${key}: ${text(raw)}`);
        }
      }
    }
    const expectedRows = manifest[id].flatMap(e => e.source.flatMap(raw => parts(raw, "wy-source-row")));
    const actualRows = sources.flatMap(n => parts(n.inner, "wy-source-row"));
    assert.equal(actualRows.length, expectedRows.length);
    for (const row of expectedRows) {
      let expected = text(row.raw);
      if (id === "s24") expected = expected.replace(HAND, "");
      assert.equal(actualRows.filter(n => text(n.raw) === expected).length, 1, `${id} 原文行计数: ${expected}`);
    }
  }
});

test("16条自测正文编号只出现一次，位置固定；习题仅以原文字链接回条目", () => {
  const expected = { s11: {1:7,2:3,3:4,4:5,5:8,6:10}, s12:{7:5},s13:{8:3},"s-extra":{},s21:{1:1,2:3},s22:{3:1,4:3},s22b:{5:7,8:6},s23:{6:5},s24:{7:1} };
  let count = 0;
  for (const id of ids) {
    const html = read(pathFor(id));
    const allNumbers = parts(html, "rn").map(n => Number(text(n.inner)));
    assert.deepEqual(allNumbers.sort((a,b)=>a-b), Object.keys(expected[id]).map(Number).sort((a,b)=>a-b));
    for (const [num, entry] of Object.entries(expected[id])) {
      const target = byId(html, `${id}-entry-${entry}`);
      assert.equal(parts(target.raw, "rn").filter(n => text(n.inner) === num).length, 1);
      const self = parts(target.raw, "wy-selfcheck")[0];
      const body = nodes(self.raw).find(n => n.tag === "li");
      const spans = nodes(body.inner).filter(n => n.parent === undefined);
      const label = text(spans.at(-1).raw);
      const links = nodes(byId(html, "practice").raw).filter(n => n.tag === "a" && n.attrs.href === `#${id}-entry-${entry}`);
      assert.equal(links.length, 1); assert.equal(text(links[0].inner), label);
      count++;
    }
    if (id === "s-extra") assert.equal(byId(html, "practice"), undefined);
  }
  assert.equal(count, 16);
});

function jpegInfo(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  let pos = 2, width, height, orientation = null;
  while (pos + 4 < bytes.length) {
    if (bytes[pos++] !== 0xff) throw new Error("JPEG 标记错误");
    while (bytes[pos] === 0xff) pos++;
    const marker = bytes[pos++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(pos);
    if ([0xc0,0xc1,0xc2].includes(marker)) { height = bytes.readUInt16BE(pos + 3); width = bytes.readUInt16BE(pos + 5); }
    if (marker === 0xe1 && bytes.toString("ascii", pos+2, pos+8) === "Exif\0\0") {
      const t = pos+8, le = bytes.toString("ascii",t,t+2) === "II";
      const u16 = o => le ? bytes.readUInt16LE(o) : bytes.readUInt16BE(o);
      const u32 = o => le ? bytes.readUInt32LE(o) : bytes.readUInt32BE(o);
      const ifd = t+u32(t+4);
      for(let i=0;i<u16(ifd);i++) {const e=ifd+2+12*i;if(u16(e)===0x112) orientation=u16(e+8);}
    }
    pos += length;
  }
  return { width, height, orientation };
}

test("无标签栏、无旧大标题；原图按条目、路径存在、尺寸与JPEG一致、初始无src", () => {
  const { topics } = json("data/topics.json");
  for (const [i,id] of ids.entries()) {
    const path=pathFor(id), html=read(path), topic=topics.find(t=>t.id===topicIds[i]);
    assert.equal(topic.legacy_url,path); assert.equal(topic.source_ref,path);
    assert.equal(decode(html.match(/<title>([\s\S]*?)<\/title>/)[1]),`${topic.title} · 网页设计 · 辽宁专升本`);
    assert.equal(decode(html.match(/<meta name="description" content="([^"]*)"/)[1]),`网页设计 · ${topic.title}`);
    assert.doesNotMatch(html,/role="tab"|讲义原文|讲义原图/);
    assert.equal(parts(html,"wy-photo").length,1);
    assert.doesNotMatch(html,/<img[^>]+src=["'][^"']*原图\//);
    assert.doesNotMatch(html,/<pre(?![^>]*tabindex="0")[^>]*>/);
    const photoNodes=nodes(html).filter(n=>n.attrs["data-photo"]);
    const expectedPhotos = [...new Set(manifest[id].flatMap(e=>e.photos))].sort((a,b)=>a-b);
    assert.deepEqual(photoNodes.map(n=>Number(n.attrs["data-photo-number"])).sort((a,b)=>a-b),expectedPhotos);
    const photoNames = i < 4
      ? ['01M6NNTT6F0QBEKT0V5WBJHHEM','01M6NNTW88HTX0V24269WR4D6T','01M6NNV0RP1JNNW98MZ1VKE1NW']
      : ['01M6NNXP4W98VHZ3243W11M55Z','01M6NNXVKR97GSZJ4XDP4AVTX0','01M6NNXYHM4CKVKAXYFBAB9367','01M6NNY28N880ZDJ4CV661VSQC','01M6NP1DJPVH3E0P1HHABH7S8E'];
    for(const n of photoNodes) {
      assert.equal(n.attrs['data-photo'], `../原图/${photoNames[Number(n.attrs['data-photo-number'])-1]}.jpg`);
      const p=resolve(root,dirname(path),n.attrs["data-photo"]); assert.ok(existsSync(p));
      const actual=jpegInfo(readFileSync(p));
      assert.equal(Number(n.attrs["data-width"]),actual.width); assert.equal(Number(n.attrs["data-height"]),actual.height);
      assert.ok(actual.width>=1536&&actual.height>=2048);
    }
    for(const e of manifest[id]) {
      const buttons=nodes(byId(html,e.id).raw).filter(n=>n.tag==='button');
      assert.equal(buttons.length,e.photos.length?1:0);
      if(buttons.length) assert.deepEqual(buttons[0].attrs['data-photos'].split(',').map(Number),e.photos);
    }
  }
  for(const page of pages) {
    const html=read(page);
    assert.match(html,/href="\.\.\/\.\.\/assets\/css\/site-shell.css"/);
    assert.match(html,/<script src="\.\.\/\.\.\/assets\/js\/site-shell.js"><\/script>/);
    for(const m of html.matchAll(/<(?:script|link|img|video|track)\b[^>]*\s(?:src|href|poster)="([^"]+)"/g)) {
      assert.doesNotMatch(m[1],/^(https?:|\/)/);
      assert.ok(existsSync(resolve(root,dirname(page),decode(m[1]).split(/[?#]/)[0])),`${page}: ${m[1]}`);
    }
  }
});

test("六课页延伸逐字来自722ce58，元素lead单独并入2.1；无提示框且试一试仍隔离", () => {
  const f=json('tests/fixtures/wy-extension-text.json'); assert.equal(f.baseline,'722ce58'); assert.equal(f.blocks.length,6);
  for(const b of f.blocks) {
    const target=byId(read(pathFor(b.target)),b.id); assert.ok(target);
    assert.equal(text(target.inner),b.text);
    assert.equal(norm(target.inner),norm(b.html));
    assert.doesNotMatch(target.raw,/wy-context-link|class="callout|wy-pager/);
    for(const n of nodes(target.raw).filter(n=>n.tag==='iframe')) assert.equal(n.attrs.sandbox,'allow-scripts');
    const redirect=read(b.path), url=`../ch2/${b.target}.html#${b.id}`;
    assert.ok(redirect.includes(`content="0;url=${url}"`)); assert.ok(redirect.includes(`href="${url}"`));
    assert.ok(redirect.includes(`location.replace(${JSON.stringify(url)})`)); assert.match(redirect,/data-pagefind-ignore/);
  }
  const lead=byId(read(pathFor('s21')),'ext-html-elements-lead');
  assert.ok(lead); assert.match(text(lead.raw),/元素 ≈ 开始标签 \+ 内容 \+ 结束标签/);
  assert.doesNotMatch(read(pathFor('s22b')),/元素 ≈ 开始标签/);
});

test("目录仅4+5点，七个旧id映射齐全，依赖边无悬空/自环且视频归属2.1", () => {
  const d=json('data/topics.json'), all=new Set(d.topics.map(t=>t.id));
  assert.equal(d.topics.filter(t=>t.chapter_id==='web.ch1').length,4);
  assert.equal(d.topics.filter(t=>t.chapter_id==='web.ch2').length,5);
  assert.ok(!d.topics.some(t => ['web.quiz_points', 'web.figs'].includes(t.id)));
  assert.doesNotMatch(read('data/dependencies.json'), /web\.(quiz_points|figs)/);
  assert.equal(Object.keys(d.merged_topics).length,7);
  for(const [old,target] of Object.entries(d.merged_topics)) {assert.ok(!all.has(old));assert.ok(all.has(target));}
  assert.deepEqual(d.topics.find(t=>t.id==='web.s21').prereq_ids,['web.concepts']);
  assert.deepEqual(d.topics.find(t=>t.id==='web.html.editors').prereq_ids,['web.html_intro']);
  for(const t of d.topics) for(const p of t.prereq_ids) {assert.ok(all.has(p));assert.notEqual(t.id,p);}
  for(const e of json('data/dependencies.json').edges) {assert.ok(all.has(e.topicId));assert.ok(all.has(e.prerequisiteId));assert.notEqual(e.topicId,e.prerequisiteId);}
  for(const a of json('data/video-anchors.json').anchors) assert.ok(all.has(a.topic_id));
  const resources=json('data/resources.json').resources,r=resources.find(r=>r.id==='res-wy-ch2');
  assert.equal(r.page_url,'wy/ch2/s21.html#video'); assert.equal(r.provenance.source_ref,r.page_url); assert.equal(r.chapter_id,'web.ch2');
  assert.deepEqual(r.topic_ids,['web.s21','web.s22','web.s22b','web.s23','web.s24']);
  assert.deepEqual(chapterVideos(resources,'web.ch2'),[r]); assert.deepEqual(chapterVideos(resources,'math.ch1'),[]);
  for(const id of ['s21','s22','s22b','s23','s24']) {
    const html=read(pathFor(id)); assert.ok(byId(html,'video'));
    assert.equal((html.match(/<video\b/g)||[]).length,id==='s21'?1:0);
    if(id!=='s21') assert.match(html,/href="s21.html#video"/);
  }
  for(const ch of [1,2]) {
    assert.equal(d.chapters.find(c => c.id === `web.ch${ch}`).source_ref, `wy/ch${ch}/index.html`);
    const html=read(`wy/ch${ch}/index.html`); assert.doesNotMatch(html,/<video\b/);
    assert.equal(parts(html,'wy-chapter-row').length,ch===1?4:5);
    assert.ok(html.includes(`${ch===1?4:5} 个知识点`));
    for(const t of d.topics.filter(t=>t.chapter_id===`web.ch${ch}`)) assert.ok(html.includes(`href="${t.legacy_url.split('/').at(-1)}"`));
    if(ch===2) assert.match(html,/href="s21.html#video"/);
  }
  const home=read('wy/index.html');
  for(const id of ids.concat(['ch2','s-quiz','s-figs'])) assert.ok(byId(home,id));
  assert.match(home,/location\.replace\(target\)/); assert.doesNotMatch(home,/class="chapter-links"|<video|<img[^>]*原图/);
});

test("搜索给条目标题生成稳定锚点，忽略照片对话框/工具而保留学习正文", () => {
  for (const id of ids) {
    const original = read(pathFor(id));
    const anchored = addAnchors(original).html;
    for (const entry of manifest[id]) assert.ok(anchored.includes(`id="${entry.id}-h"`));
    const indexed = ignoreUi(anchored).html;
    assert.match(indexed, /<dialog[^>]*data-pagefind-ignore/);
    for (const button of nodes(indexed).filter(n => n.tag === "button" && text(n.inner) === "打开原图")) assert.match(button.raw, /data-pagefind-ignore/);
    for (const source of parts(indexed, "wy-source")) assert.doesNotMatch(source.raw.split(">")[0], /data-pagefind-ignore/);
    assert.equal(text(indexed), text(original));
  }
});

test("旧id作答/错题/笔记/进度读取映射、去重汇总且原对象不变", () => {
  const {merged_topics,topics,chapters}=json('data/topics.json');
  const original={ok:true,attempts:[{id:'a',question_id:'q',topic_ids:['web.html.intro','web.s21','web.html.attributes'],submitted_at:'2026-01-01',grading:{status:'correct'}}],mistakes:[{id:'m',topic_ids:['web.html5_structure'],category:'wrong',next_review_at:'2026-01-01'}],notes:[{topic_ids:['web.html.head']}],progress:[{topic_id:'web.html.intro',updated_at:'2026-01-01',mastery_state:'practicing',independent_correct_count:1,evidence_attempt_ids:['a']},{topic_id:'web.s21',updated_at:'2026-02-01',mastery_state:'independent_once',independent_correct_count:2,evidence_attempt_ids:['b']}]};
  const before=structuredClone(original), mapped=withResolvedTopics(original,merged_topics);
  const allOld = Object.entries(merged_topics).map(([old, target], i) => ({ id: `old-${i}`, question_id: `old-q-${i}`, topic_ids: [old, target], submitted_at: '2026-01-01' }));
  const resolvedOld = withResolvedTopics({ attempts: allOld }, merged_topics);
  assert.deepEqual(resolvedOld.attempts.map(a => a.topic_ids), Object.values(merged_topics).map(id => [id]));
  assert.equal(resolvedOld.attempts.length, 7);
  assert.deepEqual(original,before); assert.deepEqual(mapped.attempts[0].topic_ids,['web.s21']);
  assert.deepEqual(mapped.mistakes[0].topic_ids,['web.s21']); assert.deepEqual(mapped.notes[0].topic_ids,['web.s23']);
  assert.equal(mapped.progress.length,1); assert.equal(mapped.progress[0].mastery_state,'independent_once');
  assert.equal(mapped.progress[0].independent_correct_count,3); assert.deepEqual(mapped.progress[0].evidence_attempt_ids,['a','b']);
  assert.deepEqual(mapLearningTopics(mapped,merged_topics),mapped);
  const model=buildModel({subjects:json('data/subjects.json').subjects,topics,chapters,edges:[],registry:{subjects:[]},merged_topics},original,Date.parse('2026-03-01'));
  assert.equal(model.topicStats('web.s21').attempts,1); assert.equal(model.topicStats('web.s21').reviews,1);
  assert.equal(model.topicStats('web.s21').mastery,'independent_once'); assert.equal(model.topicStats('web.html.intro').attempts,0);
  assert.deepEqual(original,before);
});

test("三张替换JPEG尺寸、方向和SHA256不变", () => {
  const photos=[['01M6NNXVKR97GSZJ4XDP4AVTX0',4096,3072,'370e0b2c46f667232f9c1e7c27b6082c333add9218f609e021899672dc39606e'],['01M6NNY28N880ZDJ4CV661VSQC',4096,3072,'dd13d8c147af2dbb317cd918a918bc238ec6f92975879c84db9516be828b9667'],['01M6NP1DJPVH3E0P1HHABH7S8E',3072,4096,'5f73d01a85d4f9beea9ba1d1271dc04e03db4307e1b3348c720d460760cf49bc']];
  for(const [id,w,h,sha] of photos) {
    const bytes=readFileSync(resolve(root,`wy/原图/${id}.jpg`)),info=jpegInfo(bytes);
    assert.equal(info.width,w);assert.equal(info.height,h);assert.ok(info.orientation===null||info.orientation===1);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
  }
});

test("仅wy章节左栏同时列两章，其他讲义推断/目录行为不变", () => {
  const {topics,chapters}=json('data/topics.json'), model={topLevel:id=>chapters.find(c=>c.id===id)},all=topics.filter(t=>t.subject_id==='web_design');
  assert.deepEqual(lectureChapterIds(model,[],all,'web.ch1'),['web.ch1']);
  assert.deepEqual(lectureChapterIds(model,[],all,'web.ch2'),['web.ch2']);
  assert.deepEqual(lectureChapterIds(model,[],all,'missing'),['web.ch1']);
  assert.deepEqual(lectureChapterIds(model,all.filter(t=>t.id==='web.s24'),all),['web.ch2']);
  assert.deepEqual(tocChapterIds(['web.ch1'],true),['web.ch1','web.ch2']);
  assert.deepEqual(tocChapterIds(['math.ch1']),['math.ch1']);
  for(const ch of [1,2]) assert.equal(directoryTopics(all.filter(t=>t.chapter_id===`web.ch${ch}`),true).length,ch===1?4:5);
  assert.equal(directoryTopics(all),all);
  assert.ok(read('assets/js/site-shell.js').includes('^wy\\/ch[12]\\/[^/]+\\.html$'));
  for(const legacy of ['gs/gs1.html','gs/gs45.html','yy/yy5.html','jsj/jsj1.html','jsj/ppt5.html']) assert.ok(read('assets/js/shell/lecture.js').includes(`"${legacy}"`));
});

test("章节页上一节为上一章末点，下一节为本章第一个点", () => {
  const {topics}=json('data/topics.json');
  const model={topLevel:id=>(/^web\.ch[12]$/.test(id)?{id}:null)};
  const order=directoryTopics(topics.filter(t=>/^web\.ch[12]$/.test(t.chapter_id)),true);
  assert.deepEqual(chapterPageNeighbors(model,order,'web.ch1'),{prev:null,next:order[0]});
  const n=chapterPageNeighbors(model,order,'web.ch2'); assert.equal(n.prev.id,'web.tools'); assert.equal(n.next.id,'web.s21');
});
