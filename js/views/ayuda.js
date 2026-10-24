// Ayuda en línea, guía rápida en PDF y recorrido guiado la primera vez (M-11).
import { api } from '../data/api.js';
import { store, param, esStaff } from '../core/store.js';
import { esc, html } from '../core/util.js';
import { imprimirPDF } from '../services/pdf.js';

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function guia() {
  const c = param('cierre') || {}, r = param('reunion') || {};
  return [
    ['¿Qué es LPS-GT?', `<p>Es la aplicación del <b>Last Planner System®</b> a la gestión de la Gerencia Técnica. Cada líder planifica su trabajo semanal,
      identifica lo que le impide avanzar (restricciones), se compromete con el equipo y, al cierre, registra qué cumplió y por qué no cumplió lo demás.
      El indicador principal es el <b>PAC</b> (Porcentaje de Actividades Cumplidas) = completadas ÷ (completadas + no completadas) de los compromisos programados.</p>`],
    ['Flujo semanal', `<ol>
      <li><b>Durante la semana:</b> actualice el avance de sus compromisos en <a href="#/plan">Plan semanal</a> y registre las actividades no programadas que surjan.</li>
      <li><b>Lunes a jueves:</b> mantenga su <a href="#/lookahead">Look Ahead</a> (${param('semanas_lookahead')} semanas) y levante sus <a href="#/restricciones">restricciones</a>.</li>
      <li><b>Reunión del ${DIAS[r.dia] || 'viernes'} ${esc(r.hora || '08:00')}:</b> se revisa el PAC y las causas, el avance, las restricciones y se comprometen las actividades de la semana siguiente.</li>
      <li><b>Cierre del ${DIAS[c.dia] || 'viernes'} ${esc(c.hora || '17:00')}:</b> marque cada compromiso como Completado, No completado (con su CNC) o Cancelado, registre las HH reales y use <b>🔒 Cerrar semana</b>.
        Si no lo hace, la semana se cierra automáticamente y lo pendiente queda como "No reportado".</li></ol>`],
    ['La grilla tipo Excel', `<ul><li>Doble clic, Enter o simplemente escriba para editar. Se guarda solo.</li>
      <li>Seleccione rangos con el mouse o Shift+flechas. <b>Ctrl+C / Ctrl+V</b> funcionan con Excel; si pega más filas de las que hay, se crean filas nuevas.</li>
      <li><b>📋 Pegar filas de Excel</b> agrega muchas filas de una vez. <b>⬇ Rellenar</b> (Ctrl+D) copia el primer valor hacia abajo. Supr borra.</li>
      <li>Clic derecho sobre una fila: insertar, duplicar, eliminar, restricciones, comentarios.</li>
      <li><b>▥ Columnas</b> muestra/oculta y fija columnas; arrastre los títulos para reordenar. <b>👁 Vista</b> guarda configuraciones.</li>
      <li>Puede ver las filas de todo el equipo, pero solo edita las suyas.</li></ul>`],
    ['Menú de proyectos', `<p>En el panel izquierdo elija un proyecto para filtrar todas las pantallas. Use las pestañas <b>Mis</b>, <b>Todos</b> y <b>★ Favoritos</b>.
      Con <b>＋</b> puede proponer un proyecto nuevo; el administrador lo aprueba.</p>`],
    ['Restricciones y compromisos', `<p>Una restricción es algo que impide ejecutar una actividad (información del cliente, aprobaciones, accesos, otra área…).
      Si compromete una actividad que todavía tiene restricciones pendientes, el aplicativo le advierte pero no lo impide.</p>`],
    ['Solicitudes de otras gerencias', `<p>Los usuarios de consulta registran pedidos de servicio en <a href="#/cartera">Cartera y solicitudes</a>. El administrador o el líder destinatario los acepta (asignando fecha) o los rechaza con un motivo.</p>`],
    ['Indicadores', `<ul><li><b>PAC</b> y su tendencia; <b>PAC ponderado por HH</b> (que las tareas grandes pesen más).</li>
      <li><b>Pareto de CNC</b>: causas más frecuentes de no cumplimiento.</li><li><b>Carga vs capacidad</b>: HH comprometidas frente a HH disponibles.</li>
      <li><b>Precisión de estimación</b>: HH reales ÷ planificadas (ideal 1,0).</li><li><b>Restricciones a tiempo</b> y días de atraso.</li></ul>`],
  ];
}

