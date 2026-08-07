/* icons.js — flat outline SVG set, drawn on a 24x24 grid.
   Outline only, stroke: currentColor, no fills — per the GrammarMetric icon rule.
   Add your own by dropping another key in here; questions.json refers to icons by key name. */

window.ICONS = {
  /* --- transport --- */
  bike: '<circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M12 19v-4l-3-3 5-4 2 3h3"/><circle cx="17" cy="5" r="1"/>',
  bus: '<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M3 9.5h18"/><path d="M8.5 4v5.5M15.5 4v5.5"/><circle cx="7.5" cy="18.5" r="1.8"/><circle cx="16.5" cy="18.5" r="1.8"/>',
  car: '<path d="M5.2 13 6.8 8.7A2 2 0 0 1 8.7 7.4h6.6a2 2 0 0 1 1.9 1.3L18.8 13"/><rect x="3" y="13" width="18" height="5" rx="1.8"/><circle cx="7.5" cy="18.2" r="1.6"/><circle cx="16.5" cy="18.2" r="1.6"/>',

  /* --- food --- */
  apple: '<path d="M12 8.2c-1.5-1.6-4-1.7-5.4 0C5 10 5.4 13.6 7 16.1c1 1.6 2.2 2.6 3.3 2.6.6 0 1.1-.3 1.7-.3s1.1.3 1.7.3c1.1 0 2.3-1 3.3-2.6 1.6-2.5 2-6.1.4-7.9-1.4-1.7-3.9-1.6-5.4 0Z"/><path d="M12 8.2V5"/><path d="M12 5c1.6 0 3-1.1 3-2.6-1.9 0-3 1.1-3 2.6Z"/>',
  bread: '<path d="M5 12a3.5 3.5 0 0 1 3.5-3.5h7A3.5 3.5 0 0 1 19 12v6.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8.5 8.5V6.2M12 8.5V5.8M15.5 8.5V6.2"/>',
  cake: '<rect x="3.5" y="12" width="17" height="7.5" rx="2"/><path d="M3.5 15.4c1.5 0 1.5 1.6 3 1.6s1.5-1.6 3-1.6 1.5 1.6 3 1.6 1.5-1.6 3-1.6 1.5 1.6 3 1.6"/><path d="M8 12V9.2M12 12V8.7M16 12V9.2"/><circle cx="8" cy="7.6" r="1"/><circle cx="12" cy="7.1" r="1"/><circle cx="16" cy="7.6" r="1"/>',

  /* --- animals --- */
  cat: '<path d="M5 11.4 4.2 5.4l4.6 2.9"/><path d="M19 11.4l.8-6-4.6 2.9"/><path d="M5 12.6a7 7 0 0 1 14 0v1a7 7 0 0 1-14 0z"/><circle cx="9.4" cy="12.6" r=".9"/><circle cx="14.6" cy="12.6" r=".9"/><path d="M12 15v1"/><path d="m12 16-1.6 1M12 16l1.6 1"/><path d="M3.6 14h2.2M18.2 14h2.2"/>',
  dog: '<path d="M5.5 9.5C4 9.5 3 11 3 13s1 3.5 2.5 3.5"/><path d="M18.5 9.5C20 9.5 21 11 21 13s-1 3.5-2.5 3.5"/><path d="M5.5 12.2a6.5 6.5 0 0 1 13 0v1.6a6.5 6.5 0 0 1-13 0z"/><circle cx="9.5" cy="12.4" r=".9"/><circle cx="14.5" cy="12.4" r=".9"/><path d="M12 15v1"/><path d="M10.2 17.4a2.6 2.6 0 0 0 3.6 0"/>',
  bird: '<path d="M20 9c0 5-4 9-9 9-3.9 0-7-2.4-7-6 0-2.6 1.9-4.7 4.4-4.9C9.6 5.3 11.7 4 14 4c3.3 0 6 2.2 6 5z"/><circle cx="16" cy="8" r=".9"/><path d="M20 9.2h2.4"/><path d="m9 17.6-1 3.2M13 18.1l-.5 2.8"/>',
  fish: '<path d="M16.5 12c0 3-3.4 5.5-7.3 5.5S2 15 2 12s3.3-5.5 7.2-5.5S16.5 9 16.5 12z"/><path d="m16.5 12 5.5-4v8z"/><circle cx="6.2" cy="11" r=".9"/>',

  /* --- places --- */
  house: '<path d="m3 10.2 9-7 9 7"/><path d="M5.2 9v11h13.6V9"/><rect x="10" y="14" width="4" height="6"/>',
  school: '<path d="m12 3.4 8 4.8H4z"/><path d="M5.2 8.2v11.3h13.6V8.2"/><rect x="10" y="13.5" width="4" height="6"/><path d="M12 3.4V1.6h3v2h-3"/><path d="M3 19.5h18"/>',
  shop: '<path d="M3 9h18l-1.2-4.2a1.5 1.5 0 0 0-1.4-1.1H5.6a1.5 1.5 0 0 0-1.4 1.1z"/><path d="M9 3.7 8.4 9M15 3.7l.6 5.3"/><path d="M5 9v10.5h14V9"/><rect x="9.5" y="13.5" width="5" height="6"/>',
  tree: '<path d="M12 3.2 5.5 13h13z"/><path d="M12 8.4 7 16.4h10z"/><path d="M12 16.4v4.4"/><path d="M9.4 20.8h5.2"/>',

  /* --- weather --- */
  sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>',
  cloud: '<path d="M7.5 17h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6-1.4A3.8 3.8 0 0 0 7.5 17z"/>',
  moon: '<path d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6a8.7 8.7 0 1 0 10.6 10.6z"/>',
  rain: '<path d="M7.5 14h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6-1.4A3.8 3.8 0 0 0 7.5 14z"/><path d="M8 16.6v2.8M12 16.6v3.6M16 16.6v2.8"/>',
  snow: '<path d="M7.5 14h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6-1.4A3.8 3.8 0 0 0 7.5 14z"/><path d="M8 16.8v3.4M6.5 17.7l3 1.6M9.5 17.7l-3 1.6"/><path d="M15.5 16.8v3.4M14 17.7l3 1.6M17 17.7l-3 1.6"/>',

  /* --- objects --- */
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7.6 3.6 2.6-1.4 4.3H9.8L8.4 10.2z"/><path d="M12 3v4.6M4.4 9.7l4 .5M7.1 19.2l2.7-4.7M16.9 19.2l-2.7-4.7M19.6 9.7l-4 .5"/>',
  book: '<path d="M4 4.6A1.6 1.6 0 0 1 5.6 3H10a3 3 0 0 1 2 1 3 3 0 0 1 2-1h4.4A1.6 1.6 0 0 1 20 4.6v11.8a1.6 1.6 0 0 1-1.6 1.6H14a3 3 0 0 0-2 1 3 3 0 0 0-2-1H5.6A1.6 1.6 0 0 1 4 16.4z"/><path d="M12 5v14"/>',
  camera: '<rect x="2.5" y="7" width="19" height="12.6" rx="2.6"/><circle cx="12" cy="13.3" r="3.5"/><path d="m8.4 7 1.3-2.2a1 1 0 0 1 .9-.5h2.8a1 1 0 0 1 .9.5L15.6 7"/><circle cx="18.2" cy="10.2" r=".8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.6 2.1"/>',
  guitar: '<circle cx="8.6" cy="15.4" r="5.6"/><circle cx="8.6" cy="15.4" r="1.7"/><path d="m12.6 11.4 4.4-4.4"/><path d="m15.4 5.6 3 3"/><path d="m17.2 3.4 3.4 3.4-2 2-3.4-3.4z"/>',
  pencil: '<path d="m4 20 1-4.6L16.6 3.9a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="m14.6 5.9 3 3"/><path d="M5 15.4 8.6 19"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.4 5.6h3.2"/><circle cx="12" cy="18.2" r=".9"/>',
  shoe: '<path d="M2 17.6v-6.2h3.2l2.6 2H14c3.4 0 6 2.3 6 5.1v1.1H2z"/><path d="M5.2 11.4V9.2"/><path d="m9.6 13.4 1.6-1.6"/>',
  star: '<path d="m12 3.4 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.8l6.1-.9z"/>',
  rocket: '<path d="M12 2.6c2.8 2.4 4.5 6 4.5 9.7v3.3h-9v-3.3c0-3.7 1.7-7.3 4.5-9.7z"/><circle cx="12" cy="10" r="1.8"/><path d="M7.5 13 4.6 16v3.2h2.9M16.5 13l2.9 3v3.2h-2.9"/><path d="M10 18.6c.4 1.5 1 2.5 2 3.4 1-.9 1.6-1.9 2-3.4"/>',
  robot: '<rect x="4.5" y="8" width="15" height="11" rx="3.2"/><circle cx="9.2" cy="13" r="1.2"/><circle cx="14.8" cy="13" r="1.2"/><path d="M12 8V4.8"/><circle cx="12" cy="3.6" r="1.3"/><path d="M9.6 16.3h4.8"/><path d="M4.5 11.6H2.6M19.5 11.6h1.9"/>',

  /* --- ui --- */
  ear: '<path d="M6 8.5a6 6 0 1 1 12 0c0 2.5-1.5 3.6-2.8 4.6-1 .8-1.7 1.4-1.7 2.7A3.3 3.3 0 0 1 10.2 19 3.2 3.2 0 0 1 7 15.8"/><path d="M9.9 9a2.3 2.3 0 0 1 4.6.5c0 1.3-1 1.8-1.8 2.4"/>',
  volume: '<path d="M11 5.5 6.5 9.2H3.4v5.6h3.1L11 18.5z"/><path d="M15 9.2a4 4 0 0 1 0 5.6"/><path d="M17.8 6.4a8 8 0 0 1 0 11.2"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  cross: '<path d="M6 6l12 12M18 6 6 18"/>',
  replay: '<path d="M20 11.5A8 8 0 1 1 17.6 6"/><path d="M20 4.5v5h-5"/>',
  next: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  trophy: '<path d="M7.5 3.5h9v6a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 5.5H4.8v1.6a3 3 0 0 0 3 3M16.5 5.5h2.7v1.6a3 3 0 0 1-3 3"/><path d="M12 14v3.5"/><path d="M8.5 20.5h7l-.8-3h-5.4z"/>',
  unknown: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.6c0 1.7-2.5 2-2.5 4"/><circle cx="12" cy="17.2" r=".9"/>'
};

/* Build an <svg> string for a named icon. size is a CSS length. */
window.icon = function (name, size) {
  var body = window.ICONS[name] || window.ICONS.unknown;
  var s = size || '1.5rem';
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' + body + '</svg>';
};
