// Original geometric control marks, drawn in a shared 24-unit coordinate space.
const marks = {
  "Copy code":
    '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H4v12"/>',
  "Expand sidebar": '<path d="M5 6h14M5 12h14M5 18h14"/>',
  "Turn left": '<path d="M8 7H3v5M3 7c8-7 18 1 16 8M3 7l6 8"/>',
  "Turn right": '<path d="M16 7h5v5M21 7C13 0 3 8 5 15M21 7l-6 8"/>',
  "Zoom out": '<path d="M4 12h16"/>',
  "Zoom in": '<path d="M4 12h16M12 4v16"/>',
  "Reset view":
    '<rect x="6" y="6" width="12" height="12" rx="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  "Expand panel": '<path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/>',
  "Earlier lessons": '<path d="m15 4-8 8 8 8"/>',
  "More lessons": '<path d="m9 4 8 8-8 8"/>',
};
export const icon = (label) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${marks[label] || marks["Reset view"]}</svg>`;
