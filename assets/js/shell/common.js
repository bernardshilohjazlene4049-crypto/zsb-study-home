// 页面上静态写好的 data-icon 占位，统一换成图标。
import { icon } from "./ui.js";
export function hydrateIcons(root = document) {
  for (const node of root.querySelectorAll("[data-icon]:empty")) {
    const ico = icon(node.getAttribute("data-icon"), Number(node.getAttribute("data-size")) || 18);
    node.replaceChildren(...ico.childNodes);
  }
}
