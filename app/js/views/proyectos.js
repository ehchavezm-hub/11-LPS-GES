// Proyectos (6.3): catálogo que alimenta el menú, propuesta y aprobación, ficha con indicadores e hitos.
import { api, mensajeError } from '../data/api.js';
import { store, cargarCatalogo, esGestor, esStaff, puede, opciones, opcionesLideres, lideres, opcionesEstado, colorEstado, textoEstado, etiqueta, nombre, proyecto, seleccionarProyecto, valoresLista } from '../core/store.js';
import { esc, html, fmtFecha, hoy, num, pct, lunes, sumarSemanas } from '../core/util.js';
import { ir } from '../core/router.js';
import { crearGrilla } from '../ui/grid.js';
import { kpi, badge, pedirDatos, ok, error, confirmar, modal, vacio, toast } from '../ui/ui.js';
import { columnasPersonalizadas } from '../services/columnas.js';
import { resumenPAC, colorPAC, resumenRestricciones } from '../services/indicadores.js';
import { panelColaboracion } from './detalle.js';
import { imprimirPDF, tablaPDF, kpisPDF } from '../services/pdf.js';
import { ROLES } from '../data/catalogos.js';
import { elegirArchivoProyectos } from './importar-proyectos.js';

// Tres ventanas, una debajo de otra y en este orden. "Propuesto" va en Activos (y en el panel de aprobación); "Rechazado", en Cerrados.
const VENTANAS = [['activo', 'Activos'], ['en_pausa', 'En pausa'], ['cerrado', 'Cerrados']];
const ESTADOS_EDITABLES = ['activo', 'en_pausa', 'cerrado'];
const ventanaDe = p => (p.estado === 'en_pausa' ? 'en_pausa' : ['cerrado', 'rechazado'].includes(p.estado) ? 'cerrado' : 'activo');
let grillas = {};
const todasLasGrillas = () => Object.values(grillas);

export async function render(el, params) {
  destruir();
  el.innerHTML = '';
  if (params.id) return ficha(el, params.id);
  const puedeCrear = puede('crear_proyecto');
  const pag = html(`<div>
    <div class="pagina-cab"><h1>Proyectos</h1>
      <span class="pagina-sub">Catálogo que alimenta el menú de selección y las listas de todas las grillas</span>
      <span class="flex"></span>
      ${puedeCrear || puede('proponer_proyecto') ? `<button class="btn btn-primario" data-a="nuevo">＋ ${puedeCrear ? 'Nuevo proyecto' : 'Proponer proyecto'}</button>` : ''}
      ${puede('importar_historico') ? '<button class="btn btn-sm" data-a="importar">⬆ Importar desde Excel</button>' : ''}
      <button class="btn btn-sm" data-a="pdf">🖨 PDF</button></div>
    <div data-propuestos></div>
    ${VENTANAS.map(([e, t]) => `<section class="ventana-estado ventana-${e}" data-ventana="${e}">
      <h2 class="ventana-tit">${t} <span class="contador-pestana" data-cuenta="${e}"></span></h2><div data-grilla="${e}"></div></section>`).join('')}
  </div>`);
  el.append(pag);
  pag.querySelector('[data-a="nuevo"]')?.addEventListener('click', () => formularioProyecto());
  pag.querySelector('[data-a="importar"]')?.addEventListener('click', () => elegirArchivoProyectos());
  pag.querySelector('[data-a="pdf"]').addEventListener('click', () => imprimirPDF('Catálogo de proyectos', tablaPDF([
    { titulo: 'Código', valor: p => p.codigo }, { titulo: 'Nombre', valor: p => p.nombre_corto }, { titulo: 'Gerencia', valor: p => etiqueta(p.gerencia_id) },
    { titulo: 'Fase', valor: p => etiqueta(p.fase_id) }, { titulo: 'Estado', valor: p => textoEstado('estados_proyecto', p.estado) },
  ], store.proyectos), { proyectoTexto: 'Todos los proyectos', orientacion: 'landscape' }));
  pintarPropuestos(pag);

  for (const [estado] of VENTANAS) grillas[estado] = crearGrilla(pag.querySelector(`[data-grilla="${estado}"]`), configGrilla(estado, puedeCrear));
  await Promise.all(VENTANAS.map(([e]) => grillas[e].inicializar(proyectosDe(e))));
  pintarCuentas();
}

