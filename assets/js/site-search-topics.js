// 课堂复习目录。复习页与全站搜索使用同一组标题、关键词与章节地址。
import { createSearchMatcher, knowledgeScore } from "./site-search-format.js";

export const reviewTopics = [
  {"subject":"network","order":1,"title":"网络组成、拓扑结构与交换方式","href":"notes/network-review.html#n01-network-topology-switching","aliases":["分组交换","电路交换","网络拓扑"]},
  {"subject":"network","order":2,"title":"网络分层模型、协议与封装","href":"notes/network-review.html#n02-layered-model-encapsulation","aliases":["OSI","TCP/IP","解封装","协议分层","五层模型"]},
  {"subject":"network","order":3,"title":"传输速率、带宽与网络时延","href":"notes/network-review.html#n03-bandwidth-delay","aliases":["发送时延","传播时延","排队时延","传输时延","传输速率","带宽时延积","时延计算"]},
  {"subject":"network","order":4,"title":"码元速率、奈奎斯特定理与香农容量","href":"notes/network-review.html#n04-symbol-capacity-limits","aliases":["波特率","奈氏准则","香农公式","奈奎斯特公式","奈奎斯特准则","香农定理","信道容量"]},
  {"subject":"network","order":5,"title":"数字调制与 PCM 编码","href":"notes/network-review.html#n05-modulation-pcm","aliases":["ASK","FSK","PSK","采样量化"]},
  {"subject":"network","order":6,"title":"线路编码、同步传输与传输介质","href":"notes/network-review.html#n05-line-coding-media","aliases":["曼彻斯特编码","同步传输","双绞线","差分曼彻斯特编码","线路编码"]},
  {"subject":"network","order":7,"title":"频分、时分、统计时分与波分复用","href":"notes/network-review.html#n06-multiplexing","aliases":["FDM","TDM","STDM","WDM","时分复用","频分复用","统计时分复用","波分复用"]},
  {"subject":"network","order":8,"title":"CDMA 正交码片与归一化内积","href":"notes/network-review.html#n06-cdma-chip-decoding","aliases":["码片","正交","内积","CDMA","码分复用","码片计算"]},
  {"subject":"network","order":9,"title":"奇偶校验、CRC 与检错","href":"notes/network-review.html#n07-parity-crc","aliases":["循环冗余校验","模二除法","FCS","CRC","CRC计算","CRC校验","循环冗余检验"]},
  {"subject":"network","order":10,"title":"PPP 帧结构与透明传输","href":"notes/network-review.html#n07-ppp-framing","aliases":["字节转义","零比特填充","PPP","PPP 帧","比特填充"]},
  {"subject":"network","order":11,"title":"以太网帧、CSMA/CD 与最小帧长","href":"notes/network-review.html#n08-ethernet-csma-frame","aliases":["碰撞检测","争用期","64 字节","CSMA/CD","CSMA CD","CSMACD","最小帧长","以太网帧"]},
  {"subject":"network","order":12,"title":"集线器、交换机自学习与 VLAN","href":"notes/network-review.html#n08-switch-learning-vlan","aliases":["MAC 地址表","碰撞域","广播域","VLAN","交换机自学习","交换机转发","局域网"]},
  {"subject":"network","order":13,"title":"IPv4 地址结构、历史分类与特殊地址","href":"notes/network-review.html#n09-ipv4-addressing","aliases":["A/B/C 类","私有地址","环回地址","IPv4地址","IP地址分类","特殊地址"],"equivalentHrefs":["notes/network.html#ip-basics"]},
  {"subject":"network","order":14,"title":"子网掩码、CIDR 与地址块计算","href":"notes/network-review.html#n09-subnet-cidr","aliases":["CIDR 地址块","按位与","广播地址","CIDR","地址块计算","子网掩码"],"equivalentHrefs":["notes/network.html#cidr"]},
  {"subject":"network","order":15,"title":"定长子网划分、VLSM 与点对点网络","href":"notes/network-review.html#n09-vlsm-point-to-point","aliases":["等长子网","变长子网","/31","VLSM","子网划分","IP地址规划"],"equivalentHrefs":["notes/network.html#subnet"]},
  {"subject":"network","order":16,"title":"路由聚合与最长前缀匹配","href":"notes/network-review.html#n09-route-aggregation-match","aliases":["路由汇总","共同前缀","最长前缀匹配","路由聚合"]},
  {"subject":"network","order":17,"title":"IPv4 数据报分片与片偏移","href":"notes/network-review.html#n10-ipv4-fragmentation","aliases":["MTU","DF","MF","分片偏移","IPv4分片","数据报分片","片偏移"],"equivalentHrefs":["notes/network.html#fragments"]},
  {"subject":"network","order":18,"title":"IPv6 地址、基本首部与转发特点","href":"notes/network-review.html#n10-ipv6-header-addresses","aliases":["IPv6 简写","零压缩","40 字节","IPv6","IPv6首部","IPv6地址"],"equivalentHrefs":["notes/network.html#ipv6"]},
  {"subject":"network","order":19,"title":"ARP 与跨局域网逐跳转发","href":"notes/network-review.html#n11-arp-forwarding","aliases":["地址解析","ARP 工作过程","目的 MAC","ARP","ARP 请求","地址解析协议","ARP工作过程"]},
  {"subject":"network","order":20,"title":"路由表、下一跳与默认路由","href":"notes/network-review.html#n11-routing-table","aliases":["路由选择","0.0.0.0/0","转发表","路由表","下一跳","默认路由"]},
  {"subject":"network","order":21,"title":"RIP 距离向量与路由表更新","href":"notes/network-review.html#n11-rip-distance-vector","aliases":["RIP","跳数","距离向量","RIP 路由","RIP 更新","路由表更新","RIP 路由表更新"]},
  {"subject":"network","order":22,"title":"ICMP 差错报告与网络诊断","href":"notes/network-review.html#n11-icmp","aliases":["ping","回显","超时","ICMP","网际控制报文协议","差错报告"]},
  {"subject":"web_design","order":1,"title":"HTML 文档头部与 meta 刷新","href":"notes/web-review.html#html-meta-refresh","aliases":["meta refresh","定时跳转","http-equiv","meta刷新","meta标签","HTML头部","定时刷新"]},
  {"subject":"web_design","order":2,"title":"HTML 有序列表、无序列表与嵌套","href":"notes/web-review.html#html-nested-lists","aliases":["ol","ul","li","reversed","HTML列表","有序列表","无序列表","嵌套列表"]},
  {"subject":"web_design","order":3,"title":"超链接、相对路径与页面锚点","href":"notes/web-review.html#html-links-paths","aliases":["href","跳转","相对路径","HTML链接","页面锚点"]},
  {"subject":"web_design","order":4,"title":"HTML 表格结构、标题与单元格","href":"notes/web-review.html#html-table-structure","aliases":["table","caption","tr","th","td","HTML表格","表格结构","单元格"]},
  {"subject":"web_design","order":5,"title":"表格边框、分隔线与历史属性","href":"notes/web-review.html#html-table-borders","aliases":["border-collapse","rules","frame","表格边框","单元格分隔线"]},
  {"subject":"web_design","order":6,"title":"CSS 规则、三种引入方式与基础颜色","href":"notes/web-review.html#css-syntax-stylesheets","aliases":["内部样式","外部样式","行内样式","CSS引入","CSS语法","CSS三种引入方式"]},
  {"subject":"web_design","order":7,"title":"CSS 否定伪类、根元素与结构伪类","href":"notes/web-review.html#css-pseudo-classes","aliases":[":not",":root",":first-child","CSS伪类","否定伪类","结构伪类"]},
  {"subject":"web_design","order":8,"title":"CSS 文本阴影、空白处理、溢出与链接状态","href":"notes/web-review.html#css-text-formatting","aliases":["text-shadow","white-space","text-overflow",":hover","文本阴影","文本溢出","链接状态"]},
  {"subject":"web_design","order":9,"title":"CSS 文本对齐、容器居中与传统 align 属性","href":"notes/web-review.html#css-alignment-layout","aliases":["text-align","margin auto","align","文字居中","容器居中","文本对齐"]},
  {"subject":"web_design","order":10,"title":"表单结构、提交目标与控件归属","href":"notes/web-review.html#form-structure-ownership","aliases":["HTML 表单","form 属性","表单归属","action","表单结构","表单提交","form owner","控件归属"],"equivalentHrefs":["notes/web.html#forms"]},
  {"subject":"web_design","order":11,"title":"表单字段的 label、id、name 与 value","href":"notes/web-review.html#form-label-name-id","aliases":["标签关联","label for","提交键值","表单字段","label","name 和 value","id 和 name"]},
  {"subject":"web_design","order":12,"title":"下拉菜单、option 与 optgroup 分组","href":"notes/web-review.html#form-select-optgroup","aliases":["select","option","下拉列表","分组下拉菜单","optgroup"]},
  {"subject":"web_design","order":13,"title":"数字输入、范围滑块、datalist 与输入建议","href":"notes/web-review.html#form-input-controls","aliases":["input range","number","datalist","范围滑块","type=range","数字输入"],"equivalentHrefs":["notes/web.html#widgets"]},
  {"subject":"web_design","order":14,"title":"提交按钮、重置按钮与普通交互按钮","href":"notes/web-review.html#form-submit-buttons","aliases":["submit","reset","button type","表单按钮","提交按钮","重置按钮"]},
];

