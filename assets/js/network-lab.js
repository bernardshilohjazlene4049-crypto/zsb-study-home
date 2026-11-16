const IPV4_PARTS = 4;

export function ipv4ToInt(address) {
  const parts = String(address).trim().split(".");
  if (parts.length !== IPV4_PARTS) throw new Error("请输入完整的 4 段 IPv4 地址。");
  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) throw new Error("IPv4 的每一段只能是 0–255 的十进制整数。");
    const value = Number(part);
    if (value < 0 || value > 255) throw new Error("IPv4 的每一段都在 0–255 之间。");
    return value;
  });
  return (((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0;
}

export function intToIpv4(value) {
  const number = value >>> 0;
  return [number >>> 24, (number >>> 16) & 255, (number >>> 8) & 255, number & 255].join(".");
}

export function calculateCidr(address, prefixValue) {
  const prefix = Number(prefixValue);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("前缀长度必须是 0–32 的整数。");
  }
  const ip = ipv4ToInt(address);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const hostBits = 32 - prefix;
  const addressCount = 2 ** hostBits;
  return {
    address: intToIpv4(ip),
    prefix,
    mask: intToIpv4(mask),
    network: intToIpv4(network),
    broadcast: intToIpv4(broadcast),
    hostBits,
    addressCount,
    conventionalUsable: hostBits >= 2 ? addressCount - 2 : null,
    binary: ip.toString(2).padStart(32, "0")
  };
}

export function planIpv4Fragments(totalValue, headerValue, mtuValue) {
  const total = Number(totalValue);
  const header = Number(headerValue);
  const mtu = Number(mtuValue);
  if (!Number.isInteger(total) || total < 21 || total > 65535) throw new Error("总长度必须是 21–65535 的整数。");
  if (!Number.isInteger(header) || header < 20 || header > 60 || header % 4 !== 0) {
    throw new Error("IPv4 基本首部长度必须是 20–60 字节，并且是 4 的倍数。");
  }
  if (!Number.isInteger(mtu) || mtu < header + 8) throw new Error("MTU 至少要能容纳当前首部和 8 字节数据。");

  const payload = total - header;
  if (payload <= 0) throw new Error("总长度必须大于首部长度。");
  const maxDataLength = Math.floor((mtu - header) / 8) * 8;
  const fragments = [];
  let offsetBytes = 0;
  while (offsetBytes < payload) {
    const remaining = payload - offsetBytes;
    const dataLength = Math.min(maxDataLength, remaining);
    fragments.push({
      number: fragments.length + 1,
      dataLength,
      totalLength: header + dataLength,
      offset: offsetBytes / 8,
      moreFragments: remaining > dataLength
    });
    offsetBytes += dataLength;
  }
  return { total, header, mtu, payload, maxDataLength, fragments };
}

function formatNumber(number) {
  return new Intl.NumberFormat("zh-CN").format(number);
}

function renderCidr(result, host) {
  host.replaceChildren();
  const box = document.createElement("div");
  box.innerHTML = `<strong>${result.address}/${result.prefix}</strong><br>掩码：${result.mask} · 地址块大小：${formatNumber(result.addressCount)}<br>网络地址：${result.network} · 广播地址：${result.broadcast}<br>主机位：${result.hostBits} · 传统可用主机：${result.conventionalUsable === null ? "按 /31、/32 特殊用途判断" : formatNumber(result.conventionalUsable)}`;
  const bits = document.createElement("div");
  bits.className = "calculating-bits";
  bits.setAttribute("aria-label", "输入地址的 32 位结构");
  [...result.binary].forEach((bit, index) => {
    const item = document.createElement("span");
    if (index < result.prefix) item.className = "is-prefix";
    item.textContent = bit;
    bits.append(item);
  });
  host.append(box, bits);
}

function renderFragments(result, host) {
  host.replaceChildren();
  const summary = document.createElement("p");
  summary.innerHTML = `<strong>共 ${result.fragments.length} 片</strong> · 有效数据 ${formatNumber(result.payload)} 字节 · 非末片最多携带 ${formatNumber(result.maxDataLength)} 字节`;
  const rows = document.createElement("div");
  rows.className = "fragment-result";
  for (const fragment of result.fragments) {
    const row = document.createElement("div");
    row.className = "fragment-result__row";
    const label = document.createElement("span");
    label.textContent = `第 ${fragment.number} 片`;
    const bar = document.createElement("span");
    bar.className = "fragment-result__bar";
    bar.style.width = `${Math.max(8, fragment.dataLength / result.maxDataLength * 100)}%`;
    const meta = document.createElement("span");
    meta.textContent = `${result.header}+${fragment.dataLength}，偏移 ${fragment.offset}，MF=${fragment.moreFragments ? 1 : 0}`;
    row.append(label, bar, meta);
    rows.append(row);
  }
  host.append(summary, rows);
}

function bindCalculator(root, formSelector, resultSelector, calculate, render) {
  const form = root.querySelector(formSelector);
  const result = root.querySelector(resultSelector);
  if (!form || !result) return;
  const update = () => {
    try {
      render(calculate(new FormData(form)), result);
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : "输入有误，请检查。";
    }
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    update();
  });
  update();
}

export function mountNetworkLabs(doc = document) {
  const cidr = doc.querySelector("[data-cidr-calculator]");
  if (cidr) {
    bindCalculator(
      cidr,
      "[data-cidr-form]",
      "[data-cidr-result]",
      (data) => calculateCidr(data.get("ip"), data.get("prefix")),
      renderCidr
    );
  }
  const fragment = doc.querySelector("[data-fragment-calculator]");
  if (fragment) {
    bindCalculator(
      fragment,
      "[data-fragment-form]",
      "[data-fragment-result]",
      (data) => planIpv4Fragments(data.get("total"), data.get("header"), data.get("mtu")),
      renderFragments
    );
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountNetworkLabs());
  else mountNetworkLabs();
}