function proyectosDe(estado) { return store.proyectos.filter(p => (esStaff() || p.estado === 'activo') && ventanaDe(p) === estado); }

function pintarCuentas() {
  for (const [e] of VENTANAS) {
    const c = document.querySelector(`#contenido [data-cuenta="${e}"]`);
    if (c && grillas[e]) c.textContent = grillas[e].filas().filter(p => p.id).length;
  }
}

// Vuelve a cargar las tres ventanas desde el catálogo (p. ej. tras cambiar un estado: el proyecto pasa a su ventana)
async function redistribuir() {
  await cargarCatalogo();
  await Promise.all(VENTANAS.map(([e]) => grillas[e]?.setDatos(proyectosDe(e))));
  pintarCuentas();
}

function configGrilla(estado, puedeCrear) {
  return {
    id: 'proyectos_' + estado, tabla: 'proyectos', titulo: VENTANAS.find(v => v[0] === estado)[1], puedeCrear,
    alturaMax: estado === 'activo' ? 'calc(100vh - 230px)' : '420px',
    columnas: [
      { field: 'codigo', title: 'Código', tipo: 'texto', ancho: 90 },
      { field: 'nombre_corto', title: 'Nombre corto', tipo: 'texto', ancho: 200 },
      { field: 'nombre_completo', title: 'Nombre completo', tipo: 'texto', ancho: 260 },
      { field: 'gerencia_id', title: 'Gerencia', tipo: 'lista', ancho: 200, opciones: () => opciones('gerencias') },
      { field: 'fase_id', title: 'Fase', tipo: 'lista', ancho: 120, opciones: () => opciones('fases') },
      { field: 'estado', title: 'Estado', tipo: 'lista', ancho: 115, colorear: true,
        opciones: () => opcionesEstado('estados_proyecto').map(o => ({ ...o, color: colorEstado('estados_proyecto', o.value) })),
        opcionesEdicion: () => opcionesEstado('estados_proyecto').filter(o => ESTADOS_EDITABLES.includes(o.value)) },
      { field: 'pais_id', title: 'País', tipo: 'lista', ancho: 90, opciones: () => opciones('paises') },
      { field: 'fecha_inicio', title: 'Inicio', tipo: 'fecha', ancho: 100 },
      { field: 'fecha_fin', title: 'Fin', tipo: 'fecha', ancho: 100 },
      { field: '_ficha', title: '', tipo: 'texto', ancho: 70, calc: true, filtro: false, formato: (v, p) => p.id ? '<button class="mini-btn">Ficha ›</button>' : '',
        click: (p, e) => { if (p.id && e.target.closest('button')) ir('#/proyectos/' + p.id); } },
      ...(puedeCrear ? [{ field: '_borrar', title: '', tipo: 'texto', ancho: 46, calc: true, filtro: false, ordenable: false,
        formato: (v, p) => p.id ? '<button class="mini-btn mini-peligro" title="Eliminar proyecto">🗑</button>' : '',
        click: (p, e) => { if (p.id && e.target.closest('button')) eliminarProyecto(p, { confirmaciones: 2 }).then(r => r && redistribuir()); } }] : []),
      ...columnasPersonalizadas('proyectos'),
    ],
    agrupar: [{ field: 'gerencia_id', label: 'Gerencia' }, { field: 'fase_id', label: 'Fase' }],
    puedeEditarFila: p => puede('crear_proyecto') || (p.estado === 'propuesto' && p.propuesto_por === store.usuario.id),
    nuevaFila: () => ({ area_id: store.area.id, estado, codigo: '', nombre_corto: '', extra: {} }),
    // Al cambiar el estado se guarda y el proyecto pasa de inmediato a su ventana
    alEditar: async (p, campo) => {
      if (campo !== 'estado' || ventanaDe(p) === estado) return;
      await grillas[estado].guardarAhora();
      await redistribuir();
      toast(`"${p.codigo}" pasó a ${VENTANAS.find(x => x[0] === ventanaDe(p))[1]}.`, 'ok');
    },
    alCambioRemoto: () => { clearTimeout(configGrilla.t); configGrilla.t = setTimeout(redistribuir, 600); },
    listaParaCrear: p => !!(p.codigo && p.nombre_corto),
    camposCalc: ['created_at', 'updated_at', 'created_by', 'aprobado_at'],
    alGuardar: () => { cargarCatalogo(); pintarCuentas(); },
    // Eliminar (clic derecho → Eliminar fila): solo sin historial; si lo tiene, se ofrece desactivarlo
    eliminar: p => eliminarProyecto(p, { confirmaciones: 1 }),   // la grilla ya hizo la primera pregunta
    menuFila: p => [
      { label: '📄 Ver ficha', action: () => p.id && ir('#/proyectos/' + p.id) },
      ...(p.id && puede('crear_proyecto') ? [p.estado === 'cerrado'
        ? { label: '▶ Reactivar proyecto', action: () => cambiarEstado(p, 'activo') }
        : { label: '⛔ Desactivar proyecto (Cerrado)', action: () => cambiarEstado(p, 'cerrado') }] : []),
      { label: '👥 Asignar líderes…', action: () => p.id && asignarLideres(p), disabled: !puede('crear_proyecto') },
      { label: '🏗 Seleccionar en el menú', action: () => p.id && seleccionarProyecto(p.id) },
    ],
  };
}

