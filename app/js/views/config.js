// Configuración (6.1, 6.2): usuarios y roles, listas configurables, parámetros, matriz de permisos,
// columnas personalizadas, importación desde Excel, respaldo y auditoría.
import { api, mensajeError, modoDemo } from '../data/api.js';
import { store, cargarCatalogo, esAdmin, puede, opciones, nombre, valoresLista } from '../core/store.js';
import { ACCIONES, ROLES, PARAMETROS_INICIALES } from '../data/catalogos.js';
import { esc, html, fmtFechaHora, fmtFecha, normalizar } from '../core/util.js';
import { ir } from '../core/router.js';
import { crearGrilla } from '../ui/grid.js';
import { ok, error, confirmar, pedirDatos, modal, badge, toast } from '../ui/ui.js';
import { leerLibro, analizar, importar, sugerirUsuario, sugerirProyecto, leerProyectos, gerenciaDe } from '../services/importar.js';

const SECCIONES = [
  ['usuarios', '👤 Usuarios y roles'], ['listas', '📋 Listas'], ['parametros', '🔧 Parámetros'], ['permisos', '🔐 Permisos'],
  ['columnas', '▥ Columnas personalizadas'], ['importar', '⬆ Importar Excel'], ['respaldo', '💾 Respaldo'], ['auditoria', '🕑 Auditoría'],
];
let grilla;

export async function render(el, { seccion }) {
  grilla?.destruir(); grilla = null;
  el.innerHTML = '';
  el.append(html(`<div><div class="pagina-cab"><h1>Configuración</h1></div>
    <div class="pestanas" style="margin-bottom:14px;flex-wrap:wrap">${SECCIONES.map(([k, t]) => `<button data-s="${k}" class="${k === seccion ? 'activo' : ''}">${t}</button>`).join('')}</div>
    <div data-sec></div></div>`));
  el.querySelector('.pestanas').addEventListener('click', e => { const s = e.target.closest('[data-s]')?.dataset.s; if (s) ir('#/config/' + s); });
  const cont = el.querySelector('[data-sec]');
  const f = { usuarios, listas, parametros, permisos, columnas, importar: importarVista, respaldo, auditoria }[seccion];
  if (f) await f(cont); else cont.textContent = 'Sección no encontrada.';
}
export function destruir() { grilla?.destruir(); grilla = null; }

// ---------- Usuarios ----------
async function usuarios(el) {
  const perfiles = await api.list('profiles', { eq: { area_id: store.area.id }, order: [['nombre', true]] });
  const historial = await api.list('delegado_historial', { eq: { area_id: store.area.id }, order: [['desde', false]] }).catch(() => []);
  const pendientes = perfiles.filter(p => p.rol === 'pendiente' && p.activo);
  const principal = store.usuario.es_admin_principal;
  el.innerHTML = `
    ${pendientes.length ? `<div class="aviso warn"><b>${pendientes.length} usuario(s) esperan aprobación.</b> Asígneles un rol para que puedan ingresar.</div>` : ''}
    <div class="tarjeta" style="margin-bottom:12px">
      <div class="barra" style="margin-bottom:10px"><h2 style="margin:0">Usuarios</h2><span class="flex"></span>
        ${principal ? '<button class="btn btn-sm btn-azul" data-a="delegado">⭐ Asignar / rotar administrador delegado</button>' : ''}
        <button class="btn btn-sm btn-primario" data-a="nuevo">＋ Nuevo usuario</button>
        <button class="btn btn-sm" data-a="invitar" title="Enlace para que la persona se registre sola">✉ Invitar</button></div>
      <table class="simple"><tr><th>Nombre</th><th>Correo</th><th>Código</th><th>Rol</th><th>Gerencias (consulta)</th><th class="num">H/día</th><th>Estado</th><th></th></tr>
      ${perfiles.map(p => `<tr><td><b>${esc(p.nombre)}</b>${p.es_admin_principal ? ' ' + badge('Principal', '#E8762B') : ''}</td><td>${esc(p.email || '')}</td><td>${esc(p.codigo || '')}</td>
        <td>${badge(ROLES[p.rol] || p.rol, { admin: '#E8762B', delegado: '#4E79A7', lider: '#59A14F', consulta: '#76B7B2', pendiente: '#EDC948' }[p.rol])}</td>
        <td>${esc((p.gerencia_ids || []).map(g => store.valores.get(g)?.codigo || '').join(', '))}</td><td class="num">${p.horas_dia ?? '—'}</td>
        <td>${p.activo ? 'Activo' : '<span style="color:var(--rojo)">Inactivo</span>'}</td>
        <td style="white-space:nowrap"><button class="btn btn-sm" data-editar="${p.id}">Editar</button>
          ${puedeRestablecer(p) ? `<button class="btn btn-sm" data-clave="${p.id}" title="Restablecer contraseña">🔑</button>` : ''}</td></tr>`).join('')}</table></div>
    <details class="tarjeta"><summary><b>Historial del administrador delegado</b></summary>
      <table class="simple" style="margin-top:8px"><tr><th>Persona</th><th>Desde</th><th>Hasta</th><th>Otorgado por</th></tr>
      ${historial.map(h => `<tr><td>${esc(nombre(h.usuario_id))}</td><td>${fmtFechaHora(h.desde)}</td><td>${h.hasta ? fmtFechaHora(h.hasta) : 'Vigente'}</td><td>${esc(nombre(h.otorgado_por))}</td></tr>`).join('') || '<tr><td colspan="4" class="nota">Sin registros.</td></tr>'}</table></details>`;
  el.addEventListener('click', async e => {
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    const idClave = e.target.closest('[data-clave]')?.dataset.clave;
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (id) await editarUsuario(perfiles.find(p => p.id === id));
    if (idClave) await restablecerClave(perfiles.find(p => p.id === idClave));
    if (a === 'nuevo') await nuevoUsuario();
    if (a === 'invitar') {
      const url = location.origin + location.pathname;
      modal({ titulo: 'Invitar usuarios', ancho: 560, cuerpo: `<p>Envíe este enlace a las personas que deben usar LPS-GT. Al registrarse quedan <b>pendientes</b> y usted les asigna el rol aquí.</p>
        <p><input class="inp" style="width:100%" readonly value="${esc(url)}"></p>
        <p class="nota">También puede crear la cuenta usted mismo con "＋ Nuevo usuario" y entregarle una contraseña temporal.</p>`,
        botones: [{ texto: 'Copiar enlace', clase: 'btn-primario', accion: async () => { await navigator.clipboard?.writeText(url).catch(() => {}); ok('Enlace copiado.'); } }] });
    }
    if (a === 'delegado') await rotarDelegado(perfiles);
  });
}

