// Grilla tipo Excel (6.4 del alcance) basada en Tabulator:
// selección de rangos, copiar/pegar desde y hacia Excel, rellenar, deshacer/rehacer, insertar/duplicar/
// eliminar filas, agrupar con subtotales, filtrar, ordenar, mostrar/ocultar/mover/fijar columnas,
// vistas guardadas, guardado automático por celda y cambios de otros usuarios en tiempo real.
import { api, mensajeError } from '../data/api.js';
import { store, etiqueta, esGestor, puede, cargarCatalogo } from '../core/store.js';
import { esc, html, normalizar, parseFecha, fmtFecha, num, debounce } from '../core/util.js';
import { toast, error, confirmar, modal } from './ui.js';

const SOLO_LOCAL = k => k.startsWith('_');

/**
 * Editor de texto de varias líneas (como en Excel): la caja crece hacia abajo mientras se escribe,
 * Enter guarda, Alt+Enter o Shift+Enter agregan una línea, Esc cancela.
 */
function editorTextoLargo(cell, onRendered, success, cancel) {
  const caja = document.createElement('textarea');
  caja.value = cell.getValue() ?? '';
  caja.rows = 1;
  caja.style.cssText = 'display:block;width:100%;box-sizing:border-box;padding:4px;border:0;outline:none;resize:none;' +
    'white-space:pre-wrap;overflow:hidden;font:inherit;line-height:1.35;background:#fff;';
  const crecer = () => {
    caja.style.height = 'auto';
    caja.style.height = caja.scrollHeight + 'px';
    try { cell.checkHeight(); } catch { /* la fila se ajusta al guardar */ }
  };
  let listo = false;
  const guardar = () => { if (listo) return; listo = true; success(caja.value); };
  caja.addEventListener('input', crecer);
  caja.addEventListener('blur', guardar);
  caja.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.altKey || e.shiftKey)) {
      e.preventDefault(); e.stopPropagation();
      const i = caja.selectionStart, f = caja.selectionEnd;
      caja.setRangeText('\n', i, f, 'end');
      crecer();
    } else if (e.key === 'Enter') {
      e.preventDefault(); guardar();
    } else if (e.key === 'Escape') {
      listo = true; cancel();
    } else if (e.key !== 'Tab') {
      e.stopPropagation();   // flechas, Inicio, Fin… se mueven dentro del texto (Tab sigue pasando a la celda siguiente)
    }
  });
  onRendered(() => { crecer(); caja.focus({ preventScroll: true }); caja.setSelectionRange(caja.value.length, caja.value.length); });
  return caja;
}

// Globo de ayuda para las opciones de las listas desplegables (data-ayuda): aparece al pasar el mouse
if (!window.__lpsgtAyudaOpciones) {
  window.__lpsgtAyudaOpciones = true;
  let globo = null;
  const quitar = () => { globo?.remove(); globo = null; };
  document.addEventListener('mouseover', e => {
    const item = e.target.closest?.('[data-ayuda]');
    if (!item) return quitar();
    if (globo?.dataset.de === item.dataset.ayuda) return;
    quitar();
    globo = document.createElement('div');
    globo.className = 'globo-ayuda'; globo.dataset.de = item.dataset.ayuda; globo.textContent = item.dataset.ayuda;
    document.body.append(globo);
    const r = item.getBoundingClientRect(), g = globo.getBoundingClientRect();
    const izq = r.right + 8 + g.width < innerWidth ? r.right + 8 : Math.max(8, r.left - g.width - 8);
    globo.style.left = izq + 'px'; globo.style.top = Math.min(innerHeight - g.height - 8, Math.max(8, r.top)) + 'px';
  });
  document.addEventListener('mousedown', quitar, true);
  document.addEventListener('keydown', quitar, true);
}

// Tabulator enfoca celdas y la tabla al hacer clic; el navegador desplazaba entonces la página para mostrar el elemento
// enfocado y el segundo clic de un doble clic (o el clic derecho) caía en otra fila. Dentro de una grilla, enfocar
// nunca desplaza la página: Tabulator ya se encarga de mostrar la celda activa dentro de su propio scroll.
if (!HTMLElement.prototype.focus.__lpsgt) {
  const enfocar = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (opciones) {
    return enfocar.call(this, this.closest?.('.tabulator') ? { ...(opciones || {}), preventScroll: true } : opciones);
  };
  HTMLElement.prototype.focus.__lpsgt = true;
}

function opcionesDe(col, fila) {
  const o = typeof col.opciones === 'function' ? col.opciones(fila) : col.opciones;
  return o || [];
}
function etiquetaOpcion(col, v, fila) {
  if (v == null || v === '') return '';
  const o = opcionesDe(col, fila).find(x => String(x.value) === String(v));
  if (o) return o.label;
  // Valor que ya no está entre las opciones (p. ej. proyecto desactivado): se sigue mostrando su nombre
  const pr = store.proyectos.find(x => x.id === v);
  if (pr) return `${pr.codigo} · ${pr.nombre_corto}${pr.estado === 'cerrado' ? ' (desactivado)' : ''}`;
  return col.tipo === 'lista' ? etiqueta(v) : String(v);
}
/** Convierte el texto pegado o escrito al valor que guarda la columna. */
function convertir(col, texto, fila) {
  if (texto == null) return null;
  if (typeof texto !== 'string') return texto;
  const t = texto.trim();
  switch (col.tipo) {
    case 'numero': {
      if (t === '') return col.vacioCero ? 0 : null;
      const n = Number(t.replace(/\s/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, ''));
      return isNaN(n) ? (col.vacioCero ? 0 : null) : n;
    }
    case 'fecha': return t ? parseFecha(t) : null;
    case 'casilla': return ['1', 'si', 'sí', 'x', 'true', 'verdadero'].includes(normalizar(t));
    case 'lista': {
      if (!t) return null;
      const ops = opcionesDe(col, fila);
      const n = normalizar(t);
      // Coincide con el texto mostrado, o con el nombre completo o el código del valor (p. ej. "GOC" o "Gerencia de Obras Civiles")
      const valorDe = x => store.valores.get(x.value);
      const o = ops.find(x => x.value != null && (String(x.value) === t || normalizar(x.label) === n))
        || ops.find(x => x.value != null && valorDe(x) && (normalizar(valorDe(x).valor) === n || normalizar(valorDe(x).codigo || '') === n))
        || ops.find(x => x.value != null && normalizar(x.label).startsWith(n))
        || ops.find(x => x.value != null && n.length >= 3 && normalizar(x.label).includes(n));
      return o ? o.value : undefined;   // undefined = no reconocido
    }
    default: return t;
  }
}