export function destruir() { todasLasGrillas().forEach(g => g.destruir()); grillas = {}; }

// Todas las personas del equipo (todos los roles que planifican, delegado y administradores), por nombre, con su rol
function opcionesEquipo() {
  return lideres().slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => ({ value: p.id, label: p.nombre, nota: ROLES[p.rol] || p.rol }));
}

// ---------- Desactivar / eliminar ----------
// Desactivar (estado "Cerrado") es lo recomendado: el proyecto sale de menús y selectores pero conserva su historial.
async function cambiarEstado(p, estado, { preguntar = true } = {}) {
  const desactiva = estado === 'cerrado';
  if (desactiva && preguntar && !await confirmar(`¿Desactivar "${p.codigo} · ${p.nombre_corto}"? Dejará de aparecer en el menú de proyectos y en los selectores ` +
    '(actividades, CET / Servicio, cartera). Su historial y PAC se conservan y puede reactivarlo cuando quiera.', { titulo: 'Desactivar proyecto', texto: 'Desactivar' })) return false;
  try {
    await api.update('proyectos', p.id, { estado });
    ok(desactiva ? 'Proyecto desactivado.' : 'Proyecto reactivado.');
    await cargarCatalogo();
    if (location.hash.startsWith('#/proyectos')) render(document.getElementById('contenido'), {});
  } catch (e) { error(mensajeError(e)); }
  return true;
}

/** Cuántos registros usan el proyecto (si hay alguno, no se elimina). */
async function usosDeProyecto(id) {
  const tablas = [['actividades', 'actividad(es)'], ['cartera', 'registro(s) de cartera'], ['restricciones', 'restricción(es)'], ['plantilla_items', 'ítem(s) de plantilla']];
  const n = await Promise.all(tablas.map(([t]) => api.list(t, { eq: { proyecto_id: id }, limit: 1000 }).then(r => r.length).catch(() => 0)));
  return tablas.map(([, t], i) => n[i] ? `${n[i]} ${t}` : '').filter(Boolean);
}