// Contraseña temporal legible (sin caracteres que se confunden: 0/O, 1/l/I)
function generarClave() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const n = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(n, x => c[x % c.length]).join('');
}

function puedeRestablecer(p) {
  const yo = store.usuario;
  if (p.id === yo.id) return false;   // la propia se cambia desde el menú de usuario
  if (p.es_admin_principal) return false;
  return yo.es_admin_principal || !['admin', 'delegado'].includes(p.rol);
}

function mostrarCredenciales(titulo, email, clave) {
  const texto = `LPS-GT\nEnlace: ${location.origin + location.pathname}\nUsuario: ${email}\nContraseña temporal: ${clave}\n(Se le pedirá cambiarla al ingresar)`;
  modal({
    titulo, ancho: 520,
    cuerpo: `<p>Entregue estos datos a la persona por un medio privado. Al ingresar se le pedirá definir su propia contraseña.</p>
      <pre class="credenciales">${esc(texto)}</pre>`,
    botones: [{ texto: 'Cerrar' }, { texto: 'Copiar', clase: 'btn-primario', accion: async () => {
      await navigator.clipboard?.writeText(texto).catch(() => {}); ok('Datos copiados.'); return false; } }],
  });
}

async function nuevoUsuario() {
  const principal = store.usuario.es_admin_principal;
  const roles = Object.entries(ROLES).filter(([k]) => k !== 'pendiente' && (principal || !['admin', 'delegado'].includes(k)));
  let creado = null;
  await pedirDatos({
    titulo: 'Nuevo usuario', texto: 'Crear usuario',
    valores: { rol: 'lider', clave: generarClave() },
    campos: [
      { name: 'nombre', label: 'Nombre y apellido', required: true },
      { name: 'email', label: 'Correo (usuario de ingreso)', type: 'email', required: true },
      { name: 'codigo', label: 'Código corto (iniciales)' },
      { name: 'rol', label: 'Rol', type: 'select', required: true, options: roles.map(([value, label]) => ({ value, label })) },
      { name: 'clave', label: 'Contraseña temporal (mínimo 8)', required: true, help: 'Se generó una al azar; puede cambiarla. La persona la cambiará al ingresar.' },
      { name: 'horas_dia', label: 'Horas disponibles por día', type: 'number', min: 0, max: 24, step: 0.5, help: 'Vacío = valor general del área' },
      { name: 'gerencia_ids', label: 'Gerencias visibles (solo usuarios de consulta)', type: 'multiselect', options: opciones('gerencias', { vacio: false }) },
    ],
    alGuardar: async d => {
      if (String(d.clave).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      await api.adminUsuarios('crear', d);
      creado = d;
    },
  });
  if (!creado) return;
  await cargarCatalogo();
  await render(document.getElementById('contenido'), { seccion: 'usuarios' });
  mostrarCredenciales(`Usuario creado: ${creado.nombre}`, creado.email.trim().toLowerCase(), creado.clave);
}

async function restablecerClave(p) {
  let hecho = null;
  await pedirDatos({
    titulo: `Restablecer contraseña: ${p.nombre}`, texto: 'Restablecer',
    antes: 'La contraseña actual dejará de funcionar. Se le pedirá cambiar la nueva al ingresar.',
    valores: { clave: generarClave() },
    campos: [{ name: 'clave', label: 'Nueva contraseña temporal (mínimo 8)', required: true, full: true }],
    alGuardar: async d => {
      if (String(d.clave).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      await api.adminUsuarios('clave', { usuario_id: p.id, clave: d.clave });
      hecho = d.clave;
    },
  });
  if (hecho) mostrarCredenciales(`Contraseña restablecida: ${p.nombre}`, p.email || '', hecho);
}

async function editarUsuario(p) {
  const principal = store.usuario.es_admin_principal;
  const roles = Object.entries(ROLES).filter(([k]) => principal || !['admin', 'delegado'].includes(k) || k === p.rol);
  await pedirDatos({
    titulo: `Usuario: ${p.nombre}`, valores: p,
    campos: [
      { name: 'nombre', label: 'Nombre', required: true }, { name: 'codigo', label: 'Código corto' },
      { name: 'rol', label: 'Rol', type: 'select', options: roles.map(([value, label]) => ({ value, label })),
        help: principal ? '' : 'Solo el administrador principal asigna los roles de administrador y delegado.' },
      { name: 'horas_dia', label: 'Horas disponibles por día', type: 'number', min: 0, max: 24, step: 0.5, help: 'Vacío = valor general del área' },
      { name: 'gerencia_ids', label: 'Gerencias visibles (solo usuarios de consulta)', type: 'multiselect', options: opciones('gerencias', { vacio: false }) },
      { name: 'activo', label: 'Estado', type: 'checkbox', texto: 'Activo (desmarque para bloquear el acceso sin perder su historial)' },
    ],
    alGuardar: async d => {
      if (p.es_admin_principal && (d.rol !== 'admin' || !d.activo)) throw new Error('El administrador principal no puede perder su rol ni desactivarse.');
      await api.update('profiles', p.id, d);
      ok('Usuario actualizado.');
    },
  });
  await cargarCatalogo();
  render(document.getElementById('contenido'), { seccion: 'usuarios' });
}

async function rotarDelegado(perfiles) {
  const actuales = perfiles.filter(p => p.rol === 'delegado');
  const cands = perfiles.filter(p => ['lider', 'delegado'].includes(p.rol) && p.activo);
  const d = await pedirDatos({
    titulo: 'Administrador delegado', texto: 'Asignar',
    antes: `Delegado actual: <b>${esc(actuales.map(a => a.nombre).join(', ') || 'ninguno')}</b>. El anterior vuelve a ser líder de proceso; el cambio queda en el historial.`,
    campos: [{ name: 'nuevo', label: 'Nuevo delegado', type: 'select', options: [{ value: '', label: '— Ninguno (retirar) —' }, ...cands.map(p => ({ value: p.id, label: p.nombre }))] }],
  });
  if (!d) return;
  try {
    for (const a of actuales) if (a.id !== d.nuevo) await api.update('profiles', a.id, { rol: 'lider' });
    if (d.nuevo && !actuales.some(a => a.id === d.nuevo)) await api.update('profiles', d.nuevo, { rol: 'delegado' });
    ok('Administrador delegado actualizado.');
  } catch (e) { error(mensajeError(e)); }
  await cargarCatalogo();
  render(document.getElementById('contenido'), { seccion: 'usuarios' });
}

// ---------- Listas configurables ----------
async function listas(el, claveSel) {
  const todas = Object.values(store.listas).map(x => x.lista).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const sel = claveSel || todas[0]?.clave;
  const editable = puede('gestionar_listas');
  el.innerHTML = `<div class="barra" style="margin-bottom:10px"><label>Lista: <select class="sel" data-l>${todas.map(l => `<option value="${l.clave}"${l.clave === sel ? ' selected' : ''}>${esc(l.nombre)}</option>`).join('')}</select></label>
    ${editable ? '<button class="btn btn-sm" data-a="nueva">＋ Nueva lista</button>' : ''}<span class="flex"></span>
    <span class="nota">🔒 = valor usado por los cálculos: puede renombrarse, no eliminarse.</span></div><div data-g></div>`;
  el.querySelector('[data-l]').onchange = e => listas(el, e.target.value);
  el.querySelector('[data-a="nueva"]')?.addEventListener('click', async () => {
    const d = await pedirDatos({ titulo: 'Nueva lista', campos: [{ name: 'nombre', label: 'Nombre', required: true, full: true }, { name: 'descripcion', label: 'Descripción', full: true }],
      alGuardar: async v => {
        const clave = normalizar(v.nombre).replace(/[^a-z0-9]+/g, '_').slice(0, 40);
        await api.insert('listas', { area_id: store.area.id, clave, nombre: v.nombre, descripcion: v.descripcion, sistema: false });
        await cargarCatalogo();
      } });
    if (d) listas(el, normalizar(d.nombre).replace(/[^a-z0-9]+/g, '_').slice(0, 40));
  });
  const lista = store.listas[sel]?.lista;
  if (!lista) return;
  grilla?.destruir();
  grilla = crearGrilla(el.querySelector('[data-g]'), {
    id: 'lista_valores', tabla: 'lista_valores', titulo: lista.nombre, altura: 'calc(100vh - 330px)', puedeCrear: editable,
    columnas: [
      { field: '_p', title: '', tipo: 'texto', ancho: 36, calc: true, filtro: false, formato: (v, x) => x.protegido ? '🔒' : '' },
      { field: 'valor', title: 'Texto visible', tipo: 'texto', ancho: 320 },
      { field: 'codigo', title: 'Código', tipo: 'texto', ancho: 120, editable: x => !x.protegido },
      { field: 'descripcion', title: 'Descripción', tipo: 'texto', ancho: 240 },
      { field: 'color', title: 'Color', tipo: 'texto', ancho: 100, formato: v => v ? `<span class="badge" style="--c:${esc(v)}">${esc(v)}</span>` : '' },
      { field: 'orden', title: 'Orden', tipo: 'numero', ancho: 70, paso: 1 },
      { field: 'activo', title: 'Activo', tipo: 'casilla', ancho: 70, editable: x => !x.protegido },
      sel === 'ubicaciones' ? { field: '_cuenta', title: 'Cuenta para capacidad', tipo: 'casilla', ancho: 150,
        ayuda: 'Desmarque para días que no suman capacidad (vacaciones, feriado)' } : null,
    ],
    derivar: (x, cambios) => '_cuenta' in cambios ? { extra: { ...(x.extra || {}), cuenta_capacidad: !!cambios._cuenta } } : {},
    puedeEditarFila: () => editable,
    nuevaFila: () => ({ lista_id: lista.id, valor: '', activo: true, orden: (store.listas[sel].valores.length + 1) * 10, extra: {} }),
    listaParaCrear: x => !!(x.valor && x.valor.trim()),
    eliminar: async x => { if (x.protegido) throw new Error('Valor protegido: no se puede eliminar.'); await api.remove('lista_valores', x.id); },
    camposCalc: ['created_at', 'updated_at'],
    alGuardar: () => cargarCatalogo(),
  });
  const valores = await api.list('lista_valores', { eq: { lista_id: lista.id }, order: [['orden', true]] });
  await grilla.inicializar(valores.map(v => ({ ...v, _cuenta: v.extra?.cuenta_capacidad !== false })));
}

// ---------- Parámetros ----------
async function parametros(el) {
  const p = store.parametros;
  const editable = puede('gestionar_parametros');
  const form = html('<div class="tarjeta"></div>');
  el.append(form);
  const campos = [
    { name: 'meta_pac', label: 'Meta de PAC (%)', type: 'number', min: 0, max: 100, value: Math.round(p.meta_pac * 100) },
    { name: 'umbral_ambar', label: 'Semáforo ámbar desde (%)', type: 'number', min: 0, max: 100, value: Math.round(p.umbral_ambar * 100) },
    { name: 'semanas_lookahead', label: 'Semanas del Look Ahead', type: 'number', min: 1, max: 8, value: p.semanas_lookahead },
    { name: 'horas_dia', label: 'Horas disponibles por día (por defecto)', type: 'number', min: 1, max: 24, step: 0.5, value: p.horas_dia },
    { name: 'dias_laborables', label: 'Días laborables', type: 'multiselect', value: (p.dias_laborables || []).map(String),
      options: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => ({ value: String(i + 1), label: d })) },
    { name: 'cierre_dia', label: 'Día de cierre semanal', type: 'select', value: String(p.cierre?.dia || 5), options: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => ({ value: String(i + 1), label: d })) },
    { name: 'cierre_hora', label: 'Hora de cierre', type: 'time', value: p.cierre?.hora || '17:00' },
    { name: 'reunion_dia', label: 'Día de la reunión semanal', type: 'select', value: String(p.reunion?.dia || 5), options: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => ({ value: String(i + 1), label: d })) },
    { name: 'reunion_hora', label: 'Hora de la reunión', type: 'time', value: p.reunion?.hora || '08:00' },
    { name: 'cierre_automatico', label: 'Cierre automático', type: 'checkbox', texto: 'Cerrar automáticamente las semanas vencidas (los compromisos sin estado quedan "No reportado")', value: p.cierre_automatico },
    { name: 'alerta_dias', label: 'Días de aviso de restricciones por vencer', type: 'number', min: 0, max: 30, value: p.alerta_dias },
    { name: 'arrastre_alerta', label: 'Alertar arrastres desde (semanas)', type: 'number', min: 1, max: 10, value: p.arrastre_alerta },
    { name: 'version_app', label: 'Encabezado izquierdo de los PDF', value: p.version_app },
    { name: 'firma_pdf', label: 'Pie izquierdo de los PDF', value: p.firma_pdf },
    { name: 'separador', type: 'separador', label: 'Modo reunión — minutos por paso' },
    ...Object.entries(p.reunion_minutos || PARAMETROS_INICIALES.reunion_minutos).map(([k, v]) => ({ name: 'rm_' + k, label: k, type: 'number', min: 0, max: 120, value: v })),
    { name: 'separador2', type: 'separador', label: 'Reconocimientos del tablero (M-14)' },
    { name: 'rec_mejor', label: 'Mejor PAC del mes', type: 'checkbox', texto: 'Mostrar', value: p.reconocimientos?.mejor_pac },
    { name: 'rec_mejora', label: 'Mayor mejora del mes', type: 'checkbox', texto: 'Mostrar', value: p.reconocimientos?.mayor_mejora },
  ];
  const { crearFormulario } = await import('../ui/ui.js');
  const f = crearFormulario(campos);
  form.append(f);
  if (!editable) f.querySelectorAll('input,select').forEach(i => { i.disabled = true; });
  else {
    const b = html('<div style="margin-top:14px"><button class="btn btn-primario">Guardar parámetros</button></div>');
    form.append(b);
    b.querySelector('button').onclick = async () => {
      const d = f.leer();
      const valores = {
        meta_pac: (d.meta_pac ?? 80) / 100, umbral_ambar: (d.umbral_ambar ?? 60) / 100, semanas_lookahead: d.semanas_lookahead ?? 3,
        horas_dia: d.horas_dia ?? 8, dias_laborables: d.dias_laborables.map(Number).sort(), cierre: { dia: Number(d.cierre_dia), hora: d.cierre_hora || '17:00' },
        reunion: { dia: Number(d.reunion_dia), hora: d.reunion_hora || '08:00' }, cierre_automatico: d.cierre_automatico, alerta_dias: d.alerta_dias ?? 3,
        arrastre_alerta: d.arrastre_alerta ?? 2, version_app: d.version_app || 'LPS_GT V1.00.01', firma_pdf: d.firma_pdf || 'By EHCM',
        reunion_minutos: Object.fromEntries(Object.keys(p.reunion_minutos || PARAMETROS_INICIALES.reunion_minutos).map(k => [k, d['rm_' + k] ?? 10])),
        reconocimientos: { mejor_pac: d.rec_mejor, mayor_mejora: d.rec_mejora },
      };
      if (valores.umbral_ambar > valores.meta_pac) return error('El umbral ámbar no puede ser mayor que la meta.');
      try {
        await api.upsert('parametros', Object.entries(valores).map(([clave, valor]) => ({ area_id: store.area.id, clave, valor })), 'area_id,clave');
        await cargarCatalogo();
        ok('Parámetros guardados.');
      } catch (e) { error(mensajeError(e)); }
    };
  }
}

