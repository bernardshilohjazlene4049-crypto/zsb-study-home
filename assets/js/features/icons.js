const PATHS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7H10v7H4a1 1 0 0 1-1-1z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  pencil: '<path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="m14 7 3 3"/>',
  notebook: '<path d="M5 3h14v18H5z"/><path d="M8 3v18M11 8h5M11 12h5M11 16h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 1.3 1.1-1.5 2.6-1.5-.6a8 8 0 0 1-1.5.9l-.3 1.6h-3l-.3-1.6a8 8 0 0 1-1.5-.9l-1.5.6-1.5-2.6 1.2-1a7 7 0 0 1 0-1.8l-1.2-1 1.5-2.6 1.5.6a8 8 0 0 1 1.5-.9l.3-1.6h3l.3 1.6a8 8 0 0 1 1.5.9l1.5-.6 1.5 2.6-1.2 1a7 7 0 0 1 0 1.7z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M22 12h-3"/>',
  rotate: '<path d="M20 7v5h-5M4 17v-5h5M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  back: '<path d="m15 18-6-6 6-6M9 12h11"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  tower: '<path d="M4 20h16M6 20V8l6-4 6 4v12M9 20v-5h6v5M8 9h.01M16 9h.01"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10H2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  exam: '<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3"/>',
  lab: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  plan: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18M8 13h3M8 17h7"/>'
};

export function icon(name, size = 17) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.65");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = PATHS[name] || PATHS.book;
  return svg;
}

export function brandMark() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = '<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="m4 8.5 8 4.5 8-4.5M12 13v7"/>';
  return svg;
}