// confirmaciones: cuántas preguntas hacer antes de borrar (el botón 🗑 y la ficha hacen dos)
async function eliminarProyecto(p, { confirmaciones = 2 } = {}) {
  if (!puede('crear_proyecto')) throw new Error('No tiene permiso para eliminar proyectos.');
  const usos = await usosDeProyecto(p.id);
  if (usos.length) {
    if (p.estado === 'cerrado') { toast(`"${p.codigo}" tiene historial (${usos.join(', ')}) y ya está desactivado; no se elimina.`, 'warn', 7000); return false; }
    if (await confirmar(`"${p.codigo} · ${p.nombre_corto}" tiene historial: ${usos.join(', ')}. Eliminarlo borraría ese historial y cambiaría el PAC, ` +
      'por eso no se elimina. ¿Desactivarlo en su lugar? Dejará de aparecer en menús y selectores.', { titulo: 'No se puede eliminar', texto: 'Desactivar' })) {
      await cambiarEstado(p, 'cerrado', { preguntar: false });
    }
    return false;
  }
  if (confirmaciones >= 2 && !await confirmar(`¿Eliminar el proyecto "${p.codigo} · ${p.nombre_corto}"? No tiene actividades ni otros registros.`,
    { titulo: 'Eliminar proyecto (1 de 2)', texto: 'Sí, eliminar', peligro: true })) return false;
  if (confirmaciones >= 1 && !await confirmar(`Confirme nuevamente: "${p.codigo} · ${p.nombre_corto}" se eliminará definitivamente. Esta acción no se puede deshacer.`,
    { titulo: `Eliminar proyecto (${confirmaciones >= 2 ? '2 de 2' : 'confirmación final'})`, texto: 'Eliminar definitivamente', peligro: true })) return false;
  // Sin historial: se borra y se quita su asociación en la lista CET / Servicio
  for (const v of valoresLista('servicios', { inactivos: true }).filter(x => x.extra?.proyecto_id === p.id)) {
    await api.update('lista_valores', v.id, { extra: { ...v.extra, proyecto_id: null } });
  }
  await api.remove('proyectos', p.id);
  if (store.proyectoSel === p.id) seleccionarProyecto('');
  ok(`Proyecto "${p.codigo}" eliminado.`);
  await cargarCatalogo();
  return true;
}

function lideresDe(id) { return store.proyectoLideres.filter(l => l.proyecto_id === id).map(l => l.usuario_id); }

function pintarPropuestos(pag) {
  const props = store.proyectos.filter(p => p.estado === 'propuesto');
  const cont = pag.querySelector('[data-propuestos]');
  if (!props.length || !esStaff()) { cont.innerHTML = ''; return; }
  const aprueba = puede('aprobar_proyecto');
  cont.innerHTML = `<div class="tarjeta" style="margin-bottom:12px;border-left:4px solid var(--amarillo)"><h2>Proyectos propuestos por aprobar (${props.length})</h2>
    <table class="simple"><tr><th>Código</th><th>Nombre</th><th>Gerencia</th><th>Propuesto por</th><th>Observaciones</th><th></th></tr>
    ${props.map(p => `<tr><td>${esc(p.codigo)}</td><td>${esc(p.nombre_corto)}</td><td>${esc(etiqueta(p.gerencia_id))}</td><td>${esc(nombre(p.propuesto_por))}</td>
      <td>${esc(p.observaciones || '')}</td><td style="white-space:nowrap">${aprueba ? `<button class="btn btn-sm btn-primario" data-aprobar="${p.id}">Aprobar</button>
      <button class="btn btn-sm" data-rechazar="${p.id}">Rechazar</button>` : '<span class="nota">En revisión</span>'}</td></tr>`).join('')}</table>
    <p class="nota">Mientras está propuesto, el líder ya puede registrar actividades en él (marcadas "por aprobar").</p></div>`;
  cont.querySelectorAll('[data-aprobar]').forEach(b => b.onclick = async () => {
    try {
      await api.update('proyectos', b.dataset.aprobar, { estado: 'activo', aprobado_por: store.usuario.id, aprobado_at: new Date().toISOString() });
      ok('Proyecto aprobado. Ya aparece en el menú.');
      await cargarCatalogo(); render(document.getElementById('contenido'), {});
    } catch (e) { error(mensajeError(e)); }
  });
  cont.querySelectorAll('[data-rechazar]').forEach(b => b.onclick = async () => {
    const d = await pedirDatos({ titulo: 'Rechazar proyecto', texto: 'Rechazar', campos: [{ name: 'motivo', label: 'Motivo (se notifica a quien lo propuso)', type: 'textarea', required: true }] });
    if (!d) return;
    try {
      await api.update('proyectos', b.dataset.rechazar, { estado: 'rechazado', motivo_rechazo: d.motivo });
      ok('Proyecto rechazado.');
      await cargarCatalogo(); render(document.getElementById('contenido'), {});
    } catch (e) { error(mensajeError(e)); }
  });
}

