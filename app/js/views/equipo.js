// Equipo y capacidad (6.12): ubicación diaria (reemplaza la hoja "Sitios") y capacidad semanal (M-02).
import { api, mensajeError } from '../data/api.js';
import { store, equipo, esGestor, lideres, valoresLista, horasDia, param } from '../core/store.js';
import { lunes, sumarSemanas, sumarDias, etiquetaSemana, esc, html, num, pct, DIAS_NOMBRE, fmtCorto } from '../core/util.js';
import { error } from '../ui/ui.js';
import { capacidadSemana, colorCarga } from '../services/indicadores.js';
import { imprimirPDF } from '../services/pdf.js';

let estado;

export async function render(el, { query }) {
  estado = { semana: lunes(query?.get('semana') || undefined) };
  el.append(html(`<div>
    <div class="pagina-cab"><h1>Equipo y capacidad</h1>
      <div class="selector-semana"><button class="btn-icono" data-a="ant">◀</button><span data-sem></span><button class="btn-icono" data-a="sig">▶</button></div>
      <button class="btn btn-sm" data-a="hoy">Semana actual</button>
      <button class="btn btn-sm" data-a="copiar" title="Copiar la ubicación de la semana anterior">⧉ Copiar semana anterior</button>
      <span class="flex"></span><button class="btn btn-sm" data-a="pdf">🖨 PDF</button></div>
    <div class="aviso">Registre dónde estará cada persona cada día. Los días de vacaciones, licencia o feriado se descuentan de la capacidad semanal
      (días laborables × horas por día). Cada líder edita su fila; el administrador puede editar todas.</div>
    <div class="tarjeta" data-tabla></div></div>`));
  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'ant') { estado.semana = sumarSemanas(estado.semana, -1); pintar(); }
    if (a === 'sig') { estado.semana = sumarSemanas(estado.semana, 1); pintar(); }
    if (a === 'hoy') { estado.semana = lunes(); pintar(); }
    if (a === 'copiar') copiar();
    if (a === 'pdf') imprimirPDF('Equipo y capacidad', `<p>${esc(etiquetaSemana(estado.semana))}</p>` + document.querySelector('[data-tabla]').innerHTML.replace(/<select[\s\S]*?<\/select>/g, m => {
      const sel = /value="([^"]*)" selected/.exec(m); return sel ? esc(store.valores.get(sel[1])?.valor || '') : '';
    }), { proyectoTexto: 'Todos los proyectos', orientacion: 'landscape' });
  });
  el.addEventListener('change', async e => {
    const s = e.target.closest('select[data-u]');
    if (!s) return;
    try {
      const ex = estado.ubic.find(u => u.usuario_id === s.dataset.u && u.fecha === s.dataset.f);
      if (!s.value) { if (ex) await api.remove('ubicaciones_dia', ex.id); }
      else if (ex) await api.update('ubicaciones_dia', ex.id, { ubicacion_id: s.value });
      else await api.insert('ubicaciones_dia', { area_id: store.area.id, usuario_id: s.dataset.u, fecha: s.dataset.f, ubicacion_id: s.value });
      await pintar();
    } catch (err) { error(mensajeError(err)); }
  });
  await pintar();
}

async function pintar() {
  const area = store.area.id;
  const fin = sumarDias(estado.semana, 6);
  const [ubic, acts] = await Promise.all([
    api.list('ubicaciones_dia', { eq: { area_id: area }, gte: { fecha: estado.semana }, lte: { fecha: fin } }),
    api.list('actividades', { eq: { area_id: area, semana: estado.semana } }),
  ]);
  estado.ubic = ubic;
  document.querySelector('[data-sem]').textContent = etiquetaSemana(estado.semana);
  const laborables = (param('dias_laborables') || [1, 2, 3, 4, 5]).map(Number);
  const dias = Array.from({ length: 7 }, (_, i) => i).filter(i => laborables.includes(i + 1) || i < 5);
  const ops = valoresLista('ubicaciones');
  const personas = equipo(acts);
  document.querySelector('[data-tabla]').innerHTML = `<div style="overflow-x:auto"><table class="simple"><tr><th>Persona</th>
    ${dias.map(i => `<th>${DIAS_NOMBRE[i]} ${fmtCorto(sumarDias(estado.semana, i))}</th>`).join('')}
    <th class="num">H/día</th><th class="num">Capacidad</th><th class="num">HH comprometidas</th><th>Carga</th></tr>
    ${personas.map(p => {
      const editable = esGestor() || p.id === store.usuario.id;
      const cap = capacidadSemana(p.id, estado.semana, ubic);
      const hh = acts.filter(a => a.responsable_id === p.id && a.comprometida).reduce((s, a) => s + (Number(a.hh_total) || 0), 0);
      const r = cap ? hh / cap : null;
      return `<tr><td><b>${esc(p.nombre)}</b></td>${dias.map(i => {
        const f = sumarDias(estado.semana, i);
        const u = ubic.find(x => x.usuario_id === p.id && x.fecha === f);
        const color = u ? store.valores.get(u.ubicacion_id)?.color : null;
        return `<td style="${color ? `background:color-mix(in srgb, ${color} 14%, white)` : ''}">${editable
          ? `<select class="sel" data-u="${p.id}" data-f="${f}" style="width:100%"><option value="">—</option>${ops.map(o => `<option value="${o.id}"${u?.ubicacion_id === o.id ? ' selected' : ''}>${esc(o.valor)}</option>`).join('')}</select>`
          : esc(u ? store.valores.get(u.ubicacion_id)?.valor : '')}</td>`;
      }).join('')}
      <td class="num">${num(horasDia(p.id))}</td><td class="num">${num(cap)}</td><td class="num">${num(hh)}</td>
      <td style="min-width:120px"><div class="barra-prog" style="--bc:${colorCarga(r)}"><i style="width:${Math.min(100, (r || 0) * 100)}%"></i></div><span class="nota">${pct(r)}</span></td></tr>`;
    }).join('')}</table></div>`;
}

async function copiar() {
  const ant = sumarSemanas(estado.semana, -1);
  try {
    const prev = await api.list('ubicaciones_dia', { eq: { area_id: store.area.id }, gte: { fecha: ant }, lte: { fecha: sumarDias(ant, 6) } });
    const propias = prev.filter(u => esGestor() || u.usuario_id === store.usuario.id);
    for (const u of propias) {
      const f = sumarDias(u.fecha, 7);
      if (estado.ubic.some(x => x.usuario_id === u.usuario_id && x.fecha === f)) continue;
      const v = store.valores.get(u.ubicacion_id);
      if (v?.codigo === 'feriado' || v?.codigo === 'vacaciones') continue;
      await api.insert('ubicaciones_dia', { area_id: store.area.id, usuario_id: u.usuario_id, fecha: f, ubicacion_id: u.ubicacion_id });
    }
    await pintar();
  } catch (e) { error(mensajeError(e)); }
}