// ---------- Permisos ----------
async function permisos(el) {
  const editable = esAdmin();
  const roles = ['delegado', 'lider', 'consulta'];
  el.innerHTML = `<div class="tarjeta"><p class="nota">El administrador siempre tiene todos los permisos. Los límites del delegado (no quitar el rol al administrador principal, no eliminar usuarios, no rotar el delegado) no son modificables.${editable ? '' : ' Solo el administrador puede modificar esta matriz.'}</p>
    <table class="simple"><tr><th>Acción</th>${roles.map(r => `<th style="text-align:center">${esc(ROLES[r])}</th>`).join('')}</tr>
    ${ACCIONES.map(([a, t]) => `<tr><td>${esc(t)}</td>${roles.map(r => `<td style="text-align:center"><input type="checkbox" data-r="${r}" data-acc="${a}"
      ${store.permisos[r]?.[a] ? 'checked' : ''} ${editable ? '' : 'disabled'}></td>`).join('')}</tr>`).join('')}</table></div>`;
  el.addEventListener('change', async e => {
    const c = e.target.closest('[data-acc]');
    if (!c) return;
    try {
      await api.upsert('permisos', { area_id: store.area.id, rol: c.dataset.r, accion: c.dataset.acc, permitido: c.checked }, 'area_id,rol,accion');
      (store.permisos[c.dataset.r] ||= {})[c.dataset.acc] = c.checked;
      ok('Permiso actualizado. Aplica de inmediato.');
    } catch (err) { error(mensajeError(err)); c.checked = !c.checked; }
  });
}