/** Alta de proyecto: crea (administrador / delegado) o propone (líder). */
export async function formularioProyecto(p = null) {
  const crea = puede('crear_proyecto');
  const d = await pedirDatos({
    titulo: p ? 'Editar proyecto' : crea ? 'Nuevo proyecto' : 'Proponer proyecto', texto: p ? 'Guardar' : crea ? 'Crear' : 'Enviar propuesta',
    antes: !crea && !p ? 'El proyecto quedará "Propuesto" hasta que el administrador lo apruebe. Mientras tanto ya puede registrar actividades en él.' : '',
    valores: p || { estado: 'activo' },
    campos: [
      { name: 'codigo', label: 'Código', required: true, placeholder: 'Ej.: 3126 o INT-012' },
      { name: 'nombre_corto', label: 'Nombre corto (menú)', required: true },
      { name: 'nombre_completo', label: 'Nombre completo' },
      { name: 'gerencia_id', label: 'Gerencia', type: 'select', required: true, options: opciones('gerencias') },
      { name: 'fase_id', label: 'Fase', type: 'select', options: opciones('fases') },
      { name: 'pais_id', label: 'País', type: 'select', options: opciones('paises') },
      { name: 'fecha_inicio', label: 'Inicio previsto', type: 'date' },
      { name: 'fecha_fin', label: 'Fin previsto', type: 'date' },
      ...(crea ? [{ name: 'lideres', label: 'Líderes asignados', type: 'multiselect', unaColumna: true, options: opcionesEquipo(), value: p ? lideresDe(p.id) : [store.usuario.id] }] : []),
      { name: 'observaciones', label: 'Observaciones', type: 'textarea' },
    ],
    alGuardar: async v => {
      const { lideres, ...datos } = v;
      if (store.proyectos.some(x => x.codigo === datos.codigo && x.id !== p?.id)) throw new Error('Ya existe un proyecto con ese código.');
      let reg;
      if (p) reg = await api.update('proyectos', p.id, datos);
      else [reg] = await api.insert('proyectos', { ...datos, area_id: store.area.id, estado: crea ? 'activo' : 'propuesto', propuesto_por: crea ? null : store.usuario.id });
      if (crea && lideres) {
        await api.removeWhere('proyecto_lideres', { eq: { proyecto_id: reg.id } });
        if (lideres.length) await api.insert('proyecto_lideres', lideres.map(u => ({ proyecto_id: reg.id, usuario_id: u })));
      } else if (!crea && !p) {
        await api.insert('proyecto_lideres', { proyecto_id: reg.id, usuario_id: store.usuario.id }).catch(() => {});
      }
      ok(crea || p ? 'Proyecto guardado.' : 'Propuesta enviada al administrador.');
      await cargarCatalogo();
    },
  });
  if (d && location.hash.startsWith('#/proyectos')) render(document.getElementById('contenido'), {});
}

async function asignarLideres(p) {
  await pedirDatos({
    titulo: `Líderes de ${p.nombre_corto}`, texto: 'Guardar',
    campos: [{ name: 'lideres', label: 'Líderes', type: 'multiselect', unaColumna: true, options: opcionesEquipo(), value: lideresDe(p.id) }],
    alGuardar: async v => {
      await api.removeWhere('proyecto_lideres', { eq: { proyecto_id: p.id } });
      if (v.lideres.length) await api.insert('proyecto_lideres', v.lideres.map(u => ({ proyecto_id: p.id, usuario_id: u })));
      await cargarCatalogo();
      todasLasGrillas().forEach(g => g.refrescar());
    },
  });
}

