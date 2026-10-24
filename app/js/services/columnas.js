// Definición de columnas de la grilla de actividades (Plan semanal y Look Ahead) + columnas personalizadas.
import { store, opciones, opcionesLideres, opcionesProyectos, opcionesEstado, colorEstado, proyecto, esGestor, textoEstado } from '../core/store.js';
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
    field: `hh_${d}`, alias: [d, DIAS_CORTOS[i], `hh ${d}`, ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'][i]], title: modo === 'plan' && semana ? `${DIAS_CORTOS[i]} ${fmtCorto(sumarDias(semana, i))}` : DIAS_CORTOS[i],
    tipo: 'numero', ancho: 74, ocultarCero: true, total: true, vacioCero: true, paso: 0.5, filtro: false,
    visible: i < 5 || undefined, ayuda: `HH del ${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][i]}`,
  }));
  const cols = [
    modo === 'lookahead' ? {
      field: 'semana', title: 'Semana', tipo: 'lista', ancho: 175,
      opciones: () => semanasLA.map(s => ({ value: s, label: etiquetaSemana(s) })),
      formatoGrupo: s => etiquetaSemana(s),
    } : null,
    { field: 'responsable_id', title: 'Resp. 1', tipo: 'lista', ancho: 130, opciones: opcionesLideres, editable: () => esGestor(),
      ayuda: 'Responsable (el PAC se atribuye a esta persona)' },
    { field: 'resp2', title: 'Resp. 2', tipo: 'texto', ancho: 110, ayuda: 'Persona de apoyo (solo dato)' },
    { field: 'gerencia_id', title: 'Gerencia', tipo: 'lista', ancho: 95, opciones: () => opciones('gerencias').map(o => ({ ...o, label: o.value ? (store.valores.get(o.value)?.codigo || o.label) : o.label })) },
    { field: 'proyecto_id', title: 'Proyecto / Proceso', tipo: 'lista', ancho: 190, opciones: opcionesProyectos },
    { field: 'cet_id', title: 'CET', tipo: 'lista', ancho: 85, opciones: () => opciones('cet'), visible: false },
    { field: 'servicio_id', title: 'Servicio / Entregable', tipo: 'lista', ancho: 180, opciones: () => opciones('servicios') },
    { field: 'descripcion', title: 'Actividad', tipo: 'texto', ancho: 300, minAncho: 160 },
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
    { field: 'comentario', title: 'Comentario', tipo: 'texto', ancho: 200 },
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

/** Al elegir un proyecto se completan gerencia y CET si están vacíos; si se completa, se limpia la CNC. */
export function derivarActividad(fila, cambios) {
  const d = {};
  if (Object.keys(cambios).some(k => k.startsWith('hh_') && k !== 'hh_real' && k !== 'hh_total')) {
    d.hh_total = DIAS.reduce((s, x) => s + (Number(fila[`hh_${x}`]) || 0), 0);
  }
  if ('proyecto_id' in cambios && cambios.proyecto_id) {
    const p = proyecto(cambios.proyecto_id);
    if (p?.gerencia_id) d.gerencia_id = p.gerencia_id;
    if (p?.cet_id && !fila.cet_id) d.cet_id = p.cet_id;
  }
  if ('estado' in cambios && cambios.estado !== 'no_completado' && fila.cnc_id) d.cnc_id = null;
  if ('estado' in cambios && cambios.estado === 'completado' && fila.hh_real == null && fila.hh_total) d.hh_real = fila.hh_total;
  return d;
}

export const CAMPOS_CALC_ACT = ['hh_total', 'created_at', 'updated_at', 'created_by'];
export { textoEstado };
