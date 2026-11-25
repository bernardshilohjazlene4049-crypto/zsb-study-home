// 14 Three.js 立体场景引擎：
// (1) 首页 Hero 右侧红·蓝·冰晶六科多面体空间（视口外自动休眠、无 WebGL 静默降级）
// (2) 学习指挥塔（tower/index.html）七层立体液态水晶空间视图，与楼层切换双向联动
import { Ola, Tween, TweenGroup, Easing } from "../vendor/tween-suite.min.js";

const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export async function mountHeroCrystal3D() {
  if (REDUCED) return;
  const hero = document.querySelector(".home-hero");
  if (!hero || hero.querySelector(".lg-hero-3d")) return;

  let THREE;
  try {
    THREE = await import("../vendor/three.min.js");
  } catch {
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "lg-hero-3d";
  wrap.setAttribute("aria-hidden", "true");
  hero.appendChild(wrap);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  } catch {
    wrap.remove();
    return;
  }

  const size = 210;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(size, size);
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 5.2);

  scene.add(new THREE.AmbientLight(0xdbeafe, 1.4));
  const blueLight = new THREE.PointLight(0x3b82f6, 6.5, 14);
  blueLight.position.set(3, 2.5, 4);
  const redLight = new THREE.PointLight(0xef4444, 4.8, 14);
  redLight.position.set(-3, -2.2, 3.5);
  scene.add(blueLight, redLight);

  const rootGrp = new THREE.Group();
  scene.add(rootGrp);

  const coreGeo = new THREE.IcosahedronGeometry(1.08, 0);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0x2563eb,
    emissive: 0x0f172a,
    roughness: 0.15,
    metalness: 0.12,
    transmission: 0.55,
    transparent: true,
    opacity: 0.86
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(coreGeo),
    new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.85 })
  );
  rootGrp.add(coreMesh, wire);

  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(1.58, 0.028, 12, 64),
    new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.72 })
  );
  ring1.rotation.x = 1.12;
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.76, 0.024, 12, 64),
    new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.65 })
  );
  ring2.rotation.y = 0.95;
  ring2.rotation.x = -0.55;
  rootGrp.add(ring1, ring2);

  // 六颗卫星节点代表六门专升本核心科目
  const satPositions = [
    [1.62, 0.2, 0], [-1.62, -0.2, 0], [0, 1.62, 0.3],
    [0, -1.62, -0.3], [0.95, 0.95, 1.05], [-0.95, -0.95, -1.05]
  ];
  satPositions.forEach(([x, y, z], i) => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x93c5fd : 0xfca5a5 })
    );
    dot.position.set(x, y, z);
    rootGrp.add(dot);
  });

  const tilt = Ola({ rx: 0, ry: 0 }, 220);
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    if (!r.width) return;
    tilt.set({
      ry: ((e.clientX - r.left) / r.width - 0.5) * 0.7,
      rx: ((e.clientY - r.top) / r.height - 0.5) * 0.5
    });
  }, { passive: true });

  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
  });
  io.observe(hero);

  const render = (t) => {
    if (visible) {
      const s = t * 0.0007;
      coreMesh.rotation.y = wire.rotation.y = s + tilt.ry;
      coreMesh.rotation.x = wire.rotation.x = s * 0.6 + tilt.rx;
      ring1.rotation.z = s * 1.1;
      ring2.rotation.z = -s * 0.85;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}

// 指挥塔 7 层立体液态水晶模型（与 07F..01F 双向同步）
export async function mountTower3D({ glassHost, floors, getSelected, onSelect }) {
  if (!glassHost) return null;
  let THREE;
  try {
    THREE = await import("../vendor/three.min.js");
  } catch {
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  } catch {
    return null;
  }

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "tw-3d-wrap";
  canvasWrap.setAttribute("aria-hidden", "true");
  glassHost.prepend(canvasWrap);

  const stageEl = glassHost.closest(".tw-stage");
  if (stageEl && !stageEl.querySelector(".tw-3d-badge")) {
    const badge = document.createElement("span");
    badge.className = "tw-3d-badge";
    badge.textContent = "🧊 Three.js 立体水晶空间 · 点击或上下方向键切换楼层";
    const h2 = stageEl.querySelector("h2");
    if (h2) h2.after(badge);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 440 / 480, 0.1, 60);
  camera.position.set(0, 1.3, 10.6);
  camera.lookAt(0, 0.1, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.65));
  const dir = new THREE.DirectionalLight(0x93c5fd, 1.8);
  dir.position.set(4, 7, 6);
  const redPt = new THREE.PointLight(0xdc2626, 2.2, 16);
  redPt.position.set(-4, -2, 5);
  scene.add(dir, redPt);

  const towerGroup = new THREE.Group();
  scene.add(towerGroup);

  const slabs = new Map();
  const tweenGroup = new TweenGroup();
  const total = floors.length; // 7 (07F at index 0 -> top, 01F at index 6 -> bottom)

  floors.forEach((f, idx) => {
    const yBase = (3 - idx) * 0.74;
    const widthScale = 1.95 + idx * 0.09;
    const geo = new THREE.BoxGeometry(widthScale, 0.36, widthScale * 0.78);
    const mat = new THREE.MeshPhysicalMaterial({
      color: f.open ? 0xdbeafe : 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.08,
      transmission: 0.45,
      transparent: true,
      opacity: f.open ? 0.78 : 0.46
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, yBase, 0);
    mesh.rotation.y = Math.PI / 4;
    mesh.userData.floorNo = f.no;
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.55 })
    );
    mesh.add(edge);
    towerGroup.add(mesh);
    slabs.set(f.no, { mesh, mat, edge, yBase, floor: f });
  });

  function syncSize() {
    const w = Math.max(240, glassHost.clientWidth || 400);
    const h = Math.max(240, glassHost.clientHeight || 460);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  syncSize();
  canvasWrap.appendChild(renderer.domElement);
  glassHost.classList.add("has-3d");

  const highlightFloor = (no) => {
    for (const [fno, item] of slabs.entries()) {
      const active = fno === no;
      item.mat.color.setHex(active ? 0x1d4ed8 : (item.floor.open ? 0xdbeafe : 0xe2e8f0));
      item.mat.opacity = active ? 0.92 : (item.floor.open ? 0.62 : 0.38);
      item.edge.material.color.setHex(active ? 0xdc2626 : 0x2563eb);
      if (!REDUCED) {
        const state = { z: item.mesh.position.z, s: item.mesh.scale.x };
        new Tween(state, tweenGroup)
          .to({ z: active ? 0.42 : 0, s: active ? 1.06 : 1 }, 260)
          .easing(Easing.Cubic.Out)
          .onUpdate(() => {
            item.mesh.position.z = state.z;
            item.mesh.scale.set(state.s, active ? 1.12 : 1, state.s);
          })
          .start();
      }
    }
    renderer.render(scene, camera);
  };

  highlightFloor(getSelected());

  // 支持点击 3D 楼板切换楼层
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener("click", (ev) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...slabs.values()].map((s) => s.mesh), false);
    if (hits[0]?.object?.userData?.floorNo) {
      onSelect(hits[0].object.userData.floorNo);
    }
  });

  const ro = new ResizeObserver(() => {
    syncSize();
    renderer.render(scene, camera);
  });
  ro.observe(glassHost);

  if (!REDUCED) {
    const loop = (t) => {
      tweenGroup.update(t);
      towerGroup.rotation.y = Math.sin(t * 0.0006) * 0.14;
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else {
    renderer.render(scene, camera);
  }

  void total;
  return { highlightFloor };
}