export function findReviewTopics(query, subject = "") {
  const subjectsTopics = reviewTopics.filter((topic) => !subject || topic.subject === subject);
  const matcher = createSearchMatcher(query);
  if (!matcher) return subjectsTopics;
  return subjectsTopics
    .map((topic) => ({ ...topic, score: knowledgeScore(topic.title, topic.aliases, matcher, true) }))
    .filter((topic) => topic.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);
}

const reviewHeadings = new Map(reviewTopics.map(({ href }) => [`${href}-title`, href]));
const reviewHrefs = new Set(reviewHeadings.values());

function searchHrefKey(href, base) {
  const url = new URL(href, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return url.href;
  url.searchParams.sort();
  const path = `${url.pathname.slice(base.pathname.length)}${url.search}${url.hash}`;
  return reviewHeadings.get(path) || path;
}

export function mergeSearchResults(items, base) {
  const related = new Set(items.filter((item) => item.review).flatMap((item) => item.equivalentHrefs || []));
  const prepared = items.map((item) => {
    const key = searchHrefKey(item.href, base);
    const entry = item.type === "topic" && related.has(key)
      ? { ...item, type: "doc", score: 18 }
      : item;
    return { ...entry, href: entry.type === "doc" && reviewHrefs.has(key) ? key : entry.href, key };
  }).sort((a, b) => b.score - a.score);
  const structured = new Set(prepared.filter(({ type }) => type === "topic" || type === "example" || type === "source").map(({ key }) => key));
  const seen = new Set();
  return prepared.filter(({ type, title, key }) => {
    if (type === "doc" && structured.has(key)) return false;
    // 多个历史知识点可能共享一页讲义或视频，保留不同的教学名称。
    const identity = type === "doc" ? `doc:${key}` : `${type}:${key}:${title}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).map(({ key, ...item }) => item);
}