async function ficha(el, id) {
  const p = proyecto(id);
  if (!p) { el.innerHTML = vacio('Proyecto no encontrado o sin permiso para verlo.'); return; }
  const [acts, rests, hitos, cartera] = await Promise.all([
    api.list('actividades', { eq: { proyecto_id: id } }),
    esStaff() ? api.list('restricciones', { eq: { proyecto_id: id } }) : Promise.resolve([]),
    esStaff() ? api.list('hitos', { eq: { proyecto_id: id }, order: [['fecha', true]] }) : Promise.resolve([]),
    esStaff() ? api.list('cartera', { eq: { proyecto_id: id } }) : Promise.resolve([]),
  ]);
  const r = resumenPAC(acts);
  const rr = resumenRestricciones(rests);
  const ult = acts.filter(a => a.semana >= sumarSemanas(lunes(), -4) && a.semana < lunes());
  const r4 = resumenPAC(ult);
  const pag = html(`<div>
    <div class="pagina-cab"><a href="#/proyectos" class="btn btn-sm">‹ Proyectos</a>
      <h1>${esc(p.codigo)} · ${esc(p.nombre_corto)}</h1>${badge(textoEstado('estados_proyecto', p.estado), colorEstado('estados_proyecto', p.estado))}
      <span class="flex"></span>
      <button class="btn btn-sm" data-a="menu">🏗 Seleccionar en el menú</button>
      ${puede('crear_proyecto') || (p.estado === 'propuesto' && p.propuesto_por === store.usuario.id) ? '<button class="btn btn-sm" data-a="editar">✏ Editar</button>' : ''}
      ${puede('crear_proyecto') ? (p.estado === 'cerrado' ? '<button class="btn btn-sm" data-a="reactivar">▶ Reactivar</button>'
        : '<button class="btn btn-sm" data-a="desactivar" title="Recomendado: sale de menús y selectores y conserva el historial">⛔ Desactivar</button>') +
        '<button class="btn btn-sm btn-peligro-borde" data-a="eliminar" title="Solo si no tiene actividades ni otros registros">🗑 Eliminar</button>' : ''}
      <button class="btn btn-sm" data-a="pdf">🖨 PDF</button></div>
    <p class="pagina-sub">${esc(p.nombre_completo || '')}</p>
    <div class="kpis">
      ${kpi('PAC histórico', pct(r.pac), { color: colorPAC(r.pac), sub: `${r.completadas} de ${r.completadas + r.noCompletadas}` })}
      ${kpi('PAC últimas 4 semanas', pct(r4.pac), { color: colorPAC(r4.pac) })}
      ${kpi('HH planificadas', num(r.hhPlan))}
      ${kpi('HH reales', r.hhReal == null ? '—' : num(r.hhReal))}
      ${kpi('Restricciones abiertas', rr.abiertas, { color: rr.abiertas ? '#EDC948' : '#59A14F', sub: `${rr.vencidas} vencidas` })}
      ${kpi('Cartera abierta', cartera.filter(c => ['abierta', 'en_proceso', 'nueva'].includes(c.estado)).length)}
    </div>
    <div class="grid-2">
      <div class="tarjeta"><h2>Datos</h2><table class="simple">
        <tr><td>Gerencia</td><td>${esc(etiqueta(p.gerencia_id))}</td></tr>
        <tr><td>Fase</td><td>${esc(etiqueta(p.fase_id))}</td></tr>
        <tr><td>País</td><td>${esc(etiqueta(p.pais_id))}</td></tr><tr><td>Fechas</td><td>${fmtFecha(p.fecha_inicio)} – ${fmtFecha(p.fecha_fin)}</td></tr>
        <tr><td>Líderes</td><td>${esc(lideresDe(id).map(nombre).join(', ') || '—')}</td></tr>
        ${p.propuesto_por ? `<tr><td>Propuesto por</td><td>${esc(nombre(p.propuesto_por))}${p.aprobado_at ? ` · aprobado el ${fmtFecha(p.aprobado_at)}` : ''}</td></tr>` : ''}
        ${p.motivo_rechazo ? `<tr><td>Motivo de rechazo</td><td>${esc(p.motivo_rechazo)}</td></tr>` : ''}
        <tr><td>Observaciones</td><td>${esc(p.observaciones || '')}</td></tr></table></div>
      <div class="tarjeta"><h2>Hitos</h2><div data-hitos></div>
        ${esStaff() ? '<button class="btn btn-sm" data-a="hito" style="margin-top:8px">＋ Agregar hito</button>' : ''}</div>
    </div>
    ${esStaff() ? '<div class="tarjeta" style="margin-top:14px"><h2>Comentarios y documentos</h2><div data-colab></div></div>' : ''}
  </div>`);
  el.append(pag);
  const pintarHitos = lista => {
    pag.querySelector('[data-hitos]').innerHTML = lista.length ? `<table class="simple"><tr><th>Hito / entregable</th><th>Fecha</th><th>Estado</th><th></th></tr>
      ${lista.map(h => `<tr><td>${esc(h.nombre)}</td><td>${fmtFecha(h.fecha)}</td><td>${badge(h.estado, { pendiente: '#EDC948', cumplido: '#59A14F', atrasado: '#E15759', cancelado: '#BAB0AC' }[h.estado])}</td>
        <td>${esStaff() ? `<select class="sel" data-hito="${h.id}">${['pendiente', 'cumplido', 'atrasado', 'cancelado'].map(e => `<option${e === h.estado ? ' selected' : ''}>${e}</option>`).join('')}</select>` : ''}</td></tr>`).join('')}</table>`
      : '<p class="nota">Sin hitos. Úselos solo cuando el proyecto lo amerite.</p>';
    pag.querySelectorAll('[data-hito]').forEach(s => s.onchange = async () => {
      try { await api.update('hitos', s.dataset.hito, { estado: s.value }); ok('Hito actualizado.'); } catch (e) { error(mensajeError(e)); }
    });
  };
  pintarHitos(hitos.map(h => (h.estado === 'pendiente' && h.fecha && h.fecha < hoy() ? { ...h, estado: 'atrasado' } : h)));
  pag.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'menu') { seleccionarProyecto(id); ok('Proyecto seleccionado en el menú.'); }
    if (a === 'editar') { await formularioProyecto(p); el.innerHTML = ''; ficha(el, id); }
    if (a === 'desactivar' || a === 'reactivar') { if (await cambiarEstado(p, a === 'desactivar' ? 'cerrado' : 'activo') !== false) { el.innerHTML = ''; ficha(el, id); } }
    if (a === 'eliminar') {
      try { if (await eliminarProyecto(p, { confirmaciones: 2 })) ir('#/proyectos'); else { el.innerHTML = ''; ficha(el, id); } } catch (err) { error(mensajeError(err)); }
    }
    if (a === 'hito') {
      await pedirDatos({ titulo: 'Nuevo hito', campos: [{ name: 'nombre', label: 'Hito / entregable', required: true, full: true }, { name: 'fecha', label: 'Fecha', type: 'date', required: true }],
        alGuardar: async v => { await api.insert('hitos', { ...v, area_id: store.area.id, proyecto_id: id }); } });
      pintarHitos(await api.list('hitos', { eq: { proyecto_id: id }, order: [['fecha', true]] }));
    }
    if (a === 'pdf') imprimirPDF('Ficha de proyecto', kpisPDF([['PAC', pct(r.pac), colorPAC(r.pac)], ['HH plan', num(r.hhPlan)], ['Restricciones abiertas', rr.abiertas]]) +
      tablaPDF([{ titulo: 'Campo', valor: x => x[0] }, { titulo: 'Valor', valor: x => x[1] }], [['Código', p.codigo], ['Nombre', p.nombre_completo || p.nombre_corto],
        ['Gerencia', etiqueta(p.gerencia_id)], ['Fase', etiqueta(p.fase_id)], ['Líderes', lideresDe(id).map(nombre).join(', ')]]) +
      '<h2>Hitos</h2>' + tablaPDF([{ titulo: 'Hito', valor: h => h.nombre }, { titulo: 'Fecha', valor: h => fmtFecha(h.fecha) }, { titulo: 'Estado', valor: h => h.estado }], hitos),
      { proyectoTexto: `${p.codigo} · ${p.nombre_corto}` });
  });
  const colab = pag.querySelector('[data-colab]');
  if (colab) colab.append(await panelColaboracion('proyecto', id));
}
