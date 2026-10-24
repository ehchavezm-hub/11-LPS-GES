// Plantillas: actividades recurrentes de cada líder (6.6) y plantillas de servicio (M-05).
import { api, mensajeError } from '../data/api.js';
import { store, esGestor, puede, lideres, opciones, opcionesProyectos, proyecto } from '../core/store.js';
import { esc, html } from '../core/util.js';
import { crearGrilla } from '../ui/grid.js';
import { pedirDatos, ok, error, confirmar } from '../ui/ui.js';
import { DIAS, DIAS_CORTOS } from '../core/util.js';

let grilla, estado;

export async function render(el) {
  estado = { modo: 'recurrente', duenio: store.usuario.id, plantilla: null, plantillas: [] };
  el.append(html(`<div>
    <div class="pagina-cab"><h1>Plantillas</h1>
      <div class="pestanas" style="min-width:380px"><button data-m="recurrente" class="activo">🔁 Actividades recurrentes</button><button data-m="servicio">🧩 Plantillas de servicio</button></div>
      <span data-sel></span><span class="flex"></span><span data-acc></span></div>
    <div class="aviso" data-ayuda></div>
    <div data-grilla></div></div>`));
  el.querySelector('.pestanas').addEventListener('click', e => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    estado.modo = m; estado.plantilla = null;
    el.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('activo', b.dataset.m === m));
    cargar();
  });
  await cargar();
}

export function destruir() { grilla?.destruir(); grilla = null; }

function puedeEditar() {
  if (estado.modo === 'recurrente') return estado.duenio === store.usuario.id || esGestor();
  return puede('gestionar_plantillas_servicio');
}

async function cargar() {
  const el = document.getElementById('contenido');
  const area = store.area.id;
  if (estado.modo === 'recurrente') {
    let pl = await api.list('plantillas', { eq: { area_id: area, tipo: 'recurrente', propietario_id: estado.duenio } });
    if (!pl.length && puedeEditar()) {
      try { pl = await api.insert('plantillas', { area_id: area, tipo: 'recurrente', nombre: 'Actividades recurrentes', propietario_id: estado.duenio }); }
      catch (e) { error(mensajeError(e)); }
    }
    estado.plantillas = pl;
    estado.plantilla = pl[0]?.id || null;
    el.querySelector('[data-ayuda]').innerHTML = 'Actividades que se repiten cada semana (reuniones, registro de HH, monitoreo de RFI…). En el Plan semanal use <b>🔁 Recurrentes</b> para agregarlas.';
    el.querySelector('[data-sel]').innerHTML = esGestor() ? `<select class="sel" data-duenio>${lideres().map(l => `<option value="${l.id}"${l.id === estado.duenio ? ' selected' : ''}>${esc(l.nombre)}</option>`).join('')}</select>` : '';
    el.querySelector('[data-duenio]')?.addEventListener('change', e => { estado.duenio = e.target.value; cargar(); });
    el.querySelector('[data-acc]').innerHTML = '';
  } else {
    estado.plantillas = await api.list('plantillas', { eq: { area_id: area, tipo: 'servicio' }, order: [['nombre', true]] });
    if (!estado.plantilla || !estado.plantillas.some(p => p.id === estado.plantilla)) estado.plantilla = estado.plantillas[0]?.id || null;
    el.querySelector('[data-ayuda]').innerHTML = 'Un servicio estándar con su paquete de actividades típicas y HH de referencia. En el Look Ahead use <b>🧩 Aplicar plantilla de servicio</b> para generar las actividades en un proyecto. "Semana +" indica en qué semana relativa va cada actividad.';
    el.querySelector('[data-sel]').innerHTML = `<select class="sel" data-pl>${estado.plantillas.map(p => `<option value="${p.id}"${p.id === estado.plantilla ? ' selected' : ''}>${esc(p.nombre)}${p.activa ? '' : ' (inactiva)'}</option>`).join('')}</select>`;
    el.querySelector('[data-pl]')?.addEventListener('change', e => { estado.plantilla = e.target.value; pintarGrilla(); });
    el.querySelector('[data-acc]').innerHTML = puedeEditar() ? '<button class="btn btn-sm btn-primario" data-nueva>＋ Nueva plantilla</button> <button class="btn btn-sm" data-ren>✏ Renombrar / activar</button>' : '';
    el.querySelector('[data-nueva]')?.addEventListener('click', nuevaPlantilla);
    el.querySelector('[data-ren]')?.addEventListener('click', renombrar);
  }
  await pintarGrilla();
}