// ---------- Columnas personalizadas ----------
async function columnas(el) {
  const editable = puede('crear_columnas');
  el.innerHTML = `<div class="aviso">Agregue columnas a las grillas sin programar. Para columnas de tipo "lista", primero cree la lista en <a href="#/config/listas">Listas</a>.</div><div data-g></div>`;
  const listasOps = Object.values(store.listas).map(x => ({ value: x.lista.id, label: x.lista.nombre }));
  grilla?.destruir();
  grilla = crearGrilla(el.querySelector('[data-g]'), {
    id: 'columnas', tabla: 'columnas_personalizadas', titulo: 'Columnas', altura: 'calc(100vh - 340px)', puedeCrear: editable,
    columnas: [
      { field: 'grilla', title: 'Grilla', tipo: 'lista', ancho: 160, opciones: [{ value: 'actividades', label: 'Actividades (Plan y Look Ahead)' }, { value: 'cartera', label: 'Cartera' }, { value: 'restricciones', label: 'Restricciones' }, { value: 'proyectos', label: 'Proyectos' }] },
      { field: 'nombre', title: 'Nombre de la columna', tipo: 'texto', ancho: 220 },
      { field: 'clave', title: 'Clave interna', tipo: 'texto', ancho: 150, editable: x => !x.id },
      { field: 'tipo', title: 'Tipo', tipo: 'lista', ancho: 110, opciones: ['texto', 'numero', 'fecha', 'lista', 'casilla'].map(v => ({ value: v, label: v })) },
      { field: 'lista_id', title: 'Lista (si es tipo lista)', tipo: 'lista', ancho: 220, opciones: [{ value: null, label: '—' }, ...listasOps] },
      { field: 'orden', title: 'Orden', tipo: 'numero', ancho: 70, paso: 1 },
      { field: 'activa', title: 'Activa', tipo: 'casilla', ancho: 70 },
    ],
    puedeEditarFila: () => editable,
    nuevaFila: () => ({ area_id: store.area.id, grilla: 'actividades', tipo: 'texto', activa: true, orden: 0, nombre: '', clave: '' }),
    derivar: (x, c) => ('nombre' in c && !x.id ? { clave: normalizar(c.nombre).replace(/[^a-z0-9]+/g, '_').slice(0, 30) } : {}),
    listaParaCrear: x => !!(x.nombre && x.clave),
    camposCalc: ['created_at', 'updated_at'],
    alGuardar: () => cargarCatalogo(),
  });
  await grilla.inicializar(store.columnas);
}

