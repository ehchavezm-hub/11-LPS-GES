// Configuración (6.1, 6.2): usuarios y roles, listas configurables, parámetros, matriz de permisos,
// columnas personalizadas, importación desde Excel, respaldo y auditoría.
import { imprimirPDF, nombreArchivo } from '../services/pdf.js';
import { leerDemo as leerDatosDemo } from '../services/traer-demo.js';
const hayDatosDemo = () => !!leerDatosDemo();
import { medir } from '../core/monitoreo.js';
import { api, mensajeError, modoDemo } from '../data/api.js';
import { store, on, cargarCatalogo, esAdmin, esSuperadmin, esGestor, puede, opciones, opcionesProyectos, nombre, valoresLista, configLookAhead, diasReunion, diasCierre } from '../core/store.js';
import { ACCIONES, ROLES, PARAMETROS_INICIALES, PLANIFICADORES, COLOR_ROL, GRUPOS_LISTAS, grupoDeLista, LISTAS_RETIRADAS } from '../data/catalogos.js';
import { esc, html, fmtFechaHora, fmtFecha, normalizar, libExcel } from '../core/util.js';
import { ir } from '../core/router.js';
import { crearGrilla } from '../ui/grid.js';
import { ok, error, confirmar, pedirDatos, modal, badge, toast } from '../ui/ui.js';
import { leerLibro, analizar, importar, sugerirUsuario, sugerirProyecto } from '../services/importar.js';

const SECCIONES = [
  ['empresas', '🏢 Empresas', () => !!store.usuario?.es_plataforma],   // solo el administrador de la plataforma
  ['usuarios', '👤 Usuarios y roles'], ['listas', '📋 Listas'], ['parametros', '🔧 Parámetros'], ['permisos', '🔐 Permisos'],
  ['columnas', '▥ Columnas personalizadas'], ['importar', '⬆ Importar Excel'], ['respaldo', '💾 Respaldo'], ['auditoria', '🕑 Auditoría'],
];
let grilla;

export async function render(el, { seccion, query }) {
  desmontarOrg?.();
  grilla?.destruir(); grilla = null;
  catalogoProyectos?.destruir(); catalogoProyectos = null;
  dejarCatalogo?.();
  dejarCatalogo = on('catalogo', () => grilla?.refrescar());
  el.innerHTML = '';
  el.append(html(`<div><div class="pagina-cab"><h1>Configuración</h1></div>
    <div class="pestanas" style="margin-bottom:14px;flex-wrap:wrap">${SECCIONES.filter(([, , si]) => !si || si()).map(([k, t]) => `<button data-s="${k}" class="${k === seccion ? 'activo' : ''}">${t}</button>`).join('')}</div>
    <div data-sec></div></div>`));
  el.querySelector('.pestanas').addEventListener('click', e => { const s = e.target.closest('[data-s]')?.dataset.s; if (s) ir('#/config/' + s); });
  const cont = el.querySelector('[data-sec]');
  const f = { empresas: store.usuario?.es_plataforma ? empresas : null, usuarios, listas, parametros, permisos, columnas, importar: importarVista, respaldo, auditoria }[seccion];
  if (f) await f(cont, query?.get('lista') || undefined); else cont.textContent = 'Sección no encontrada.';
}
/** Secciones de Configuración que también se muestran dentro de la consola de Administración. */
export async function seccionConfig(nombre, el) {
  destruir();
  const f = { empresas: store.usuario?.es_plataforma ? empresas : null, usuarios, listas, parametros, permisos, respaldo, auditoria }[nombre];
  if (f) await f(el); else el.textContent = 'Sección no disponible.';
}
export function destruir() { desmontarOrg?.(); grilla?.destruir(); grilla = null; dejarCatalogo?.(); dejarCatalogo = null; catalogoProyectos?.destruir(); catalogoProyectos = null; }
let catalogoProyectos = null;
let desmontarOrg = null;        // organigrama del equipo (Usuarios y roles)   // módulo de Proyectos cuando se muestra dentro de Listas
// Cuando cambian los proyectos o las listas (aquí, en otra pestaña u otro usuario), la grilla abierta se actualiza sola
let dejarCatalogo = null;
