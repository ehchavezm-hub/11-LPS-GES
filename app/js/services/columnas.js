// Definición de columnas de la grilla de actividades (Plan semanal y Look Ahead) + columnas personalizadas.
import { store, opciones, valoresLista, opcionesLideres, opcionesProyectos, opcionesEstado, colorEstado, proyecto, servicioDeProyecto, proyectoDeServicio, servicioSirve, esContenedor, opcionesServicio, esGestor, textoEstado, param } from '../core/store.js';
import { DIAS, DIAS_CORTOS, sumarDias, fmtCorto, esc, etiquetaSemana } from '../core/util.js';
import { semanasPendiente } from './indicadores.js';

export function columnasPersonalizadas(grilla) {
  return store.columnas.filter(c => c.grilla === grilla && c.activa).map(c => ({
    field: `extra.${c.clave}`, title: c.nombre, tipo: c.tipo === 'lista' ? 'lista' : c.tipo === 'numero' ? 'numero' : c.tipo === 'fecha' ? 'fecha' : c.tipo === 'casilla' ? 'casilla' : 'texto',
    opciones: c.tipo === 'lista' ? () => {
      const l = Object.values(store.listas).find(x => x.lista.id === c.lista_id);
      return [{ value: null, label: '—' }, ...(l?.valores || []).filter(v => v.activo).map(v => ({ value: v.id, label: v.valor }))];
    } : undefined,
    ancho: 130, personalizada: true,
  }));
}

/**
 * modo: 'plan' | 'lookahead'
 * semana: lunes de referencia (en plan) para poner fechas en las columnas de días
 * extras: { restricciones: Map(actId → n), colaboracion: Map(actId → n), abrir(row) }
 */