async function pintarGrilla() {
  const cont = document.querySelector('#contenido [data-grilla]');
  grilla?.destruir();
  if (!estado.plantilla) { cont.innerHTML = '<p class="nota">Cree una plantilla para empezar.</p>'; return; }
  const items = await api.list('plantilla_items', { eq: { plantilla_id: estado.plantilla }, order: [['orden', true]] });
  grilla = crearGrilla(cont, {
    id: 'plantilla_' + estado.modo, tabla: 'plantilla_items', titulo: 'Plantilla', altura: 'calc(100vh - 320px)', puedeCrear: puedeEditar(),
    columnas: [
      estado.modo === 'servicio' ? { field: 'semana_offset', title: 'Semana +', tipo: 'numero', ancho: 85, paso: 1, ayuda: '0 = semana de inicio, 1 = la siguiente…' } : null,
      { field: 'proyecto_id', title: 'Proyecto', tipo: 'lista', ancho: 190, opciones: opcionesProyectos, visible: estado.modo === 'recurrente' },
      { field: 'gerencia_id', title: 'Gerencia', tipo: 'lista', ancho: 160, opciones: () => opciones('gerencias'), visible: estado.modo === 'recurrente' },
      { field: 'servicio_id', title: 'Servicio', tipo: 'lista', ancho: 200, opciones: () => opciones('servicios') },
      { field: 'descripcion', title: 'Actividad', tipo: 'texto', ancho: 320 },
      { field: 'resp2', title: 'Resp. 2', tipo: 'texto', ancho: 110 },
      ...DIAS.map((d, i) => ({ field: `hh_${d}`, title: DIAS_CORTOS[i], tipo: 'numero', ancho: 58, ocultarCero: true, total: true, vacioCero: true, filtro: false, visible: i < 5 || undefined })),
    ].filter(Boolean),
    puedeEditarFila: () => puedeEditar(),
    nuevaFila: () => ({ plantilla_id: estado.plantilla, descripcion: '', semana_offset: 0, orden: Date.now() % 100000,
      proyecto_id: estado.modo === 'recurrente' ? store.proyectoSel || null : null, hh_lu: 0, hh_ma: 0, hh_mi: 0, hh_ju: 0, hh_vi: 0, hh_sa: 0, hh_do: 0 }),
    listaParaCrear: i => !!(i.descripcion && i.descripcion.trim()),
    derivar: (i, c) => 'proyecto_id' in c && c.proyecto_id ? { gerencia_id: proyecto(c.proyecto_id)?.gerencia_id || i.gerencia_id } : {},
  });
  await grilla.inicializar(items);
}

async function nuevaPlantilla() {
  await pedirDatos({
    titulo: 'Nueva plantilla de servicio', texto: 'Crear',
    campos: [{ name: 'nombre', label: 'Nombre', required: true, full: true }, { name: 'servicio_id', label: 'Servicio', type: 'select', options: opciones('servicios') }],
    alGuardar: async d => {
      const [p] = await api.insert('plantillas', { ...d, area_id: store.area.id, tipo: 'servicio' });
      estado.plantilla = p.id; ok('Plantilla creada. Agregue sus actividades.');
    },
  });
  await cargar();
}

async function renombrar() {
  const p = estado.plantillas.find(x => x.id === estado.plantilla);
  if (!p) return;
  await pedirDatos({
    titulo: 'Plantilla', valores: p,
    campos: [{ name: 'nombre', label: 'Nombre', required: true, full: true }, { name: 'servicio_id', label: 'Servicio', type: 'select', options: opciones('servicios') },
      { name: 'activa', label: 'Estado', type: 'checkbox', texto: 'Activa (disponible para aplicar)' }],
    alGuardar: async d => { await api.update('plantillas', p.id, d); ok('Plantilla actualizada.'); },
  });
  await cargar();
}