// ---------- Importación ----------
async function importarVista(el) {
  if (!puede('importar_historico')) { el.innerHTML = '<p class="nota">No tiene permiso para importar.</p>'; return; }
  el.innerHTML = `<div class="grid-2">
    <div class="tarjeta"><h2>Histórico de planificación (Excel)</h2>
      <p>Importa las hojas <b>Plan_semanal</b> (libro OT_LA) y <b>2_Cumplimiento_Plan_semanal</b> (libro LPS_OT): actividades, responsables, HH por día, cumplimiento y CNC.
      Las semanas pasadas quedan cerradas como histórico. Puede importar varios archivos, uno por uno; los duplicados se omiten.</p>
      <input type="file" accept=".xlsx,.xlsm,.xls" data-f="hist"><div data-res-hist style="margin-top:10px"></div></div>
    <div class="tarjeta"><h2>Catálogo de proyectos (Excel)</h2>
      <p>Lee hojas con columnas <b>Código</b> y <b>Proyecto</b> (y opcionalmente Nombre completo y Gerencia), como la hoja "Listas" del libro OT_LA.</p>
      <input type="file" accept=".xlsx,.xlsm,.xls" data-f="proy"><div data-res-proy style="margin-top:10px"></div></div></div>
    <p class="nota" style="margin-top:10px">Los archivos se procesan en su navegador y los datos van directo a la base de datos; no se guardan en el repositorio.</p>`;
  el.querySelector('[data-f="hist"]').onchange = e => e.target.files[0] && importarHistorico(e.target.files[0], el.querySelector('[data-res-hist]'));
  el.querySelector('[data-f="proy"]').onchange = e => e.target.files[0] && importarProyectos(e.target.files[0], el.querySelector('[data-res-proy]'));
}

