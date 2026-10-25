// Formato estándar de PDF (sección 12.3): encabezado y pie de 6 pt en Urbanist, título de 12 pt #1A365D,
// contenido en Manrope, márgenes de 10 mm, A4 vertical u horizontal, nombre PROYECTO-Módulo-DDMMAAAA.pdf.
import { store, param, nombreProyecto } from '../core/store.js';
import { esc } from '../core/util.js';
import { error } from '../ui/ui.js';

function dosDig(n) { return String(n).padStart(2, '0'); }

export function nombreProyectoActual() {
  return store.proyectoSel ? nombreProyecto(store.proyectoSel) : 'Todos los proyectos';
}

// Estilos del documento PDF (encabezado y pie de página, tablas, KPIs). Se usan en la ventana de impresión
// y en la presentación preliminar del módulo Reportes.
function estilosPDF({ version, proy, fecha, hora, firma }) {
  const cssTxt = s => JSON.stringify(String(s));
  return `  @page {
    margin: 10mm;
    @top-left { content: ${cssTxt(version)}; font: 6pt 'Urbanist', sans-serif; color: #4A5568; }
    @top-center { content: ${cssTxt(proy)}; font: 6pt 'Urbanist', sans-serif; color: #4A5568; }
    @top-right { content: ${cssTxt(fecha + ', ' + hora)}; font: 6pt 'Urbanist', sans-serif; color: #4A5568; }
    @bottom-left { content: ${cssTxt(firma)}; font: 6pt 'Urbanist', sans-serif; color: #718096; }
    @bottom-center { content: "—"; font: 6pt 'Urbanist', sans-serif; color: #718096; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 6pt 'Urbanist', sans-serif; color: #718096; }
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Manrope', Arial, sans-serif; color: #1A1A2E; margin: 0; font-size: 9pt; background: #E9EDF3; }
  .barra { position: sticky; top: 0; background: #1A1A2E; color: #fff; padding: 8px 14px; display: flex; gap: 8px; align-items: center; font: 13px 'Manrope', sans-serif; z-index: 5; }
  .barra button { border: 1px solid #ffffff44; background: transparent; color: #fff; border-radius: 6px; padding: 5px 12px; cursor: pointer; font: inherit; }
  .barra button.pri { background: #E8762B; border-color: #E8762B; font-weight: 700; }
  .barra button.act { background: #ffffff22; }
  .barra input { font: inherit; padding: 4px 8px; border-radius: 5px; border: none; width: 380px; }
  .hoja { background: #fff; width: 210mm; margin: 16px auto; padding: 10mm; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
  .hoja.land { width: 297mm; }
  .enc { display: flex; justify-content: space-between; font: 6pt 'Urbanist', sans-serif; color: #4A5568; border-bottom: .5pt solid #CBD5E0; padding-bottom: 2mm; margin-bottom: 4mm; }
  .pie { display: flex; justify-content: space-between; font: 6pt 'Urbanist', sans-serif; color: #718096; border-top: .5pt solid #CBD5E0; padding-top: 2mm; margin-top: 4mm; }
  h1.titulo { font-family: 'Urbanist', sans-serif; font-size: 12pt; color: #1A365D; text-align: center; margin: 0 0 5mm; }
  h2 { font-size: 10pt; color: #1A365D; margin: 5mm 0 2mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; page-break-inside: auto; }
  table.fija { table-layout: fixed; }
  table.fija td, table.fija th { overflow-wrap: anywhere; white-space: pre-wrap; }
  table.fija .badge { white-space: nowrap; overflow-wrap: normal; }
  tr { page-break-inside: avoid; }
  th { background: #EBF2F8; color: #1A365D; text-align: left; font-weight: 700; }
  th, td { border: .5pt solid #CBD5E0; padding: 1.4mm 2mm; font-size: 8pt; vertical-align: top; }
  td.num, th.num { text-align: right; }
  .kpis { display: flex; gap: 3mm; margin-bottom: 4mm; flex-wrap: wrap; }
  .kpi { flex: 1; min-width: 28mm; border: .5pt solid #CBD5E0; border-top: 2pt solid var(--kc, #4E79A7); border-radius: 2mm; padding: 2mm 3mm; }
  .kpi small { display: block; color: #718096; font-size: 6.5pt; text-transform: uppercase; }
  .kpi b { font-size: 13pt; color: var(--kc, #1A365D); }
  .badge { display: inline-block; padding: 0 2mm; border-radius: 2mm; font-size: 7pt; font-weight: 700; color: var(--c); border: .5pt solid var(--c); }
  .nota { color: #718096; font-size: 7.5pt; }
  img, svg, canvas { max-width: 100%; }
  @media print {
    body { background: #fff; }
    .barra, .enc, .pie { display: none; }
    .hoja { width: auto; margin: 0; padding: 0; box-shadow: none; }
  }
`;
}

