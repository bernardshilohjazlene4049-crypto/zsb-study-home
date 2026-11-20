const assert = require('node:assert/strict');
const { test } = require('node:test');
const calc = require('../assets/js/calc-net.js');

test('p87、p69 · AND 运算与 IPv4 转换', () => {
  assert.equal(calc.intToIpv4(calc.ipv4ToInt('156.16.32.7')), '156.16.32.7');
  assert.equal(calc.andNetwork('156.16.32.7', '/20'), '156.16.32.0');
  assert.equal(calc.cidrBlock('156.16.32.7', 20).mask, '255.255.240.0');
  assert.equal(calc.andNetwork('141.14.72.24', '255.255.192.0'), '141.14.64.0');
});

test('p94、p84、p88 · CIDR 端点、掩码与地址数', () => {
  const first = calc.cidrBlock('140.120.84.24', 20);
  assert.deepEqual(first, {
    network: '140.120.80.0', broadcast: '140.120.95.255', mask: '255.255.240.0',
    addressCount: 4096, usableCount: 4094
  });
  assert.equal(first.addressCount / 256, 16);
  assert.deepEqual(calc.cidrBlock('156.16.32.0', 20), {
    network: '156.16.32.0', broadcast: '156.16.47.255', mask: '255.255.240.0',
    addressCount: 4096, usableCount: 4094
  });
  assert.deepEqual(calc.cidrBlock('156.47.40.4', 18), {
    network: '156.47.0.0', broadcast: '156.47.63.255', mask: '255.255.192.0',
    addressCount: 16384, usableCount: 16382
  });
});

test('p93 · 86.32/12 匹配', () => {
  const candidates = ['86.33.224.123', '86.79.65.216', '86.58.119.74', '86.68.206.154'];
  assert.deepEqual(candidates.map(ip => calc.andNetwork(ip, 12) === '86.32.0.0'), [true, false, false, false]);
});

test('p90–91 · 两道 /20 汇总题', () => {
  for (const start of ['192.24.0.0', '202.196.0.0']) {
    const route = calc.aggregateConsecutiveC(start, 16);
    assert.equal(route.network, start);
    assert.equal(route.prefix, 20);
    assert.equal(route.mask, '255.255.240.0');
  }
});

test('p98 · 136.23.12.64/26 等分 A–D', () => {
  const subnets = calc.splitSubnets('136.23.12.64', 26, 28);
  assert.deepEqual(subnets.map(({ network, firstHost, lastHost }) => [network, firstHost, lastHost]), [
    ['136.23.12.64', '136.23.12.65', '136.23.12.78'],
    ['136.23.12.80', '136.23.12.81', '136.23.12.94'],
    ['136.23.12.96', '136.23.12.97', '136.23.12.110'],
    ['136.23.12.112', '136.23.12.113', '136.23.12.126']
  ]);
});

test('p76 · 130.53 与 255.255.224.0', () => {
  const subnets = calc.splitSubnets('130.53.0.0', 16, 19, true);
  assert.deepEqual(subnets.map(({ network }) => network), [
    '130.53.32.0', '130.53.64.0', '130.53.96.0', '130.53.128.0', '130.53.160.0', '130.53.192.0'
  ]);
  assert.equal(subnets.length, 6);
  const block = calc.cidrBlock('130.53.32.0', 19);
  assert.equal(block.mask, '255.255.224.0');
  assert.equal(block.usableCount, 8190);
});

test('p77 · 192.168.25.0 划分 6 个子网', () => {
  assert.equal(calc.cidrBlock('192.168.25.0', 27).mask, '255.255.255.224');
  assert.deepEqual(calc.splitSubnets('192.168.25.0', 24, 27, true)
    .map(({ network, firstHost, lastHost }) => [network, firstHost, lastHost].map(ip => ip.split('.').at(-1))), [
    ['32', '33', '62'], ['64', '65', '94'], ['96', '97', '126'],
    ['128', '129', '158'], ['160', '161', '190'], ['192', '193', '222']
  ]);
});

test('p73、p78 · 12 个系与六个部门', () => {
  const block = calc.cidrBlock('187.24.83.29', 20);
  assert.equal(block.network, '187.24.80.0');
  assert.equal(block.broadcast, '187.24.95.255');
  assert.equal(block.mask, '255.255.240.0');
  assert.deepEqual(calc.splitSubnets('198.117.32.0', 24, 27, true).map(({ network }) => network), [
    '198.117.32.32', '198.117.32.64', '198.117.32.96',
    '198.117.32.128', '198.117.32.160', '198.117.32.192'
  ]);
});

test('p48、p47 · 两道分片题', () => {
  assert.deepEqual(calc.fragmentPlan(4000, 20, 1500), [
    { dataLength: 1480, totalLength: 1500, offset: 0, MF: 1 },
    { dataLength: 1480, totalLength: 1500, offset: 185, MF: 1 },
    { dataLength: 1020, totalLength: 1040, offset: 370, MF: 0 }
  ]);
  assert.deepEqual(calc.fragmentPlan(3820, 20, 1420), [
    { dataLength: 1400, totalLength: 1420, offset: 0, MF: 1 },
    { dataLength: 1400, totalLength: 1420, offset: 175, MF: 1 },
    { dataLength: 1000, totalLength: 1020, offset: 350, MF: 0 }
  ]);
});