async function importarHistorico(archivo, salida) {
  salida.innerHTML = '<div class="cargando"><span class="spinner"></span> Leyendo archivo…</div>';
  let a;
  try { a = analizar(await leerLibro(archivo)); } catch (e) { salida.innerHTML = `<div class="aviso error">No se pudo leer el archivo: ${esc(e.message)}</div>`; return; }
  if (!a.filas.length) { salida.innerHTML = '<div class="aviso warn">No se encontraron hojas de plan semanal con columna "ACTIVIDAD".</div>'; return; }
  const semanas = [...new Set(a.filas.map(f => f.semana))].sort();
  salida.innerHTML = `<div class="aviso ok">${a.filas.length} actividades · ${semanas.length} semana(s) (${fmtFecha(semanas[0])} – ${fmtFecha(semanas.at(-1))}) · ${a.responsables.length} responsables · ${a.proyectos.length} proyectos.</div>`;
  const usuarios = store.perfiles.filter(p => ['admin', 'delegado', 'lider'].includes(p.rol));
  const cuerpo = html(`<div>
    <h3>1. Responsables del Excel → usuarios</h3><p class="nota">Los que no se asignen se guardan solo como resumen de PAC histórico.</p>
    <table class="simple">${a.responsables.map(r => { const s = sugerirUsuario(r); return `<tr><td>${esc(r)}</td><td><select class="sel" data-u="${esc(r)}">
      <option value="">— Solo histórico de PAC —</option>${usuarios.map(u => `<option value="${u.id}"${u.id === s ? ' selected' : ''}>${esc(u.nombre)}</option>`).join('')}</select></td></tr>`; }).join('')}</table>
    <h3 style="margin-top:14px">2. Proyectos / procesos del Excel → catálogo</h3>
    <table class="simple">${a.proyectos.map(t => { const s = sugerirProyecto(t); return `<tr><td>${esc(t)}</td><td><select class="sel" data-p="${esc(t)}">
      <option value="nuevo"${s ? '' : ' selected'}>＋ Crear proyecto nuevo</option><option value="">— Sin proyecto —</option>
      ${store.proyectos.map(p => `<option value="${p.id}"${p.id === s ? ' selected' : ''}>${esc(p.codigo)} · ${esc(p.nombre_corto)}</option>`).join('')}</select></td></tr>`; }).join('')}</table>
    <label class="chk" style="margin-top:12px"><input type="checkbox" data-listas checked> Agregar a las listas las CNC, servicios y gerencias que no existan</label>
    <div data-prog class="nota" style="margin-top:8px"></div></div>`);
  modal({
    titulo: `Importar ${archivo.name}`, cuerpo, ancho: 820,
    botones: [{ texto: 'Cancelar' }, { texto: 'Importar', clase: 'btn-primario', accion: async () => {
      const mapa = { usuarios: {}, proyectos: {}, crearListas: cuerpo.querySelector('[data-listas]').checked };
      cuerpo.querySelectorAll('[data-u]').forEach(s => { mapa.usuarios[s.dataset.u] = s.value; });
      cuerpo.querySelectorAll('[data-p]').forEach(s => { mapa.proyectos[s.dataset.p] = s.value; });
      try {
        const r = await importar(a, mapa, t => { cuerpo.querySelector('[data-prog]').textContent = t; });
        salida.innerHTML = `<div class="aviso ok">Importación terminada: ${r.actividades} actividades, ${r.cierres} semanas cerradas, ${r.historico} registros de PAC histórico,
          ${r.proyectos} proyectos nuevos, ${r.valores} valores de lista nuevos${r.omitidas ? `, ${r.omitidas} duplicados omitidos` : ''}.</div>`;
        await cargarCatalogo();
      } catch (e) { error(mensajeError(e)); return false; }
    } }],
  });
}

