const NetCalc = (() => {
  const max = 0xffffffff;

  function ipv4ToInt(ip) {
    const octets = String(ip).trim().split('.');
    if (octets.length !== 4 || octets.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
      throw new RangeError('请输入四段 IPv4 地址，每段为 0–255。');
    }
    return octets.reduce((value, part) => value * 256 + Number(part), 0);
  }

  function intToIpv4(value) {
    if (!Number.isInteger(value) || value < 0 || value > max) throw new RangeError('IPv4 整数超出范围。');
    return [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
  }

  function prefixMask(prefix) {
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new RangeError('前缀须为 0–32 的整数。');
    return prefix === 0 ? 0 : (max << (32 - prefix)) >>> 0;
  }

  function andNetwork(ip, maskOrPrefix) {
    const maskText = String(maskOrPrefix).trim();
    const mask = /^\/?\d+$/.test(maskText)
      ? prefixMask(Number(maskText.replace(/^\//, '')))
      : ipv4ToInt(maskText);
    return intToIpv4((ipv4ToInt(ip) & mask) >>> 0);
  }

  function cidrBlock(ip, prefix) {
    const mask = prefixMask(prefix);
    const addressCount = 2 ** (32 - prefix);
    const network = (ipv4ToInt(ip) & mask) >>> 0;
    return {
      network: intToIpv4(network),
      broadcast: intToIpv4(network + addressCount - 1),
      mask: intToIpv4(mask),
      addressCount,
      usableCount: Math.max(0, addressCount - 2)
    };
  }

  function aggregateConsecutiveC(start, count) {
    const address = ipv4ToInt(start);
    if (!Number.isInteger(count) || count < 1 || count > 256 ||
        !Number.isInteger(Math.log2(count)) || address % (count * 256) !== 0) {
      throw new RangeError('这些连续 /24 块无法按给定起点汇总为单个地址块。');
    }
    const prefix = 24 - Math.log2(count);
    return { ...cidrBlock(start, prefix), prefix };
  }

  function splitSubnets(ip, parentPrefix, childPrefix, omitEdges = false) {
    const parent = cidrBlock(ip, parentPrefix);
    const child = cidrBlock(ip, childPrefix);
    if (childPrefix < parentPrefix || childPrefix - parentPrefix > 16 || child.addressCount < 4) {
      throw new RangeError('子网前缀超出本演示支持的范围。');
    }
    const start = ipv4ToInt(parent.network);
    const count = parent.addressCount / child.addressCount;
    const edge = Number(omitEdges);
    const blocks = [];
    for (let index = edge; index < count - edge; index++) {
      const network = start + index * child.addressCount;
      blocks.push({
        index,
        network: intToIpv4(network),
        firstHost: intToIpv4(network + 1),
        lastHost: intToIpv4(network + child.addressCount - 2)
      });
    }
    return blocks;
  }

  function fragmentPlan(total, header, mtu) {
    if (![total, header, mtu].every(Number.isInteger) ||
        header < 1 || total < header || total > 65535 || mtu < header) {
      throw new RangeError('请检查总长、首部长度与 MTU。');
    }
    const data = total - header;
    if (total <= mtu) return [{ dataLength: data, totalLength: total, offset: 0, MF: 0 }];
    const capacity = Math.floor((mtu - header) / 8) * 8;
    if (!capacity) throw new RangeError('MTU 可容纳的数据太少，无法分片。');
    const fragments = [];
    for (let sent = 0; sent < data; sent += capacity) {
      const dataLength = Math.min(capacity, data - sent);
      fragments.push({ dataLength, totalLength: dataLength + header, offset: sent / 8, MF: Number(sent + dataLength < data) });
    }
    return fragments;
  }

  return { ipv4ToInt, intToIpv4, andNetwork, cidrBlock, aggregateConsecutiveC, splitSubnets, fragmentPlan };
})();

if (typeof window !== 'undefined') window.NetCalc = NetCalc;
if (typeof module !== 'undefined') module.exports = NetCalc;