export async function render(el) {
  el.innerHTML = '';
  el.append(html(`<div><div class="pagina-cab"><h1>Ayuda</h1><span class="flex"></span>
    <button class="btn btn-sm" data-a="tour">▶ Recorrido guiado</button><button class="btn btn-sm" data-a="pdf">🖨 Guía rápida (PDF)</button></div>
    <div class="tarjeta">${guia().map(([t, c]) => `<div class="ayuda-seccion"><h2>${esc(t)}</h2>${c}</div>`).join('')}</div></div>`));
  el.querySelector('[data-a="tour"]').onclick = () => iniciarRecorrido(true);
  el.querySelector('[data-a="pdf"]').onclick = () => imprimirPDF('Guía rápida LPS-GT', guia().map(([t, c]) => `<h2>${esc(t)}</h2>${c}`).join(''), { proyectoTexto: 'Todos los proyectos' });
}

const PASOS = [
  ['.nav', 'Navegación', 'Aquí están las pantallas: Plan semanal, Look Ahead, Restricciones, Cartera, Tablero y Reunión semanal.'],
  ['.menu-proy', 'Menú de proyectos', 'Elija un proyecto para filtrar todas las pantallas. Marque sus favoritos con ★.'],
  ['.grilla, .contenido', 'Grilla tipo Excel', 'Edite como en Excel: escriba, copie y pegue desde Excel, rellene hacia abajo y use clic derecho para más opciones. Todo se guarda solo.'],
  ['.kpis, .contenido', 'Indicadores', 'El PAC y la carga se actualizan en tiempo real mientras usted y su equipo trabajan.'],
  ['[data-a="notif"]', 'Notificaciones', 'Aquí llegan las menciones, solicitudes, aprobaciones y recordatorios.'],
  ['[data-a="ayuda"]', 'Ayuda', 'Puede repetir este recorrido o abrir la guía rápida cuando quiera.'],
];

export function iniciarRecorrido(forzar = false) {
  if (!forzar && store.usuario.tour_visto) return;
  let i = 0;
  const marca = html('<div class="tour-marca"></div>');
  const caja = html('<div class="tour" role="dialog" aria-label="Recorrido guiado"></div>');
  document.body.append(marca, caja);
  const fin = async () => {
    marca.remove(); caja.remove();
    if (!store.usuario.tour_visto) {
      store.usuario.tour_visto = true;
      api.update('profiles', store.usuario.id, { tour_visto: true }).catch(() => {});
    }
  };
  const mostrar = () => {
    const pasos = PASOS.filter(p => esStaff() || !p[0].includes('grilla'));
    if (i >= pasos.length) return fin();
    const [sel, titulo, texto] = pasos[i];
    const objetivo = sel.split(',').map(s => document.querySelector(s.trim())).find(Boolean);
    const r = objetivo?.getBoundingClientRect() || { top: 100, left: 100, width: 200, height: 60 };
    Object.assign(marca.style, { top: r.top - 6 + 'px', left: r.left - 6 + 'px', width: r.width + 12 + 'px', height: Math.min(r.height, innerHeight - 40) + 12 + 'px' });
    caja.innerHTML = `<h3>${esc(titulo)}</h3><p>${esc(texto)}</p><div style="display:flex;justify-content:space-between;align-items:center">
      <span class="nota">${i + 1} de ${pasos.length}</span><span><button class="btn btn-sm" data-t="saltar">Saltar</button>
      <button class="btn btn-sm btn-primario" data-t="sig">${i === pasos.length - 1 ? 'Terminar' : 'Siguiente'}</button></span></div>`;
    const top = Math.min(innerHeight - 200, r.top + Math.min(r.height, 300) + 14);
    Object.assign(caja.style, { top: top + 'px', left: Math.max(12, Math.min(innerWidth - 350, r.left)) + 'px' });
  };
  caja.addEventListener('click', e => {
    const t = e.target.closest('[data-t]')?.dataset.t;
    if (t === 'saltar') fin();
    if (t === 'sig') { i++; mostrar(); }
  });
  mostrar();
}