export async function importarProyectos(archivo, salida) {
  if (!archivo) {
    const inp = html('<input type="file" accept=".xlsx,.xlsm,.xls">');
    inp.onchange = () => inp.files[0] && importarProyectos(inp.files[0], null);
    inp.click();
    return;
  }
  const filas = await leerProyectos(archivo);
  const nuevos = filas.filter(f => !store.proyectos.some(p => p.codigo === f.codigo || normalizar(p.nombre_corto) === normalizar(f.nombre_corto)));
  if (!nuevos.length) { (salida ? (salida.innerHTML = '<div class="aviso">No hay proyectos nuevos en el archivo.</div>') : toast('No hay proyectos nuevos en el archivo.', 'info')); return; }
  const cuerpo = html(`<div><p>${nuevos.length} proyecto(s) nuevos:</p><table class="simple"><tr><th></th><th>Código</th><th>Nombre</th><th>Gerencia</th></tr>
    ${nuevos.map((f, i) => `<tr><td><input type="checkbox" data-i="${i}" checked></td><td>${esc(f.codigo)}</td><td>${esc(f.nombre_corto)}</td><td>${esc(f.gerencia || '')}</td></tr>`).join('')}</table></div>`);
  modal({ titulo: 'Importar proyectos', cuerpo, ancho: 760, botones: [{ texto: 'Cancelar' }, { texto: 'Importar', clase: 'btn-primario', accion: async () => {
    const sel = [...cuerpo.querySelectorAll('[data-i]:checked')].map(c => nuevos[Number(c.dataset.i)]);
    try {
      await api.insert('proyectos', sel.map(f => ({ area_id: store.area.id, codigo: f.codigo, nombre_corto: f.nombre_corto, nombre_completo: f.nombre_completo,
        gerencia_id: f.gerencia ? gerenciaDe(f.gerencia) : null, estado: 'activo', tipo_id: valoresLista('tipos_proyecto')[0]?.id || null })));
      await cargarCatalogo();
      ok(`${sel.length} proyecto(s) importados.`);
      if (salida) salida.innerHTML = `<div class="aviso ok">${sel.length} proyecto(s) importados.</div>`;
    } catch (e) { error(mensajeError(e)); return false; }
  } }] });
}

