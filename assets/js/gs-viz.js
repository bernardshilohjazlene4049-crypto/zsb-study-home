/* 高数第一章可视化讲解：画布、控件和读数。每个 [data-gs-viz] 容器挂一个组件，无外部依赖。 */
(() => {
  'use strict';
  const mount = page => {
  const demo = page.querySelector('.gs-demo');
  if (!demo || demo.dataset.ready) return;
  demo.dataset.ready = '1';
  const teal = '#006659';
  const rust = '#a24419';
  const ink = '#172d35';
  const fmt = (x, digits = 5) => String(Number(x.toFixed(digits))).replace('-', '−');
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

  function add(tag, className, content = '', parent = demo) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = content;
    parent.append(element);
    return element;
  }

  function choices(label, labels, changed) {
    const group = add('div', 'gs-controls');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    const buttons = labels.map((name, i) => {
      const button = add('button', '', name, group);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(i === 0));
      button.addEventListener('click', () => {
        buttons.forEach((item, j) => item.setAttribute('aria-pressed', String(j === i)));
        changed(i);
      });
      return button;
    });
  }

  function range(label, min, max, step, value, changed) {
    const group = add('label', 'gs-range', label);
    const input = add('input', '', '', group);
    Object.assign(input, { type: 'range', min, max, step, value });
    input.addEventListener('input', () => changed(Number(input.value)));
    return input;
  }

  function canvas(label) {
    const element = add('canvas', 'gs-plot', label);
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', label);
    return element;
  }

  function resize(element, draw) {
    new ResizeObserver(draw).observe(element);
    draw();
  }

  function surface(element) {
    const width = element.clientWidth;
    const height = element.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const ctx = element.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.font = '13px system-ui, sans-serif';
    return { ctx, width, height };
  }

  function plot(element, [xmin, xmax, ymin, ymax], options = {}) {
    const { ctx, width, height } = surface(element);
    const left = 43, right = width - 16, top = 17, bottom = height - 28;
    const X = x => left + (x - xmin) * (right - left) / (xmax - xmin);
    const Y = y => bottom - (y - ymin) * (bottom - top) / (ymax - ymin);
    const fromPixel = px => xmin + (px - left) * (xmax - xmin) / (right - left);
    function line(x1, y1, x2, y2, color, dash = []) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(X(x1), Y(y1));
      ctx.lineTo(X(x2), Y(y2));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    function label(value, x, y, color = ink, dx = 0, dy = 0) {
      ctx.fillStyle = color;
      ctx.fillText(value, X(x) + dx, Y(y) + dy);
    }
    const xTicks = options.xTicks || [xmin, (xmin + xmax) / 2, xmax];
    const yTicks = options.yTicks || [ymin, (ymin + ymax) / 2, ymax];
    yTicks.forEach(y => {
      line(xmin, y, xmax, y, '#dfe9e6');
      ctx.textAlign = 'right';
      label(fmt(y, 3), xmin, y, ink, -5, 4);
    });
    xTicks.forEach(x => {
      line(x, ymin, x, ymax, '#dfe9e6');
      ctx.textAlign = 'center';
      label(fmt(x, 3), x, ymin, ink, 0, 18);
    });
    ctx.textAlign = 'left';
    const axisX = clamp(0, xmin, xmax);
    const axisY = clamp(0, ymin, ymax);
    line(axisX, ymin, axisX, ymax, '#71858b');
    line(xmin, axisY, xmax, axisY, '#71858b');
    ctx.textAlign = 'right';
    label(options.xLabel || 'x', xmax, axisY, ink, -3, -5);
    ctx.textAlign = 'left';
    label('y', axisX, ymax, ink, 4, -5);

    function curve(fn, start = xmin, end = xmax, color = teal) {
      if (end <= start) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.clip();
      ctx.beginPath();
      for (let i = 0; i <= 800; i++) {
        const x = start + (end - start) * i / 800;
        const y = clamp(fn(x), ymin - 4 * (ymax - ymin), ymax + 4 * (ymax - ymin));
        if (i === 0) ctx.moveTo(X(x), Y(y));
        else ctx.lineTo(X(x), Y(y));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    function point(x, y, color = teal, open = false, name = '', dx = 8, dy = -9) {
      if (x < xmin || x > xmax || y < ymin || y > ymax) return;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), 5.5, 0, Math.PI * 2);
      ctx.fillStyle = open ? '#fff' : color;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (name) label(name, x, y, color, dx, dy);
    }
    return { curve, point, line, label, fromPixel };
  }

  function drag(element, begin, move) {
    element.classList.add('gs-draggable');
    const pixel = event => event.clientX - element.getBoundingClientRect().left;
    let handle;
    element.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      handle = begin(pixel(event));
      element.setPointerCapture(event.pointerId);
      move(pixel(event), handle);
    });
    element.addEventListener('pointermove', event => {
      if (event.isPrimary && element.hasPointerCapture(event.pointerId)) move(pixel(event), handle);
    });
  }

  function table(headers) {
    const element = add('table', 'gs-table');
    const head = element.createTHead().insertRow();
    headers.forEach(title => { add('th', '', title, head).scope = 'col'; });
    const body = element.createTBody();
    return rows => {
      body.replaceChildren();
      rows.forEach(values => {
        const row = body.insertRow();
        values.forEach(value => { row.insertCell().textContent = value; });
      });
    };
  }

  function oddEven() {
    const examples = [
      ['x³', x => x ** 3, '奇', 1.65, 5],
      ['sin x', Math.sin, '奇', 4, 1.5],
      ['arctan x', Math.atan, '奇', 4, 1.8],
      ['x²', x => x ** 2, '偶', 2, 4.6],
      ['cos x', Math.cos, '偶', 4, 1.5],
      ['|x|', Math.abs, '偶', 3, 3.5],
      ['常数 1', () => 1, '偶', 4, 1.6],
      ['eˣ', Math.exp, '非奇非偶', 2, 8]
    ];
    let selected = 0, proportion = 0.55, graph;
    choices('函数', examples.map(item => item[0]), index => { selected = index; draw(); });
    const figure = canvas('函数图像与对称点');
    const slider = range('移动点 P', -100, 100, 1, 55, value => { proportion = value / 100; draw(); });
    const status = add('p', 'gs-status');
    function draw() {
      const [name, fn, type, extent, height] = examples[selected];
      const x = proportion * extent;
      const y = fn(x);
      const mateY = fn(-x);
      graph = plot(figure, [-extent, extent, -height, height]);
      graph.curve(fn);
      if (type !== '非奇非偶') {
        if (type === '偶') graph.line(0, -height, 0, height, rust, [5, 4]);
        graph.line(x, y, -x, mateY, rust, [4, 4]);
        if (x !== 0) graph.point(-x, mateY, rust, false, 'P′', x < 0 ? -22 : 8);
      }
      graph.point(x, y, teal, false, x === 0 && type !== '非奇非偶' ? 'P = P′' : 'P', x > 0 ? -17 : 8);
      const explanation = type === '非奇非偶'
        ? '非奇非偶，不关于 y 轴或原点对称。'
        : `${type}函数，关于${type === '奇' ? '原点' : ' y 轴'}对称。P′(${fmt(-x)}, ${fmt(mateY)})`;
      status.textContent = `${name} · P(${fmt(x)}, ${fmt(y)})。 ${explanation}`;
      slider.setAttribute('aria-valuetext', `x = ${fmt(x)}`);
    }
    drag(figure, () => null, pixel => {
      slider.value = Math.round(100 * graph.fromPixel(pixel) / examples[selected][3]);
      proportion = Number(slider.value) / 100;
      draw();
    });
    resize(figure, draw);
  }

  function infinity() {
    const examples = [
      ['arctan x', Math.atan, [-12, 12, -2, 2], 'arctan(+∞) = π/2，arctan(−∞) = −π/2。'],
      ['eˣ', Math.exp, [-8, 4, -0.6, 56], '左侧沿 x 轴伸展，右侧向上。'],
      ['ln x', Math.log, [0, 18, -5, 3.5], '靠近 y 轴向下，向右上方。'],
      ['1/x', x => 1 / x, [-10, 10, -8, 8], '讲义图中两支沿 x 轴伸展。']
    ];
    let selected = 0, side = 1;
    choices('函数', examples.map(item => item[0]), index => {
      selected = index;
      slider.value = 55;
      side = 1;
      draw();
    });
    const figure = canvas('函数图像与趋向');
    const slider = range('移动观察点', 0, 100, 1, 55, draw);
    const status = add('p', 'gs-status');
    const note = add('p', 'gs-caption');
    function draw() {
      const [name, fn, domain, caption] = examples[selected];
      const [xmin, xmax, ymin, ymax] = domain;
      const t = Number(slider.value) / 100;
      let x = xmin + (xmax - xmin) * t;
      const graph = plot(figure, domain, selected === 1 ? { yTicks: [0, 25, 50] } : {});
      if (selected === 0) {
        [Math.PI / 2, -Math.PI / 2].forEach((y, i) => {
          graph.line(xmin, y, xmax, y, rust, [5, 4]);
          graph.label(i ? '−π/2' : 'π/2', xmax, y, rust, -36, i ? 15 : -4);
        });
      }
      if (selected === 1) graph.line(xmin, 0, xmax, 0, rust, [5, 4]);
      if (selected === 2 || selected === 3) graph.line(0, ymin, 0, ymax, rust, [5, 4]);
      if (selected === 3) {
        graph.curve(fn, xmin, -0.015);
        graph.curve(fn, 0.015, xmax);
        if (x !== 0) side = Math.sign(x);
        if (Math.abs(x) < 0.125) x = side * 0.125;
      } else {
        graph.curve(fn, selected === 2 ? 0.001 : xmin, xmax);
        if (selected === 2 && x === 0) x = 0.01;
      }
      graph.point(x, fn(x), rust);
      status.textContent = `${name} · x = ${fmt(x)}，y = ${fmt(fn(x))}`;
      slider.setAttribute('aria-valuetext', `x = ${fmt(x)}`);
      note.textContent = caption;
    }
    resize(figure, draw);
  }

  function infinitesimal() {
    const groups = [
      {
        labels: ['ln(1+x)', 'x', 'eˣ−1'],
        functions: [Math.log1p, x => x, Math.expm1],
        step: '½x²',
        differences: ['x − ln(1 + x) ∼ ½x²', 'eˣ − 1 − x ∼ ½x²', 'eˣ − 1 − ln(1 + x) ∼ x²']
      },
      {
        labels: ['arctan x', 'sin x', 'x', 'arcsin x', 'tan x'],
        functions: [Math.atan, Math.sin, x => x, Math.asin, Math.tan],
        step: '⅙x³',
        differences: ['x − sin x ∼ ⅙x³', 'arcsin x − x ∼ ⅙x³', 'tan x − x ∼ ⅓x³']
      }
    ];
    const slider = range('取靠近 0 的正数 x', 0.001, 0.08, 0.001, 0.025, update);
    const status = add('p', 'gs-status');
    const views = groups.map((group, i) => {
      add('h5', 'gs-sub', i ? '第二条数轴' : '第一条数轴');
      add('p', 'gs-caption', `讲义标注　x → 0 时，一格相差 ${group.step}。`);
      const figure = canvas(`从小到大：${group.labels.join('、')}`);
      figure.classList.add('gs-numberline');
      resize(figure, () => {
        const { ctx, width } = surface(figure);
        ctx.strokeStyle = teal;
        ctx.fillStyle = teal;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(8, 29);
        ctx.lineTo(width - 8, 29);
        ctx.lineTo(width - 15, 24);
        ctx.moveTo(width - 8, 29);
        ctx.lineTo(width - 15, 34);
        ctx.stroke();
        ctx.fillText('小', 8, 19);
        ctx.fillText('大', width - 22, 19);
        ctx.textAlign = 'center';
        group.labels.forEach((name, index) => {
          const x = 30 + (width - 60) * index / (group.labels.length - 1);
          ctx.beginPath();
          ctx.arc(x, 29, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(name, x, 53);
        });
      });
      const render = table(['讲义排序', '当前数值']);
      return { group, render };
    });
    function update() {
      const x = Number(slider.value);
      status.textContent = `x = ${fmt(x)} · 数值演示，按讲义顺序排列。`;
      views.forEach(({ group, render }) => {
        render(group.labels.map((name, i) => [name, group.functions[i](x).toFixed(12)]));
      });
    }
    update();
  }

  function important() {
    const examples = [
      ['sin x / x', x => Math.sin(x) / x, 1, false, [0.83, 1.018]],
      ['(1 + 1/x)ˣ', x => Math.exp(x * Math.log1p(1 / x)), Math.E, true, [1.85, 2.8]],
      ['(1 + x)¹⁄ˣ', x => Math.exp(Math.log1p(x) / x), Math.E, false, [2.35, 3.25]]
    ];
    let selected = 0;
    choices('极限形式', examples.map(item => item[0]), index => { selected = index; draw(); });
    const figure = canvas('逼近过程中函数值的变化');
    const slider = range('逼近程度', 0, 4, 0.05, 1, draw);
    const status = add('p', 'gs-status');
    const render = table(['逼近程度', 'x', '函数值']);
    function draw() {
      const [name, fn, target, infinityMode, [low, high]] = examples[selected];
      const t = Number(slider.value);
      const initial = selected === 2 ? 0.25 : 1;
      const toX = step => infinityMode ? 10 ** step : initial * 10 ** (-step);
      const signs = infinityMode ? [1] : [-1, 1];
      const graph = plot(figure, [0, 4, low, high], { xLabel: '程度' });
      graph.line(0, target, 4, target, rust, [4, 4]);
      graph.label(infinityMode || selected === 2 ? 'e' : '1', 4, target, rust, -14, -9);
      signs.forEach((sign, i) => {
        const color = i ? teal : rust;
        graph.curve(step => fn(sign * toX(step)), 0, 4, color);
        graph.point(t, fn(sign * toX(t)), color);
      });
      status.textContent = `${name} · ${infinityMode ? 'x 逐步增大' : 'x 从两侧靠近 0（棕色 x < 0，绿色 x > 0）'}。当前程度 ${fmt(t)}。`;
      const steps = [...new Set([0, 1, 2, 3, 4, t])].sort((a, b) => a - b);
      render(steps.flatMap(step => signs.map(sign => {
        const x = sign * toX(step);
        return [step === t ? `${fmt(step)}（当前）` : fmt(step), fmt(x, 7), fn(x).toFixed(10)];
      })));
    }
    resize(figure, draw);
  }

  function discontinuities() {
    const examples = [
      {
        kind: '第一类 · 可去', formula: 'x ≠ 0 时 f(x) = x + 1；f(0) = −1。',
        fn: x => x + 1, limits: ['1', '1'], value: '−1（有定义）',
        marks: [[1, true, '左右 → 1'], [-1, false, 'f(0)']]
      },
      {
        kind: '第一类 · 跳跃', formula: 'x < 0 时 f(x) = −1；x ≥ 0 时 f(x) = 1。',
        fn: x => x < 0 ? -1 : 1, limits: ['−1', '1'], value: '1（有定义）',
        marks: [[-1, true, '左 → −1', -65], [1, false, '右 → 1，f(0)']]
      },
      {
        kind: '第二类 · 无穷', formula: 'x ≠ 0 时 f(x) = 1/x²。',
        fn: x => 1 / x ** 2, limits: ['+∞', '+∞'], value: '无定义', marks: []
      },
      {
        kind: '第二类 · 振荡', formula: 'x ≠ 0 时 f(x) = sin(1/x)。用来体现讲义手写例 sin∞ ∈ [−1,1]。',
        fn: x => Math.sin(1 / x), limits: ['不存在（振荡）', '不存在（振荡）'], value: '无定义', marks: []
      }
    ];
    let selected = 0;
    choices('间断点类型', ['可去', '跳跃', '无穷', '振荡'], index => { selected = index; draw(); });
    const formula = add('p', '');
    const figure = canvas('x₀ = 0 处的间断点示意图');
    const status = add('p', 'gs-status');
    function draw() {
      const { kind, formula: expr, fn, limits, value, marks } = examples[selected];
      const extent = selected === 3 ? 1 : 2;
      const top = selected === 2 ? 6 : 3.4;
      const graph = plot(figure, [-extent, extent, -2, top], { yTicks: selected === 2 ? [0, 3, 6] : [-1, 0, 1, 3] });
      const cut = selected === 3 ? 0.025 : 0.0001;
      graph.curve(fn, -extent, -cut);
      graph.curve(fn, cut, extent);
      if (selected === 2) {
        graph.label('左 ↑ +∞', 0, top, rust, -69, 15);
        graph.label('右 ↑ +∞', 0, top, rust, 12, 15);
      }
      if (selected === 3) {
        [-1, 1].forEach(y => graph.line(-extent, y, extent, y, rust, [4, 4]));
        graph.label('← 振荡', 0, 1, rust, -58, -8);
        graph.label('振荡 →', 0, 1, rust, 12, -8);
      }
      marks.forEach(([y, open, name, dx]) => graph.point(0, y, open ? rust : teal, open, name, dx));
      formula.textContent = expr;
      status.textContent = `${kind} · x₀ = 0。左极限 ${limits[0]}，右极限 ${limits[1]}。f(0) ${value}。`;
    }
    resize(figure, draw);
  }

  function ivt() {
    const fn = x => (x * x - 1) / 2;
    const endpointValue = x => (Math.round(x * 10) ** 2 - 100) / 200;
    const limit = 3;
    let zeroMode = false, graph, a = -0.6, b = 2.4, c = 0.8;
    choices('定理', ['介值定理', '零点定理'], index => {
      zeroMode = index === 1;
      draw();
    });
    add('p', 'gs-caption', '示意图　f(x) = (x² − 1)/2');
    const figure = canvas('连续曲线、区间端点与介值点');
    const left = range('左端点 a', -limit, limit - 0.1, 0.1, a, value => moveEndpoint('a', value));
    const right = range('右端点 b', -limit + 0.1, limit, 0.1, b, value => moveEndpoint('b', value));
    const target = range('目标值 C', -1, 4.5, 0.05, c, value => { c = value; draw(); });
    const status = add('p', 'gs-status');
    function moveEndpoint(handle, value) {
      const snapped = Math.round(value * 10);
      if (handle === 'a') a = clamp(snapped, -30, Math.round(b * 10) - 1) / 10;
      else b = clamp(snapped, Math.round(a * 10) + 1, 30) / 10;
      left.max = (Math.round(b * 10) - 1) / 10;
      right.min = (Math.round(a * 10) + 1) / 10;
      left.value = a;
      right.value = b;
      draw();
    }
    function draw() {
      target.parentElement.hidden = zeroMode;
      const A = endpointValue(a), B = endpointValue(b);
      const level = zeroMode ? 0 : c;
      const product = A * B;
      const between = A !== B && level > Math.min(A, B) && level < Math.max(A, B);
      const meets = zeroMode ? product < 0 : between;
      graph = plot(figure, [-3.3, 3.3, -1.3, 5.1], { xTicks: [-3, 0, 3], yTicks: [-1, 0, 2, 4] });
      graph.curve(fn, -limit, limit, '#839c97');
      graph.curve(fn, a, b);
      graph.line(-3.3, level, 3.3, level, rust, [4, 4]);
      graph.point(a, A, teal, false, 'a', -15, -9);
      graph.point(b, B, teal, false, 'b', 8, -9);
      const summary = `a = ${fmt(a)}，b = ${fmt(b)}。f(a) = ${fmt(A)}，f(b) = ${fmt(B)}。`;
      const condition = zeroMode ? `f(a)·f(b) = ${fmt(product)}。` : `C = ${fmt(level)}。`;
      let result = '定理条件不满足。';
      if (meets) {
        const root = Math.sqrt(2 * level + 1);
        const xi = root > a && root < b ? root : -root;
        graph.line(xi, -1.3, xi, level, rust, [3, 3]);
        graph.point(xi, level, rust, false, 'ξ', -13, 17);
        result = `定理条件满足。图中 ξ ≈ ${fmt(xi, 6)}，f(ξ) = ${fmt(level)}。`;
      }
      status.textContent = `${summary} ${condition} ${result}`;
    }
    drag(figure, pixel => {
      const x = graph.fromPixel(pixel);
      return Math.abs(x - a) <= Math.abs(x - b) ? 'a' : 'b';
    }, (pixel, handle) => moveEndpoint(handle, graph.fromPixel(pixel)));
    moveEndpoint('a', a);
    resize(figure, draw);
  }

  const components = [oddEven, infinity, infinitesimal, important, discontinuities, ivt];
  components[Number(page.dataset.gsViz) - 1]?.();
  };
  document.querySelectorAll('[data-gs-viz]').forEach(mount);
})();