export function imprimirPDF(modulo, contenidoHTML, { orientacion = 'portrait', proyectoTexto } = {}) {
  const d = new Date();
  const fecha = `${dosDig(d.getDate())}-${dosDig(d.getMonth() + 1)}-${d.getFullYear()}`;
  const hora = `${dosDig(d.getHours())}:${dosDig(d.getMinutes())}`;
  const proy = proyectoTexto || nombreProyectoActual();
  const archivo = `${proy}-${modulo}-${fecha.replace(/-/g, '')}`.replace(/[\\/:*?"<>|]/g, '_');
  const version = param('version_app') || 'LPS_GT V1.00.01';
  const firma = param('firma_pdf') || 'By EHCM';
  const w = window.open('', '_blank', 'width=1100,height=860');
  if (!w) return error('El navegador bloqueó la ventana de impresión. Permita las ventanas emergentes para este sitio.');
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(archivo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Urbanist:wght@500;700&display=swap" rel="stylesheet">
<style id="pagina">@page { size: A4 ${orientacion}; }</style>
<style>${estilosPDF({ version, proy, fecha, hora, firma })}</style></head><body>
<div class="barra"><button class="pri" onclick="window.print()">🖨 Guardar PDF</button>
  <button id="bv">Vertical</button><button id="bh">Horizontal</button>
  <span style="margin-left:10px">Archivo:</span><input id="fn" value="${esc(archivo)}.pdf">
  <span style="flex:1"></span><button onclick="window.close()">Cerrar</button></div>
<div class="hoja" id="hoja">
  <div class="enc"><span>${esc(version)}</span><span>${esc(proy)}</span><span>${fecha}, ${hora}</span></div>
  <h1 class="titulo">${esc(modulo)}</h1>
  ${contenidoHTML}
  <div class="pie"><span>${esc(firma)}</span><span>—</span><span>Página 1 de 1 (vista previa)</span></div>
</div>
<script>
  function ori(o){ document.getElementById('pagina').textContent='@page { size: A4 '+o+'; }';
    document.getElementById('hoja').classList.toggle('land', o==='landscape');
    document.getElementById('bv').classList.toggle('act', o==='portrait'); document.getElementById('bh').classList.toggle('act', o==='landscape'); }
  document.getElementById('bv').onclick=function(){ori('portrait')}; document.getElementById('bh').onclick=function(){ori('landscape')};
  document.getElementById('fn').oninput=function(e){ document.title=e.target.value.replace(/\\.pdf$/i,''); };
  ori(${JSON.stringify(orientacion)});
<\/script></body></html>`);
  w.document.close();
}

// Ancho relativo por defecto cuando la columna no lo indica: textos largos más anchos, números angostos.
// No depende de los datos, así todas las tablas de un mismo informe tienen exactamente los mismos anchos.
const LARGOS = /actividad|descripci|restricci|acci[oó]n|comentario|nombre|proyecto|servicio/i;
function anchoPorDefecto(c) {
  if (c.num) return 50;
  if (LARGOS.test(c.titulo)) return c.titulo.match(/actividad|descripci|restricci|acci/i) ? 260 : 150;
  return 100;
}

/**
 * Construye una tabla HTML para PDF a partir de columnas [{titulo, valor(fila), num, html, ancho}].
 * Los anchos son fijos y proporcionales (ancho = px de la grilla o relativo); el texto se ajusta en varias líneas.
 */
export function tablaPDF(columnas, filas) {
  const pesos = columnas.map(c => Number(c.ancho) || anchoPorDefecto(c));
  const total = pesos.reduce((a, b) => a + b, 0) || 1;
  const colgroup = `<colgroup>${pesos.map(w => `<col style="width:${(w * 100 / total).toFixed(2)}%">`).join('')}</colgroup>`;
  return `<table class="fija">${colgroup}<thead><tr>${columnas.map(c => `<th${c.num ? ' class="num"' : ''}>${esc(c.titulo)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f => `<tr>${columnas.map(c => `<td${c.num ? ' class="num"' : ''}>${c.html ? c.valor(f) : esc(c.valor(f) ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function kpisPDF(items) {
  return `<div class="kpis">${items.map(([t, v, color]) => `<div class="kpi" style="--kc:${color || '#4E79A7'}"><small>${esc(t)}</small><b>${esc(v)}</b></div>`).join('')}</div>`;
}

// ---------- Presentación preliminar (módulo Reportes) ----------
export const PAPELES = { A4: [210, 297], A3: [297, 420], Carta: [216, 279], Oficio: [216, 330] };

/**
 * Documento completo de un reporte para mostrarlo en un iframe e imprimirlo/guardarlo como PDF.
 * papel: A4 | A3 | Carta | Oficio · orientacion: portrait | landscape · unaHoja: escala para que entre en una sola hoja.
 */
export function documentoReporte(titulo, contenidoHTML, { papel = 'A4', orientacion = 'portrait', unaHoja = false, proyectoTexto, archivo } = {}) {
  const d = new Date();
  const fecha = `${dosDig(d.getDate())}-${dosDig(d.getMonth() + 1)}-${d.getFullYear()}`;
  const hora = `${dosDig(d.getHours())}:${dosDig(d.getMinutes())}`;
  const proy = proyectoTexto || nombreProyectoActual();
  const version = param('version_app') || 'LPS_GT V1.00.01';
  const firma = param('firma_pdf') || 'By EHCM';
  const [a, b] = PAPELES[papel] || PAPELES.A4;
  const [ancho, alto] = orientacion === 'landscape' ? [b, a] : [a, b];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(archivo || titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Urbanist:wght@500;700&display=swap" rel="stylesheet">
<style>${estilosPDF({ version, proy, fecha, hora, firma })}</style>
<style>
  @page { size: ${ancho}mm ${alto}mm; }
  body { padding: 14px 0; }
  .barra { display: none; }
  .hoja { width: ${ancho}mm; min-height: ${alto}mm; }
  .hoja.land { width: ${ancho}mm; }
  @media screen { .hoja { zoom: var(--vista, 1); } }   /* la hoja entera cabe en el ancho de la vista previa */
</style></head><body>
<div class="hoja" id="hoja">
  <div class="enc"><span>${esc(version)}</span><span>${esc(proy)}</span><span>${fecha}, ${hora}</span></div>
  <h1 class="titulo">${esc(titulo)}</h1>
  <div id="contenido">${contenidoHTML}</div>
  <div class="pie"><span>${esc(firma)}</span><span>—</span><span>Vista preliminar</span></div>
</div>
<script>
  const encajar = () => { const h = document.getElementById('hoja'); document.documentElement.style.setProperty('--vista', 1);
    document.documentElement.style.setProperty('--vista', Math.min(1, (innerWidth - 28) / h.offsetWidth)); };
  addEventListener('resize', encajar); addEventListener('load', encajar); encajar();
  // "Todo en 1 hoja": reduce el contenido hasta que entre en el alto útil de la hoja
  if (${unaHoja ? 'true' : 'false'}) {
    const ajustar = () => {
      const c = document.getElementById('contenido'); c.style.zoom = 1;
      const mm = 96 / 25.4, util = (${alto} - 20) * mm - 70, anchoUtil = (${ancho} - 20) * mm;
      const z = Math.min(1, util / c.scrollHeight, anchoUtil / c.scrollWidth);
      c.style.zoom = z;
    };
    addEventListener('load', ajustar); setTimeout(ajustar, 50);
  }
<\/script></body></html>`;
}
