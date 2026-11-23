// Íconos de línea del menú (pedido 176): reemplazan a los emojis, que cada sistema dibuja distinto (Windows, Mac, Android).
// Trazo con currentColor: toman el color del texto (también el blanco de la sección activa en naranja).
const T = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

const ICONOS = {
  admin: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  plan: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/>',
  lookahead: '<path d="M3.5 18h17M6 18V12M10.5 18V8.5M15 18v-5M19.5 18V6"/><path d="M4 7.5l5-3 4 2.5 6.5-4"/>',
  backlog: '<rect x="3.5" y="4" width="17" height="5" rx="1.2"/><path d="M5 9v10a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V9M10 13h4"/>',
  restricciones: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.2M12 17v.01"/>',
  cartera: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.5l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v8.8A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  tablero: '<path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="3" height="5.5" rx=".6"/><rect x="12" y="7.5" width="3" height="10" rx=".6"/><rect x="17" y="10" width="3" height="7.5" rx=".6"/>',
  reunion: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.5 14.3A4.5 4.5 0 0 1 20.5 19"/>',
  equipo: '<circle cx="12" cy="12" r="8.5"/><path d="M12 12l4-3M12 6.5v1.2M6.5 12h1.2M17.5 12h-1.2"/>',
  reportes: '<path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="8" rx="1.5"/><path d="M7 14h10v6.5H7z"/>',
  config: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  plantillas: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
  ayuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7M12 17v.01"/>',
  mejoras: '<path d="M9 17.5h6M10 20.5h4M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.5 1.2 1.3 1.2 2.1v.4h4v-.4c0-.8.5-1.6 1.2-2.1A5.5 5.5 0 0 0 12 3.5z"/>',
  proyecto: '<rect x="5" y="3.5" width="14" height="17" rx="1.8"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
  grupo: '<circle cx="12" cy="12" r="3"/>',
  empresa: '<path d="M4 20.5V5.5A1.5 1.5 0 0 1 5.5 4h7A1.5 1.5 0 0 1 14 5.5v15M14 10h4.5a1.5 1.5 0 0 1 1.5 1.5v9M2.5 20.5h19M7.5 8h3M7.5 11.5h3M7.5 15h3"/>',
  portafolio: '<rect x="3.5" y="7" width="17" height="12.5" rx="1.8"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
  programa: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.5l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v8.8A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
};

/** SVG del ícono (o el texto tal cual si no es un nombre conocido, para no romper usos anteriores). */
export const icono = nombre => (ICONOS[nombre] ? T(ICONOS[nombre]) : String(nombre ?? ''));