// ---------- Respaldo ----------
async function respaldo(el) {
  el.innerHTML = `<div class="grid-2"><div class="tarjeta"><h2>Descargar respaldo</h2>
      <p>Descarga toda la información del área en un archivo JSON (para restaurar) o en Excel (para revisar). Además, ${modoDemo ? 'en producción ' : ''}se ejecuta un respaldo automático semanal hacia la carpeta privada de Google Drive configurada (ver README).</p>
      <div class="barra"><button class="btn btn-primario" data-a="json" ${esAdmin() ? '' : 'disabled'}>⬇ Respaldo completo (JSON)</button>
      <button class="btn" data-a="excel">⬇ Datos principales (Excel)</button></div>
      ${esAdmin() ? '' : '<p class="nota">El respaldo completo solo lo descarga el administrador.</p>'}</div>
    <div class="tarjeta"><h2>Buenas prácticas</h2><ul><li>Descargue un respaldo antes de importaciones grandes.</li>
      <li>Los archivos de respaldo contienen datos de la empresa: guárdelos en una carpeta privada, nunca en el repositorio público.</li></ul></div></div>`;
  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    try {
      if (a === 'json') {
        const datos = await api.rpc('exportar_respaldo');
        descargar(new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' }), `LPS-GT_respaldo_${new Date().toISOString().slice(0, 10)}.json`);
      }
      if (a === 'excel') {
        const wb = window.XLSX.utils.book_new();
        for (const t of ['proyectos', 'actividades', 'restricciones', 'cartera', 'cierres', 'acuerdos', 'pac_historico']) {
          const filas = await api.list(t, { eq: { area_id: store.area.id } });
          window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(filas.map(f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'object' && v ? JSON.stringify(v) : v])))), t.slice(0, 30));
        }
        window.XLSX.writeFile(wb, `LPS-GT_datos_${new Date().toISOString().slice(0, 10)}.xlsx`);
      }
    } catch (err) { error(mensajeError(err)); }
  });
}
function descargar(blob, nombreArchivo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombreArchivo; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Auditoría ----------
async function auditoria(el) {
  if (!puede('ver_auditoria')) { el.innerHTML = '<p class="nota">No tiene permiso para ver la auditoría.</p>'; return; }
  const regs = await api.list('auditoria', { eq: { area_id: store.area.id }, order: [['created_at', false]], limit: 300 });
  el.innerHTML = `<div class="tarjeta"><p class="nota">Últimos 300 cambios. El detalle de cada registro también se ve en su ventana de "Comentarios y enlaces".</p>
    <table class="simple"><tr><th>Fecha</th><th>Usuario</th><th>Tabla</th><th>Acción</th><th>Cambios</th></tr>
    ${regs.map(r => `<tr><td style="white-space:nowrap">${fmtFechaHora(r.created_at)}</td><td>${esc(nombre(r.usuario_id) || 'Sistema')}</td><td>${esc(r.tabla)}</td><td>${esc(r.accion)}</td>
      <td class="nota">${r.accion === 'update' ? Object.entries(r.cambios || {}).slice(0, 6).map(([k, v]) => `<b>${esc(k)}</b>: ${esc(JSON.stringify(v?.[0]))} → ${esc(JSON.stringify(v?.[1]))}`).join('<br>')
        : esc((r.cambios?.descripcion || r.cambios?.nombre_corto || r.cambios?.valor || '').toString().slice(0, 80))}</td></tr>`).join('')}</table></div>`;
}