/** Analiza texto copiado de Excel (TSV con comillas). */
export function parseTSV(texto) {
  const filas = [];
  let fila = [], campo = '', comillas = false;
  const s = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (comillas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"' && campo === '') comillas = true;
    else if (c === '\t') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  while (filas.length && filas[filas.length - 1].every(x => x === '')) filas.pop();
  return filas;
}

export function crearGrilla(contenedor, cfg) {
  const columnasCfg = cfg.columnas.filter(Boolean);
  const porCampo = new Map(columnasCfg.map(c => [c.field, c]));
  const servidor = new Map();              // id → copia de la fila tal como está guardada
  let guardando = false;
  let pendiente = false;

  const editableCampo = (fila, col) => {
    if (!col || col.calc || col.editable === false) return false;
    if (cfg.puedeEditarFila && !cfg.puedeEditarFila(fila)) return false;
    if (typeof col.editable === 'function') return col.editable(fila);
    return true;
  };

  // ---------- Barra de herramientas ----------
  const raiz = html(`<div class="grilla">
    <div class="grilla-barra">
      ${cfg.puedeCrear === false ? '' : '<button class="btn btn-primario btn-sm" data-a="nueva" title="Agregar fila (Ctrl+Enter)">＋ Fila</button>'}
      ${cfg.puedeCrear === false ? '' : '<button class="btn btn-sm" data-a="pegar" title="Pegar varias filas copiadas desde Excel">📋 Pegar filas de Excel</button>'}
      <button class="btn btn-sm" data-a="rellenar" title="Copia el valor de la primera celda seleccionada a las demás (Ctrl+D)">⬇ Rellenar</button>
      <button class="btn btn-sm" data-a="deshacer" title="Deshacer (Ctrl+Z)">↶</button>
      <button class="btn btn-sm" data-a="rehacer" title="Rehacer (Ctrl+Y)">↷</button>
      <span class="sep"></span>
      <label class="grilla-agrupar">Agrupar <select data-a="agrupar"><option value="">—</option>
        ${(cfg.agrupar || []).map(g => `<option value="${g.field}">${esc(g.label)}</option>`).join('')}</select></label>
      <button class="btn btn-sm" data-a="columnas" title="Mostrar, ocultar y fijar columnas">▥ Columnas</button>
      <button class="btn btn-sm" data-a="vistas" title="Vistas guardadas">👁 Vista</button>
      <input class="grilla-buscar" type="search" placeholder="Buscar…" aria-label="Buscar en la grilla">
      <span class="grilla-estado" aria-live="polite"></span>
      <span class="flex"></span>
      ${cfg.extraBarra || ''}
      <button class="btn btn-sm" data-a="excel" title="Exportar a Excel">⬇ Excel</button>
    </div>
    <div class="grilla-tabla"></div>
    <div class="grilla-ayuda">Doble clic o Enter para editar · Alt+Enter: nueva línea en Actividad · Selecciona un rango con el mouse o Shift+flechas · Ctrl+C / Ctrl+V con Excel · Supr borra · Clic derecho en una fila para más opciones, o en el título de Gerencia, Proyecto o Servicio para editar sus opciones</div>
  </div>`);
  contenedor.innerHTML = '';
  contenedor.append(raiz);
  const estadoEl = raiz.querySelector('.grilla-estado');
  const setEstado = t => { estadoEl.textContent = t; };

  // ---------- Acceso directo para editar las opciones de una columna de lista ----------
  // Clic derecho en el título de Gerencia, Proyecto, CET / Servicio o CNC lleva a donde se editan sus opciones.
  const DESTINOS = {
    gerencia_id: { lista: 'gerencias', texto: 'gerencias' }, servicio_id: { lista: 'servicios', texto: 'CET / Servicio' },
    cnc_id: { lista: 'cnc', texto: 'causas de no cumplimiento (CNC)' },
    fase_id: { lista: 'fases', texto: 'fases' }, pais_id: { lista: 'paises', texto: 'países' },
    proyecto_id: { ruta: '#/config/listas?lista=__proyectos', rutaSinConfig: '#/proyectos', texto: 'proyectos / procesos' },
  };
  function menuTitulo(c) {
    const d = c.editarEn || DESTINOS[c.field] || (c.lista ? { lista: c.lista, texto: c.title } : null);
    if (!d) return null;
    const permitido = d.ruta ? (puede('crear_proyecto') || puede('proponer_proyecto')) : puede('gestionar_listas');
    if (!permitido) return null;
    const ruta = (d.rutaSinConfig && !esGestor() ? d.rutaSinConfig : d.ruta) || `#/config/listas?lista=${encodeURIComponent(d.lista)}`;
    return [{ label: `✎ Agregar, editar o eliminar ${esc(d.texto)}`, action: () => { location.hash = ruta; } }];
  }

  // ---------- Valores pegados que no existen en una lista ----------
  // pend: [{ row, col, texto }]. Si la columna tiene una lista editable, se ofrece agregarlos y completar las celdas.
  const listaDe = c => (c.editarEn || DESTINOS[c.field] || (c.lista ? { lista: c.lista } : null))?.lista;
  async function agregarDesconocidos(pend) {
    if (!pend.length) return;
    const sinLista = pend.filter(x => !listaDe(x.col) || !store.listas[listaDe(x.col)]);
    const conLista = pend.filter(x => !sinLista.includes(x));
    if (sinLista.length) {
      toast(`${sinLista.length} valor(es) no coinciden con las opciones de ${[...new Set(sinLista.map(x => x.col.title))].join(', ')} y se omitieron.`, 'warn', 7000);
    }
    if (!conLista.length) return;
    const porLista = new Map();
    for (const x of conLista) {
      const clave = listaDe(x.col);
      if (!porLista.has(clave)) porLista.set(clave, { titulo: x.col.title, textos: new Set() });
      porLista.get(clave).textos.add(x.texto.trim());
    }
    const resumen = [...porLista.values()].map(g => `${g.titulo}: ${[...g.textos].join(', ')}`).join(' · ');
    if (!puede('gestionar_listas')) {
      toast(`Estos valores no existen en las listas y se omitieron (pida al administrador que los agregue): ${resumen}`, 'warn', 9000);
      return;
    }
    if (!await confirmar(`Estos valores no existen en las listas: ${resumen}. ¿Agregarlos a las listas y completar las celdas?`,
      { titulo: 'Valores nuevos en las listas', texto: 'Agregar a las listas' })) return;
    try {
      for (const [clave, g] of porLista) {
        const lista = store.listas[clave].lista;
        let orden = Math.max(0, ...store.listas[clave].valores.map(v => Number(v.orden) || 0));
        for (const texto of g.textos) {
          orden += 10;
          await api.insert('lista_valores', { lista_id: lista.id, valor: texto, codigo: clave === 'gerencias' && texto.length <= 12 ? texto : null,
            orden, activo: true, extra: {} });
        }
      }
      await cargarCatalogo();
      for (const x of conLista) {
        const v = convertir(x.col, x.texto, x.row.getData());
        if (v === undefined) continue;
        const der = cfg.derivar ? cfg.derivar({ ...x.row.getData(), [x.col.field]: v }, { [x.col.field]: v }) : {};
        x.row.update({ [x.col.field]: v, ...der });
      }
      toast(`Se agregaron ${[...porLista.values()].reduce((n, g) => n + g.textos.size, 0)} valor(es) a las listas.`, 'ok');
      programarGuardado();
    } catch (e) { error(mensajeError(e)); }
  }

  // ---------- Columnas Tabulator ----------
  function colTabulator(c) {
    // c.valor(fila): columna cuyo valor se toma de otro campo (p. ej. CET = el servicio de la fila)
    const val = (v, fila) => (c.valor ? c.valor(fila) : v);
    const def = {
      field: c.field, title: c.title, width: c.ancho, minWidth: c.minAncho || 40, frozen: !!c.fijo,
      visible: c.visible !== false, headerSort: c.ordenable !== false, hozAlign: c.align || (c.tipo === 'numero' ? 'right' : 'left'),
      headerTooltip: c.ayuda || c.title, resizable: true,
      editable: cell => editableCampo(cell.getRow().getData(), c),
      headerFilter: c.filtro === false ? false : 'input',
      headerFilterPlaceholder: '',
      headerFilterFunc: (term, valor, fila) => {
        const t = normalizar(term);
        const texto = c.tipo === 'lista' ? etiquetaOpcion(c, val(valor, fila), fila) : c.tipo === 'fecha' ? fmtFecha(valor) : String((c.exportar ? c.exportar(valor, fila) : valor) ?? '');
        return normalizar(texto).includes(t);
      },
      accessorClipboard: (v, fila) => c.tipo === 'lista' ? etiquetaOpcion(c, val(v, fila), fila) : c.tipo === 'fecha' ? fmtFecha(v) : c.tipo === 'casilla' ? (v ? 'Sí' : '') : c.exportar ? c.exportar(v, fila) : v,
      accessorDownload: (v, fila) => c.tipo === 'lista' ? etiquetaOpcion(c, val(v, fila), fila) : c.tipo === 'casilla' ? (v ? 'Sí' : 'No') : c.exportar ? c.exportar(v, fila) : v,
    };
    const menuT = menuTitulo(c);
    if (menuT) { def.headerContextMenu = menuT; def.headerTooltip = `${c.ayuda || c.title} · Clic derecho para editar sus opciones`; }
    if (c.total) def.bottomCalc = 'sum', def.bottomCalcFormatter = cell => num(cell.getValue(), 1);
    const clases = [c.clase, c.calc ? 'celda-calc' : ''].filter(Boolean).join(' ');
    if (clases) def.cssClass = clases;
    switch (c.tipo) {
      case 'texto': def.editor = 'input'; break;
      case 'textoLargo': def.editor = editorTextoLargo; def.formatter = 'textarea'; def.variableHeight = true; break;
      case 'numero': def.editor = 'number'; def.editorParams = { step: c.paso || 0.5, min: c.min ?? 0, selectContents: true }; break;
      case 'fecha': def.editor = 'date'; def.editorParams = { format: 'yyyy-MM-dd' }; break;
      case 'casilla': def.editor = 'tickCross'; def.formatter = 'tickCross'; def.hozAlign = 'center'; break;
      case 'lista':
        def.editor = 'list';
        def.editorParams = cell => {
          // opcionesEdicion: lo que se puede elegir (p. ej. solo 3 estados); opciones: lo que se puede mostrar
          const ops = c.opcionesEdicion ? c.opcionesEdicion(cell.getRow().getData()) : opcionesDe(c, cell.getRow().getData());
          const ayudas = new Map(ops.filter(o => o.ayuda).map(o => [String(o.value), o.ayuda]));
          return {
            values: ops.map(o => ({ label: o.label, value: o.value })),
            autocomplete: true, allowEmpty: true, listOnEmpty: true, clearable: true, freetext: false,
            filterFunc: (term, label) => normalizar(label).includes(normalizar(term)),
            // Significado de cada opción: aparece al pasar el mouse
            itemFormatter: (label, value, item, el) => {
              const a = ayudas.get(String(value));
              if (a && el) { el.dataset.ayuda = a; el.removeAttribute('title'); }
              return esc(label ?? '');
            },
          };
        };

        break;
      default: break;
    }
    if (c.formato) def.formatter = cell => c.formato(cell.getValue(), cell.getRow().getData(), cell);
    else if (c.tipo === 'lista') def.formatter = cell => {
      const v = val(cell.getValue(), cell.getRow().getData());
      const t = etiquetaOpcion(c, v, cell.getRow().getData());
      const op = v != null ? opcionesDe(c, cell.getRow().getData()).find(o => o.value === v) : null;
      // La celda también muestra el significado de su valor al pasar el mouse
      const ayuda = op?.ayuda ? ` data-ayuda="${esc(op.ayuda)}"` : '';
      if (c.colorear && op?.color) return `<span class="badge" style="--c:${op.color}"${ayuda}>${esc(t)}</span>`;
      return ayuda ? `<span${ayuda}>${esc(t)}</span>` : esc(t);
    };
    else if (c.tipo === 'fecha') def.formatter = cell => fmtFecha(cell.getValue());
    else if (c.tipo === 'numero') def.formatter = cell => {
      const v = cell.getValue();
      return v === 0 && c.ocultarCero ? '' : num(v, 2);
    };
    if (c.tipo === 'lista' || c.formato) def.sorter = (a, b, ra, rb) => {
      const x = normalizar(c.tipo === 'lista' ? etiquetaOpcion(c, val(a, ra.getData()), ra.getData()) : c.exportar ? c.exportar(a, ra.getData()) : a);
      const y = normalizar(c.tipo === 'lista' ? etiquetaOpcion(c, val(b, rb.getData()), rb.getData()) : c.exportar ? c.exportar(b, rb.getData()) : b);
      return x > y ? 1 : x < y ? -1 : 0;
    };
    if (c.click) def.cellClick = (e, cell) => c.click(cell.getRow().getData(), e, cell);
    return def;
  }

  // ---------- Pegado (rango) ----------
  function parserPegado(texto) {
    const datos = parseTSV(texto);
    const rango = tabla.getRanges?.()[0];
    if (!datos.length || !rango) return false;
    const celdas = rango.getCells?.() || [];
    const primera = celdas[0]?.[0] || celdas[0];
    const colInicio = primera?.getColumn ? primera.getColumn() : null;
    const visibles = tabla.getColumns().filter(c => c.isVisible());
    const idx = Math.max(0, visibles.indexOf(colInicio));
    const filasTabla = tabla.getRows('active');
    const filaInicio = primera?.getRow ? filasTabla.indexOf(primera.getRow()) : 0;
    return { datos, columnas: visibles.slice(idx), filaInicio: Math.max(0, filaInicio) };
  }

  function accionPegado(p) {
    if (!p) return [];
    const filasTabla = tabla.getRows('active');
    let omitidas = 0, nuevas = 0;
    const tocadas = [];
    const sobrantes = [];
    const pend = [];
    p.datos.forEach((valores, i) => {
      const fila = filasTabla[p.filaInicio + i];
      if (fila) aplicarValores(fila, p.columnas, valores);
      else if (cfg.puedeCrear !== false) sobrantes.push(valores);
    });
    if (sobrantes.length) {
      (async () => {
        for (const valores of sobrantes) {
          const fila = await tabla.addRow({ ...(cfg.nuevaFila?.() || {}), _nueva: true }, false);
          aplicarValores(fila, p.columnas, valores, true);
          nuevas++;
        }
        toast(`${nuevas} fila(s) nuevas agregadas desde el portapapeles.`, 'ok');
        programarGuardado();
        await agregarDesconocidos(pend);
      })();
    }
    function aplicarValores(fila, columnas, valores, esNueva = false) {
      const datos = fila.getData();
      const cambios = {};
      valores.forEach((texto, j) => {
        const colT = columnas[j];
        if (!colT) return;
        if (esNueva && !String(texto ?? '').trim()) return;   // fila nueva: una celda vacía no borra el valor por defecto
        const col = porCampo.get(colT.getField());
        if (!editableCampo(datos, col)) { omitidas++; return; }
        const v = convertir(col, texto, { ...datos, ...cambios });
        if (v === undefined) { pend.push({ row: fila, col, texto }); return; }
        cambios[col.field] = v;
      });
      if (Object.keys(cambios).length) {
        const derivados = cfg.derivar ? cfg.derivar({ ...datos, ...cambios }, cambios) : {};
        fila.update({ ...cambios, ...derivados });
        tocadas.push(fila);
      }
    }
    if (omitidas) toast(`${omitidas} celda(s) no editables se omitieron.`, 'warn');
    if (!sobrantes.length) agregarDesconocidos(pend);
    programarGuardado();
    return tocadas;
  }

  // ---------- Tabulator ----------
  const tabla = new window.Tabulator(raiz.querySelector('.grilla-tabla'), {
    data: [],
    index: 'id',
    // alturaAuto: la grilla crece con sus filas, sin barra vertical propia (varias grillas en una página).
    // Un alto máximo hacía que las barras horizontal y vertical se activaran por turnos y la grilla "saltara".
    ...(cfg.alturaAuto ? {} : { height: cfg.altura || 'calc(100vh - 260px)' }),
    layout: 'fitDataStretch',
    columnDefaults: { headerHozAlign: 'left', tooltip: false },
    columns: columnasCfg.map(colTabulator),
    selectableRange: 1,
    // Al redibujarse (p. ej. otra grilla de la página cambia de alto) Tabulator recreaba la selección y tomaba el foco,
    // interrumpiendo la edición en otra grilla. El foco solo cambia cuando el usuario hace clic.
    selectableRangeAutoFocus: false,
    groupUpdateOnCellEdit: true,   // al cambiar el campo agrupado (p. ej. la semana) la fila pasa a su grupo
    selectableRangeColumns: true,
    selectableRangeRows: true,
    selectableRangeClearCells: true,
    selectableRangeFill: true,
    editTriggerEvent: 'dblclick',
    clipboard: true,
    clipboardCopyStyled: false,
    clipboardCopyConfig: { rowHeaders: false, columnHeaders: false, columnCalcs: false, rowGroups: false },
    clipboardCopyRowRange: 'range',
    clipboardPasteParser: parserPegado,
    clipboardPasteAction: accionPegado,
    history: true,
    movableColumns: true,
    headerSortClickElement: 'icon',
    rowHeader: { resizable: false, frozen: true, width: 36, hozAlign: 'center', formatter: 'rownum', cssClass: 'col-numero', headerSort: false },
    placeholder: cfg.vacio || 'Sin filas. Use "＋ Fila" o pegue desde Excel.',
    groupStartOpen: true,
    groupHeader: (valor, cantidad, datos) => {
      const g = porCampo.get(tabla.options.groupBy);
      const t = g ? (g.tipo === 'lista' ? etiquetaOpcion(g, valor, datos[0]) : g.tipo === 'fecha' ? fmtFecha(valor) : g.formatoGrupo ? g.formatoGrupo(valor) : valor) : valor;
      const hh = datos.reduce((s, d) => s + (Number(d.hh_total) || 0), 0);
      return `${esc(t || '(vacío)')} <span class="grupo-info">${cantidad} fila(s)${hh ? ` · ${num(hh)} HH` : ''}</span>`;
    },
    rowFormatter: row => {
      const d = row.getData();
      const el = row.getElement();
      el.classList.toggle('fila-ajena', !!cfg.puedeEditarFila && !cfg.puedeEditarFila(d));
      el.classList.toggle('fila-nueva', !d.id);
      if (cfg.claseFila) {
        el.dataset.clase && el.classList.remove(...el.dataset.clase.split(' ').filter(Boolean));
        const cl = cfg.claseFila(d) || '';
        el.dataset.clase = cl;
        if (cl) el.classList.add(...cl.split(' ').filter(Boolean));
      }
    },
    rowContextMenu: (e, row) => menuFila(row),
    locale: 'es',
    langs: { es: { data: { loading: 'Cargando', error: 'Error' }, groups: { item: 'fila', items: 'filas' },
      pagination: {}, headerFilters: { default: 'filtrar…' } } },
  });

  // ---------- Guardado automático ----------
  const camposDB = fila => Object.fromEntries(Object.entries(fila).filter(([k]) => !SOLO_LOCAL(k) && !porCampo.get(k)?.calc && !(cfg.camposCalc || []).includes(k)));

  function diferencias(fila) {
    const prev = servidor.get(fila.id);
    if (!prev) return null;
    const dif = {};
    for (const [k, v] of Object.entries(camposDB(fila))) {
      if (JSON.stringify(v ?? null) !== JSON.stringify(prev[k] ?? null)) dif[k] = v;
    }
    return dif;
  }

  const programarGuardado = debounce(async () => { await guardar(); guardarBorradores(); }, 350);

  // Filas nuevas aún sin datos (no se guardan en la base hasta tener contenido): se conservan al recargar
  // la grilla o la página, por usuario, grilla y pantalla (p. ej. cada semana del Plan).
  const claveBorradores = () => (cfg.id && store.usuario ? `lpsgt-borradores:${store.usuario.id}:${cfg.id}:${location.hash.split('&')[0]}` : null);
  const limpiarFila = d => Object.fromEntries(Object.entries(d).filter(([k]) => !['_guardando', '_nueva'].includes(k)));
  function filasSinGuardar() { return tabla.getRows().map(r => r.getData()).filter(d => !d.id); }
  function guardarBorradores() {
    const k = claveBorradores(); if (!k) return;
    try {
      const filas = filasSinGuardar().map(limpiarFila);
      if (filas.length) localStorage.setItem(k, JSON.stringify(filas)); else localStorage.removeItem(k);
    } catch { /* sin almacenamiento local */ }
  }
  function leerBorradores() {
    try { return JSON.parse(localStorage.getItem(claveBorradores()) || '[]'); } catch { return []; }
  }

  async function guardar() {
    if (guardando) { pendiente = true; return; }
    guardando = true;
    try {
      const filas = tabla.getRows();
      let n = 0;
      for (const row of filas) {
        const d = row.getData();
        // Valores no permitidos (p. ej. relleno sobre celdas de otro): se revierten
        if (d.id && servidor.has(d.id)) {
          const dif = diferencias(d);
          if (!dif || !Object.keys(dif).length) continue;
          const prev = servidor.get(d.id);
          const revertir = {};
          for (const k of Object.keys(dif)) {
            const col = porCampo.get(k) || porCampo.get(k.split('.')[0]);
            if (k !== 'extra' && col && !editableCampo(prev, col)) revertir[k] = prev[k];
          }
          if (Object.keys(revertir).length) { row.update(revertir); for (const k of Object.keys(revertir)) delete dif[k]; }
          if (!Object.keys(dif).length) continue;
          for (const [k, v] of Object.entries(dif)) if (v === '' && porCampo.get(k)?.tipo !== 'texto' && porCampo.get(k)?.tipo !== 'textoLargo') dif[k] = null;
          setEstado('Guardando…');
          try {
            const res = await (cfg.actualizar ? cfg.actualizar(d, dif) : api.update(cfg.tabla, d.id, dif));
            servidor.set(res.id, structuredClone(res));
            row.update(res);
            n++;
          } catch (e) {
            error(mensajeError(e));
            const prevFila = servidor.get(d.id);
            row.update(prevFila);
          }
        } else if (!d.id && !d._guardando) {
          if (cfg.listaParaCrear && !cfg.listaParaCrear(d)) continue;
          row.update({ _guardando: true });
          setEstado('Guardando…');
          try {
            const datos = camposDB(d);
            delete datos.id;
            const [res] = await (cfg.crear ? cfg.crear(datos) : api.insert(cfg.tabla, datos));
            servidor.set(res.id, structuredClone(res));
            row.update({ ...res, _guardando: false, _nueva: false });
            row.reformat();   // columnas calculadas que dependen del id (p. ej. "Ficha ›")
            n++;
          } catch (e) {
            error(mensajeError(e));
            row.update({ _guardando: false });
          }
        }
      }
      setEstado(n ? '✓ Guardado' : '');
      if (n) cfg.alGuardar?.();
      setTimeout(() => { if (estadoEl.textContent === '✓ Guardado') setEstado(''); }, 2500);
    } finally {
      guardando = false;
      if (pendiente) { pendiente = false; programarGuardado(); }
    }
  }

  tabla.on('cellEdited', cell => {
    const col = porCampo.get(cell.getField());
    const fila = cell.getRow();
    let v = cell.getValue();
    if (col?.tipo === 'numero' && (v === '' || v == null) && col.vacioCero) { v = 0; cell.setValue(0, false); }
    if (cfg.derivar) {
      const der = cfg.derivar(fila.getData(), { [cell.getField()]: v });
      if (der && Object.keys(der).length) fila.update(der);
    }
    fila.reformat();
    programarGuardado();
    cfg.alEditar?.(fila.getData(), cell.getField());
  });
  tabla.on('dataChanged', () => programarGuardado());
  tabla.on('historyUndo', () => programarGuardado());
  tabla.on('historyRedo', () => programarGuardado());

  // ---------- Teclado: escribir para editar, Enter, Ctrl+D, Ctrl+Enter ----------
  raiz.querySelector('.grilla-tabla').addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select,.tabulator-edit-list')) return;
    const rango = tabla.getRanges()[0];
    const celda = rango?.getCells?.()?.[0]?.[0];
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); rellenar(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); nuevaFila(); return; }
    if (!celda) return;
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); celda.edit(true); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const col = porCampo.get(celda.getField());
      if (!editableCampo(celda.getRow().getData(), col) || col.tipo === 'casilla') return;
      e.preventDefault();
      celda.edit(true);
      setTimeout(() => {
        const inp = celda.getElement().querySelector('input,textarea');
        if (inp) { inp.value = e.key; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      }, 0);
    }
  });

  // ---------- Acciones ----------
  function filasSeleccionadas() {
    const set = new Set();
    for (const r of tabla.getRanges()) for (const row of r.getRows()) set.add(row);
    return [...set];
  }

  async function nuevaFila(posicion, referencia) {
    if (cfg.puedeCrear === false) return;
    const base = { ...(cfg.nuevaFila?.() || {}), _nueva: true };
    if (referencia) {
      const ref = referencia.getData();
      base.orden = (Number(ref.orden) || 0) + (posicion === 'arriba' ? -0.5 : 0.5);
    }
    const row = await tabla.addRow(base, posicion === 'arriba', referencia);
    tabla.scrollToRow(row, 'center', false).catch(() => {});
    const primera = (cfg.campoInicial && porCampo.get(cfg.campoInicial)) ||
      columnasCfg.find(c => editableCampo(row.getData(), c) && c.visible !== false && (c.tipo === 'texto' || c.tipo === 'textoLargo'));
    if (primera) setTimeout(() => {
      const celda = row.getCell(primera.field);
      if (!celda) return;
      tabla.addRange?.(celda, celda);
      celda.edit(true);
    }, 80);
    programarGuardado();
  }

  async function duplicar(rows) {
    for (const r of rows) {
      const d = camposDB(r.getData());
      delete d.id; delete d.created_at; delete d.updated_at;
      await tabla.addRow({ ...d, ...(cfg.alDuplicar?.(d) || {}), _nueva: true }, false, r);
    }
    programarGuardado();
  }

  async function eliminar(rows) {
    const propias = rows.filter(r => !cfg.puedeEditarFila || cfg.puedeEditarFila(r.getData()));
    if (!propias.length) return toast('No tiene permiso para eliminar esas filas.', 'warn');
    if (!await confirmar(`¿Eliminar ${propias.length} fila(s)? Esta acción no se puede deshacer.`, { texto: 'Eliminar', peligro: true })) return;
    for (const r of propias) {
      const d = r.getData();
      try {
        // cfg.eliminar puede devolver false: no se eliminó (p. ej. se desactivó en su lugar) y la fila se conserva
        if (d.id && (await (cfg.eliminar ? cfg.eliminar(d) : api.remove(cfg.tabla, d.id))) === false) continue;
        servidor.delete(d.id);
        await r.delete();
      } catch (e) { error(mensajeError(e)); }
    }
    // Tras borrar, Tabulator deja la vista descuadrada una fila (el siguiente clic caía en la fila de abajo): se reconstruye
    tabla.redraw(true);
    cfg.alGuardar?.();
  }

  function rellenar() {
    const rango = tabla.getRanges()[0];
    if (!rango) return;
    const filas = rango.getRows();
    const cols = rango.getColumns();
    if (filas.length < 2) return toast('Seleccione un rango de varias filas para rellenar hacia abajo.', 'info');
    for (const colT of cols) {
      const col = porCampo.get(colT.getField());
      const valor = filas[0].getData()[colT.getField()];
      for (const f of filas.slice(1)) {
        if (editableCampo(f.getData(), col)) {
          const der = cfg.derivar ? cfg.derivar({ ...f.getData(), [col.field]: valor }, { [col.field]: valor }) : {};
          f.update({ [col.field]: valor, ...der });
        }
      }
    }
    programarGuardado();
  }

  function menuFila(row) {
    const items = [
      { label: '＋ Insertar fila arriba', action: () => nuevaFila('arriba', row), disabled: cfg.puedeCrear === false },
      { label: '＋ Insertar fila abajo', action: () => nuevaFila('abajo', row), disabled: cfg.puedeCrear === false },
      { label: '⧉ Duplicar fila(s)', action: () => duplicar(filasSeleccionadas().length ? filasSeleccionadas() : [row]), disabled: cfg.puedeCrear === false },
      { label: '⬇ Rellenar hacia abajo', action: rellenar },
      ...(cfg.menuFila ? cfg.menuFila(row.getData(), row) : []),
      { separator: true },
      { label: '🗑 Eliminar fila(s)', action: () => eliminar(filasSeleccionadas().length > 1 ? filasSeleccionadas() : [row]) },
    ];
    return items;
  }

  function dialogoPegar() {
    const cols = tabla.getColumns().filter(c => c.isVisible() && porCampo.has(c.getField()) && !porCampo.get(c.getField()).calc);
    // Columna de la grilla que corresponde a un título del Excel (por nombre, campo o alias)
    const colPorTitulo = t => cols.find(c => normalizar(c.getDefinition().title) === t || normalizar(c.getField()) === t ||
      (porCampo.get(c.getField())?.alias || []).some(x => normalizar(x) === t)) || null;
    const esCabecera = fila => fila.filter(t => colPorTitulo(normalizar(t))).length >= 2;
    const cuerpo = html(`<div>
      <p>Copie la tabla en Excel (Ctrl+C) y péguela aquí (Ctrl+V). <b>Incluya la fila de títulos</b> para que cada columna vaya a su lugar
        aunque el orden sea distinto. Sin títulos, las columnas se asignan en este orden:</p>
      <p class="nota">${cols.map(c => esc(c.getDefinition().title)).join(' · ')}</p>
      <label class="chk"><input type="checkbox" data-cab> La primera fila tiene títulos (se detecta sola)</label>
      <textarea rows="10" class="pegar-area" placeholder="Pegue aquí…"></textarea>
      <div class="pegar-previa nota"></div></div>`);
    const area = cuerpo.querySelector('textarea');
    const previa = cuerpo.querySelector('.pegar-previa');
    const chkCab = cuerpo.querySelector('[data-cab]');
    area.addEventListener('input', () => {
      const d = parseTSV(area.value);
      if (!d.length) { previa.textContent = ''; return; }
      if (esCabecera(d[0])) chkCab.checked = true;
      const cab = chkCab.checked ? d[0] : null;
      const asignacion = cab
        ? cab.map(t => { const c = colPorTitulo(normalizar(t)); return `${t || '(vacío)'} → ${c ? c.getDefinition().title : 'se ignora'}`; }).join(' · ')
        : d[0].map((_, j) => `col. ${j + 1} → ${cols[j] ? cols[j].getDefinition().title : 'se ignora'}`).join(' · ');
      previa.innerHTML = `<b>${d.length - (cab ? 1 : 0)} fila(s)</b> × ${d[0].length} columna(s). ${esc(asignacion)}`;
    });
    chkCab.addEventListener('change', () => area.dispatchEvent(new Event('input')));
    modal({
      titulo: 'Pegar filas desde Excel', cuerpo, ancho: 820,
      botones: [{ texto: 'Cancelar' }, {
        texto: 'Agregar filas', clase: 'btn-primario', accion: async () => {
          let datos = parseTSV(area.value);
          if (!datos.length) { toast('No hay datos para pegar.', 'warn'); return false; }
          let columnas = cols;
          if (chkCab.checked || esCabecera(datos[0])) columnas = datos.shift().map(t => colPorTitulo(normalizar(t)));
          const pend = [];
          for (const valores of datos) {
            if (!valores.some(v => String(v ?? '').trim())) continue;   // filas vacías
            const fila = await tabla.addRow({ ...(cfg.nuevaFila?.() || {}), _nueva: true }, false);
            const d = fila.getData();
            const cambios = {};
            valores.forEach((texto, j) => {
              const colT = columnas[j];
              if (!colT || !String(texto ?? '').trim()) return;   // celda vacía: se conserva el valor por defecto
              const col = porCampo.get(colT.getField());
              if (!editableCampo({ ...d, ...cambios }, col)) return;
              const v = convertir(col, texto, { ...d, ...cambios });
              if (v === undefined) pend.push({ row: fila, col, texto });
              else cambios[col.field] = v;
            });
            const der = cfg.derivar ? cfg.derivar({ ...d, ...cambios }, cambios) : {};
            fila.update({ ...cambios, ...der });
          }
          programarGuardado();
          toast(`${datos.length} fila(s) agregadas.`, 'ok');
          setTimeout(() => agregarDesconocidos(pend), 50);
        },
      }],
    });
  }

  function dialogoColumnas() {
    const cols = tabla.getColumns().filter(c => c.getField() && porCampo.has(c.getField()));
    const cuerpo = html(`<div class="lista-columnas">${cols.map(c => {
      const d = c.getDefinition();
      return `<div class="fila-col"><label class="chk"><input type="checkbox" data-f="${esc(c.getField())}" ${c.isVisible() ? 'checked' : ''}> ${esc(d.title)}</label>
        <label class="chk peque"><input type="checkbox" data-fijo="${esc(c.getField())}" ${d.frozen ? 'checked' : ''}> fijar</label></div>`;
    }).join('')}</div><p class="nota">También puede arrastrar los títulos de columna para cambiar el orden y sus bordes para cambiar el ancho.</p>`);
    modal({
      titulo: 'Columnas visibles', cuerpo, ancho: 460, botones: [{ texto: 'Cerrar', clase: 'btn-primario', accion: () => {
        for (const inp of cuerpo.querySelectorAll('[data-f]')) {
          const c = tabla.getColumn(inp.dataset.f);
          if (inp.checked) c.show(); else c.hide();
        }
        for (const inp of cuerpo.querySelectorAll('[data-fijo]')) {
          const c = tabla.getColumn(inp.dataset.fijo);
          if (!!c.getDefinition().frozen !== inp.checked) c.updateDefinition({ frozen: inp.checked });
        }
        guardarVistaAuto();
      } }],
    });
  }

  // ---------- Vistas guardadas ----------
  let vistas = [];
  const usuarioId = () => store.usuario?.id;
  function estadoVista() {
    return {
      // Solo orden, ancho, visibilidad y fijación: el título lo pone la pantalla (p. ej. "L 26/10" cambia con la semana)
      columnas: tabla.getColumnLayout().map(({ title, ...c }) => c),
      orden: tabla.getSorters().map(s => ({ column: s.field, dir: s.dir })),
      agrupar: tabla.options.groupBy || '',
    };
  }
  function aplicarVista(cfgVista) {
    if (!cfgVista) return;
    try {
      if (cfgVista.columnas?.length) {
        // Las vistas guardadas antes también traían el título: se descarta y se usa el actual
        // anchoFijo: el ancho lo define la columna (p. ej. días L–D angostos), no la vista guardada
        const conocidas = cfgVista.columnas.filter(c => porCampo.has(c.field))
          .map(({ title, ...c }) => (porCampo.get(c.field).anchoFijo ? (({ width, ...r }) => r)(c) : c));
        // Columnas que no estaban en la vista guardada (p. ej. agregadas en una versión nueva): van en su lugar
        // original, antes de la columna que las sigue, y no al final
        const disposicion = [...conocidas];
        columnasCfg.forEach((c, i) => {
          // Columnas con posición fija: se reubican aunque la vista guardada las tenga en otro lugar
          if (c.posicionFija) { const j = disposicion.findIndex(k => k.field === c.field); if (j >= 0) disposicion.splice(j, 1); }
          if (disposicion.some(k => k.field === c.field)) return;
          const siguiente = columnasCfg.slice(i + 1).find(x => disposicion.some(k => k.field === x.field));
          const pos = siguiente ? disposicion.findIndex(k => k.field === siguiente.field) : disposicion.length;
          disposicion.splice(pos, 0, { field: c.field });
        });
        tabla.setColumnLayout(disposicion);
      }
      if (cfgVista.orden) tabla.setSort(cfgVista.orden);
      raiz.querySelector('[data-a="agrupar"]').value = cfgVista.agrupar || '';
      tabla.setGroupBy(cfgVista.agrupar || false);
    } catch (e) { console.warn('Vista no aplicable', e); }
  }
  const guardarVistaAuto = debounce(async () => {
    if (!store.area || !cfg.id) return;
    const datos = { area_id: store.area.id, usuario_id: usuarioId(), grilla: cfg.id, nombre: '__auto__', config: estadoVista() };
    const ex = vistas.find(v => v.nombre === '__auto__' && v.usuario_id === usuarioId());
    try {
      if (ex) Object.assign(ex, await api.update('vistas', ex.id, { config: datos.config }));
      else vistas.push(...await api.insert('vistas', datos));
    } catch { /* la vista personal no es crítica */ }
  }, 1200);
  async function cargarVistas() {
    if (!cfg.id || !store.area) return;
    try { vistas = await api.list('vistas', { eq: { grilla: cfg.id, area_id: store.area.id } }); } catch { vistas = []; }
    const auto = vistas.find(v => v.nombre === '__auto__' && v.usuario_id === usuarioId());
    const estandar = vistas.find(v => v.nombre === '__estandar__' && !v.usuario_id);
    aplicarVista((auto || estandar)?.config);
  }
  function menuVistas(boton) {
    const propias = vistas.filter(v => v.usuario_id === usuarioId() && !v.nombre.startsWith('__'));
    const estandar = vistas.find(v => v.nombre === '__estandar__' && !v.usuario_id);
    const cuerpo = html(`<div class="menu-vistas">
      ${estandar ? '<button class="btn btn-sm" data-v="estandar">Vista estándar del equipo</button>' : ''}
      ${propias.map(v => `<div class="fila-vista"><button class="btn btn-sm" data-id="${v.id}">${esc(v.nombre)}</button>
        <button class="btn-icono" data-borrar="${v.id}" title="Eliminar vista">✕</button></div>`).join('')}
      <button class="btn btn-sm" data-v="restablecer">Restablecer columnas</button>
      <hr><button class="btn btn-sm btn-primario" data-v="guardar">Guardar vista actual como…</button>
      ${esGestor() ? '<button class="btn btn-sm" data-v="estandarizar">Usar la vista actual como estándar del equipo</button>' : ''}
    </div>`);
    const m = modal({ titulo: 'Vistas de la grilla', cuerpo, ancho: 420 });
    cuerpo.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.id) { aplicarVista(vistas.find(v => v.id === b.dataset.id)?.config); guardarVistaAuto(); m.cerrar(); }
      if (b.dataset.borrar) { await api.remove('vistas', b.dataset.borrar); vistas = vistas.filter(v => v.id !== b.dataset.borrar); m.cerrar(); }
      if (b.dataset.v === 'estandar') { aplicarVista(estandar.config); guardarVistaAuto(); m.cerrar(); }
      if (b.dataset.v === 'restablecer') {
        tabla.setColumns(columnasCfg.map(colTabulator)); tabla.clearSort(); tabla.setGroupBy(false);
        raiz.querySelector('[data-a="agrupar"]').value = '';
        guardarVistaAuto(); m.cerrar();
      }
      if (b.dataset.v === 'guardar') {
        const nombre = prompt('Nombre de la vista:');
        if (!nombre) return;
        vistas.push(...await api.insert('vistas', { area_id: store.area.id, usuario_id: usuarioId(), grilla: cfg.id, nombre, config: estadoVista() }));
        toast('Vista guardada.', 'ok'); m.cerrar();
      }
      if (b.dataset.v === 'estandarizar') {
        try {
          if (estandar) await api.update('vistas', estandar.id, { config: estadoVista() });
          else vistas.push(...await api.insert('vistas', { area_id: store.area.id, usuario_id: null, grilla: cfg.id, nombre: '__estandar__', config: estadoVista() }));
          toast('Vista estándar del equipo actualizada.', 'ok');
        } catch (err) { error(mensajeError(err)); }
        m.cerrar();
      }
    });
  }

  for (const ev of ['columnMoved', 'columnResized', 'columnVisibilityChanged', 'dataSorted']) tabla.on(ev, () => guardarVistaAuto());

  // ---------- Eventos de barra ----------
  raiz.querySelector('.grilla-barra').addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'nueva') nuevaFila();
    if (a === 'pegar') dialogoPegar();
    if (a === 'rellenar') rellenar();
    if (a === 'deshacer') tabla.undo();
    if (a === 'rehacer') tabla.redo();
    if (a === 'columnas') dialogoColumnas();
    if (a === 'vistas') menuVistas(e.target);
    if (a === 'excel') exportarExcel();
  });
  raiz.querySelector('[data-a="agrupar"]').addEventListener('change', e => {
    tabla.setGroupBy(e.target.value || false);
    guardarVistaAuto();
  });
  raiz.querySelector('.grilla-buscar').addEventListener('input', debounce(e => {
    const t = normalizar(e.target.value);
    if (!t) return tabla.clearFilter();
    tabla.setFilter(d => columnasCfg.some(c => {
      const v = d[c.field.split('.')[0]];
      const texto = c.tipo === 'lista' ? etiquetaOpcion(c, d[c.field], d) : c.field.includes('.') ? d.extra?.[c.field.split('.')[1]] : v;
      return normalizar(texto).includes(t);
    }));
  }, 250));

  function exportarExcel() {
    if (cfg.exportar === false) return;
    const nombre = (cfg.nombreArchivo?.() || cfg.id || 'datos') + '.xlsx';
    tabla.download('xlsx', nombre, { sheetName: (cfg.titulo || 'Datos').slice(0, 30) });
  }

  // ---------- API pública ----------
  let listo = false;
  const alListo = new Promise(r => tabla.on('tableBuilt', () => { listo = true; r(); }));
  const api_ = {
    tabla,
    listo: alListo,
    async setDatos(filas, { borradores = false } = {}) {
      await alListo;
      // Las filas nuevas que aún no se guardan (sin datos) no se pierden al recargar la grilla
      const pendientes = borradores ? leerBorradores() : filasSinGuardar().map(limpiarFila);
      servidor.clear();
      for (const f of filas) if (f.id) servidor.set(f.id, structuredClone(f));
      await tabla.replaceData([...filas, ...pendientes.map(d => ({ ...d, _nueva: true }))]);
      tabla.clearHistory();
    },
    async inicializar(filas) {
      await alListo;
      await cargarVistas();
      await api_.setDatos(filas, { borradores: true });
    },
    /** Cambio recibido en tiempo real (de otro usuario o de otra pestaña). */
    aplicarRemoto({ tipo, fila, anterior }, pertenece) {
      if (!listo) return;
      const id = fila?.id || anterior?.id;
      const existente = id && tabla.getRow(id);
      if (tipo === 'DELETE' || (fila && pertenece && !pertenece(fila))) {
        if (existente) { existente.delete(); servidor.delete(id); }
        return;
      }
      if (!fila) return;
      const previo = servidor.get(fila.id);
      if (previo && previo.updated_at === fila.updated_at) return;   // eco de un cambio propio
      servidor.set(fila.id, structuredClone(fila));
      if (existente) {
        const editando = existente.getCells().some(c => c.getElement().classList.contains('tabulator-editing'));
        if (!editando) existente.update(fila);
      } else if (tipo === 'INSERT') {
        const local = tabla.getRows().find(r => !r.getData().id && r.getData()._guardando);
        if (!local) tabla.addRow(fila);
      }
      cfg.alCambioRemoto?.();
    },
    filas() { return tabla.getData(); },
    refrescar() { tabla.getRows().forEach(r => r.reformat()); },
    /** Filtro propio de la vista (además de los filtros de cada columna); fn(datosFila) → true para mostrar. */
    filtrar(fn) { if (fn) tabla.setFilter(d => fn(d)); else tabla.clearFilter(); },
    refrescarFiltro() { tabla.refreshFilter(); },
    actualizarFila(id, datos) {
      const r = tabla.getRow(id);
      if (r) { r.update(datos); servidor.set(id, structuredClone(r.getData())); }
    },
    guardarAhora: guardar,
    destruir() { try { tabla.destroy(); } catch { /* ya destruida */ } },
  };
  return api_;
}