export function columnasActividad({ modo, semana, semanasLA = [], extras = {} }) {
  const dias = DIAS.map((d, i) => ({
    field: `hh_${d}`, alias: [d, DIAS_CORTOS[i], `hh ${d}`, ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'][i]], title: DIAS_CORTOS[i],
    tipo: 'numero', ancho: 46, minAncho: 38, anchoFijo: true, align: 'center', ocultarCero: true, total: true, vacioCero: true, paso: 0.5, filtro: false,
    visibilidadFija: true,   // la visibilidad la decide el parámetro de días (no una vista guardada)
    visible: i < 5 || !!param('trabajo_fin_semana') || (param('dias_laborables') || []).map(Number).includes(i + 1), ayuda: `HH del ${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][i]}${modo === 'plan' && semana ? ` ${fmtCorto(sumarDias(semana, i))}` : ''}`,
  }));
  const cols = [
    modo === 'lookahead' ? {
      field: 'semana', title: 'Semana', tipo: 'lista', ancho: 175,
      opciones: () => semanasLA.map(s => ({ value: s, label: etiquetaSemana(s) })),
      formatoGrupo: s => etiquetaSemana(s),
    } : null,
    // Plan semanal: la semana de cada compromiso, solo lectura (para moverlo de semana: clic derecho → Mover a la semana siguiente)
    modo === 'plan' ? { field: 'semana', title: 'Semana', tipo: 'texto', ancho: 160, posicionFija: true, editable: false, filtro: false,
      formato: v => esc(v ? etiquetaSemana(v) : ''), exportar: v => (v ? etiquetaSemana(v) : '') } : null,
    { field: 'responsable_id', title: 'Resp. 1', tipo: 'lista', ancho: 130, opciones: opcionesLideres, editable: () => esGestor(),
      ayuda: 'Responsable (el PAC se atribuye a esta persona)' },
    { field: 'gerencia_id', title: 'Gerencia', tipo: 'lista', ancho: 95, opciones: () => opciones('gerencias').map(o => ({ ...o, label: o.value ? (store.valores.get(o.value)?.codigo || o.label) : o.label })) },
    { field: 'proyecto_id', title: 'Proyecto / Proceso', tipo: 'lista', ancho: 190, opciones: opcionesProyectos },
    // CET y Servicio van juntos (como nombre y apellido): son el mismo valor de la lista "CET / Servicio" visto por su código
    // o por su nombre. Elegir o pegar uno completa el otro.
    { field: '_cet', title: 'CET', tipo: 'lista', ancho: 100, posicionFija: true, ayuda: 'CET del servicio (al elegirlo se completa el Servicio)',
      valor: d => d.servicio_id ?? null,
      opciones: () => [{ value: null, label: '—' }, ...valoresLista('servicios', { inactivos: true }).map(v => ({ value: v.id, label: v.codigo || '' }))],
      // Al editar: los CET del proyecto de la fila (y los que no tienen proyecto)
      opcionesEdicion: d => opcionesServicio({ proyectoId: d?.proyecto_id }).filter(o => o.value == null || store.valores.get(o.value)?.codigo) },
    { field: 'servicio_id', title: 'Servicio', tipo: 'lista', ancho: 180, opciones: () => opciones('servicios'),
      opcionesEdicion: d => opcionesServicio({ proyectoId: d?.proyecto_id, etiqueta: v => v.valor }) },
    { field: 'descripcion', title: 'Actividad', tipo: 'textoLargo', ancho: 300, minAncho: 160 },   // varias líneas: la fila crece
    ...dias,
    { field: 'hh_total', title: 'HH', tipo: 'numero', ancho: 64, calc: true, total: true, filtro: false },
  ];
  if (modo === 'plan') {
    cols.push(
      { field: 'tipo', title: 'Tipo', tipo: 'lista', ancho: 115, opciones: () => opcionesEstado('tipos_actividad') },
      { field: 'estado', title: 'Estado', tipo: 'lista', ancho: 125, colorear: true,
        opciones: () => opcionesEstado('estados_compromiso').map(o => ({ ...o, color: colorEstado('estados_compromiso', o.value) })) },
      { field: 'cnc_id', title: 'CNC', tipo: 'lista', ancho: 190, opciones: () => opciones('cnc'),
        ayuda: 'Causa de no cumplimiento (obligatoria si no se completó)',
        formato: (v, d) => v ? esc(store.valores.get(v)?.valor || '') : (d.estado === 'no_completado' ? '<span class="celda-alerta">Falta CNC</span>' : '') },
      { field: 'hh_real', title: 'HH real', tipo: 'numero', ancho: 70, total: true, ayuda: 'Horas reales al cierre (M-03)' },
    );
  } else {
    cols.push(
      { field: 'estado_la', title: 'Estado LA', tipo: 'lista', ancho: 135, colorear: true,
        opciones: () => opcionesEstado('estados_la').map(o => ({ ...o, color: colorEstado('estados_la', o.value) })) },
    );
  }
  cols.push(
    { field: '_restr', title: '🚧', tipo: 'texto', ancho: 48, calc: true, filtro: false, ordenable: false, ayuda: 'Restricciones pendientes',
      formato: (v, d) => {
        const n = extras.restricciones?.get(d.id) || 0;
        return d.id ? `<button class="mini-btn" title="Ver / agregar restricciones">${n ? `<b style="color:var(--rojo)">${n}</b>` : '＋'}</button>` : '';
      },
      click: (d, e) => { if (d.id && e.target.closest('button')) extras.abrirRestricciones?.(d); } },
    { field: '_colab', title: '💬', tipo: 'texto', ancho: 48, calc: true, filtro: false, ordenable: false, ayuda: 'Comentarios y enlaces',
      formato: (v, d) => {
        const n = extras.colaboracion?.get(d.id) || 0;
        return d.id ? `<button class="mini-btn" title="Comentarios y enlaces">${n || '＋'}</button>` : '';
      },
      click: (d, e) => { if (d.id && e.target.closest('button')) extras.abrirDetalle?.(d); } },
    { field: 'comentario', title: 'Comentario', tipo: 'textoLargo', ancho: 220 },   // varias líneas, como Actividad
  );
  if (modo === 'plan') {
    cols.push({ field: '_pend', title: 'Sem. pend.', tipo: 'numero', ancho: 70, calc: true, ayuda: 'Semanas que el compromiso lleva pendiente (RN-06)',
      formato: (v, d) => { const n = semanasPendiente(d); return n ? `<span class="celda-alerta">${n}</span>` : ''; } });
  }
  cols.push(
    { field: 'origen', title: 'Origen', tipo: 'texto', ancho: 95, calc: true, visible: false,
      formato: v => ({ manual: 'Manual', cartera: 'Cartera', recurrente: 'Recurrente', plantilla: 'Plantilla', solicitud: 'Solicitud', arrastre: 'Arrastre', importacion: 'Importación' }[v] || v || '') },
    ...columnasPersonalizadas('actividades'),
  );
  return cols.filter(Boolean);
}

/**
 * Proyecto, Gerencia y CET / Servicio van juntos (Plan, Look Ahead, Plantillas y Cartera):
 * al elegir un proyecto se completan su gerencia y su CET / Servicio (si la lista tiene uno solo asociado);
 * al elegir un CET o un Servicio se completa el otro y, si la fila no tiene proyecto, el proyecto de ese servicio.
 */
export function derivarProyectoServicio(fila, cambios) {
  const d = {};
  if ('proyecto_id' in cambios && cambios.proyecto_id) {
    const p = proyecto(cambios.proyecto_id);
    if (p?.gerencia_id) d.gerencia_id = p.gerencia_id;
    const serv = servicioDeProyecto(p);
    // s17: si la fila aún no tiene CET/Servicio y el proyecto tiene uno solo, se auto-rellena.
    // No se reemplaza ni limpia un servicio ya elegido: cualquier CET/Servicio es válido para cualquier proyecto.
    if (serv && !fila.servicio_id) d.servicio_id = serv;
  }
  if ('_cet' in cambios) d.servicio_id = cambios._cet ?? null;            // CET elegido → su Servicio
  // Servicio de un proyecto elegido en una fila sin proyecto: se completan el proyecto y su gerencia
  const servElegido = '_cet' in cambios ? cambios._cet : 'servicio_id' in cambios ? cambios.servicio_id : undefined;
  if (servElegido && !fila.proyecto_id && !('proyecto_id' in cambios)) {
    const p = proyecto(proyectoDeServicio(servElegido));
    // Si el servicio es de un proyecto con sub-proyectos, el LPS va en un sub-proyecto: no se elige el proyecto por la persona
    if (p && ['activo', 'propuesto'].includes(p.estado) && !esContenedor(p)) { d.proyecto_id = p.id; if (p.gerencia_id) d.gerencia_id = p.gerencia_id; }
  }
  if ('servicio_id' in d || 'servicio_id' in cambios) d._cet = d.servicio_id ?? cambios.servicio_id ?? null;
  return d;
}

/** Reglas de la fila de actividad: HH total, proyecto ↔ servicio, Estado LA ↔ compromiso y CNC. */
export function derivarActividad(fila, cambios) {
  const d = derivarProyectoServicio(fila, cambios);
  if (Object.keys(cambios).some(k => k.startsWith('hh_') && k !== 'hh_real' && k !== 'hh_total')) {
    d.hh_total = DIAS.reduce((s, x) => s + (Number(fila[`hh_${x}`]) || 0), 0);
  }
  // Estado LA elegido a mano: "Trasladada al plan" compromete la actividad (aparece en el Plan semanal);
  // volver a Pendiente, Con restricción o Lista la saca del Plan. Cancelada no cambia el compromiso.
  if ('estado_la' in cambios) {
    if (cambios.estado_la === 'trasladada') { d.comprometida = true; d.tipo = fila.tipo || 'programada'; }
    else if (['pendiente', 'con_restriccion', 'lista'].includes(cambios.estado_la) && fila.comprometida) d.comprometida = false;
  }
  if ('estado' in cambios && cambios.estado !== 'no_completado' && fila.cnc_id) d.cnc_id = null;
  if ('estado' in cambios && cambios.estado === 'completado' && fila.hh_real == null && fila.hh_total) d.hh_real = fila.hh_total;
  return d;
}

export const CAMPOS_CALC_ACT = ['hh_total', 'created_at', 'updated_at', 'created_by'];
export { textoEstado };
