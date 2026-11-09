// Pedido 174: «Nuevo proyecto» no debe convertirse solo en Grupo LPS (el campo «Grupo LPS de (opcional)» empieza vacío).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: 'block' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/fonts.g*/**', r => r.abort());
  const B = 'http://localhost:8099/';
  const fallas = []; const chk = (c, m) => { console.log((c ? 'OK    ' : 'FALLA ') + m); if (!c) fallas.push(m); };
  await p.goto(B + '?demo'); await p.evaluate(() => localStorage.clear());
  await p.goto(B + '?demo&x=1#/'); await p.waitForSelector('.usuarios-demo button'); await p.click('.usuarios-demo button:nth-child(1)'); await p.waitForTimeout(1200);
  // Con un Grupo LPS elegido en el menú (el caso real)
  await p.evaluate(async () => {
    const { api } = await import('./js/data/api.js'); const s = await import('./js/core/store.js');
    const P = s.store.proyectos.find(x => !x.padre_id);
    const [G] = await api.insert('proyectos', { area_id: s.store.area.id, codigo: 'G-GES', nombre_corto: 'LPS Gestión', estado: 'activo', padre_id: P.id });
    await s.cargarCatalogo(); s.seleccionarProyecto(G.id);
  });
  await p.evaluate(async () => { const m = await import('./js/views/proyectos.js'); window.__f = m.formularioProyecto(); });
  await p.waitForSelector('select[name="padre_id"]');
  const v = await p.evaluate(() => ({ padre: document.querySelector('select[name="padre_id"]').value,
    port: document.querySelector('select[name="portafolio_id"]').value, prog: document.querySelector('select[name="programa_id"]').value,
    texto: document.querySelector('select[name="padre_id"]').selectedOptions[0].textContent }));
  console.log('  valores iniciales:', JSON.stringify(v));
  chk(v.padre === '' && /Ninguno/.test(v.texto), '«Grupo LPS de» empieza en «Ninguno»');
  chk(v.port === '' && v.prog === '', 'Portafolio y Programa empiezan vacíos');
  await p.fill('input[name="codigo"]', 'PRB-174'); await p.fill('input[name="nombre_corto"]', 'Proyecto prueba 174');
  await p.evaluate(() => { const s = document.querySelector('select[name="gerencia_id"]'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.locator('.modal .btn-primario, dialog .btn-primario, .fondo-modal .btn-primario').last().click(); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => { const { api } = await import('./js/data/api.js'); return (await api.list('proyectos', {})).find(x => x.codigo === 'PRB-174'); });
  console.log('  creado:', JSON.stringify(r && { padre_id: r.padre_id, portafolio_id: r.portafolio_id, programa_id: r.programa_id }));
  chk(!!r && !r.padre_id, 'el proyecto nuevo se guarda como proyecto (sin padre)');
  chk(!!r && !r.portafolio_id && !r.programa_id, 'sin portafolio ni programa elegidos a la fuerza');
  // Pedido 175: si se elige un proyecto en «Grupo LPS de», se pide confirmación; al decir que no, no se guarda
  await p.evaluate(async () => { const m = await import('./js/views/proyectos.js'); m.formularioProyecto(); });
  await p.waitForSelector('select[name="padre_id"]');
  await p.fill('input[name="codigo"]', 'PRB-175'); await p.fill('input[name="nombre_corto"]', 'Prueba 175');
  await p.evaluate(() => { for (const n of ['gerencia_id', 'padre_id']) { const s = document.querySelector(`select[name="${n}"]`); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.locator('.modal-fondo .btn-primario').last().click(); await p.waitForTimeout(600);
  const pregunta = await p.locator('.modal-fondo').last().innerText();
  chk(/Grupo LPS o proyecto/.test(pregunta), 'pide confirmación al elegir «Grupo LPS de»');
  await p.locator('.modal-fondo').last().locator('button:not(.btn-primario)').last().click(); await p.waitForTimeout(800);
  const r2 = await p.evaluate(async () => { const { api } = await import('./js/data/api.js'); return (await api.list('proyectos', {})).find(x => x.codigo === 'PRB-175'); });
  chk(!r2, 'al responder que no, no se guarda');
  chk(await p.locator('select[name="padre_id"]').count() === 1, 'el formulario sigue abierto para corregir');
  // La actualización automática existe (pedido 175)
  chk(await p.evaluate(async () => typeof (await import('./js/ui/grid.js')).hayCambiosSinGuardar === 'function'), 'la actualización automática sabe si hay cambios sin guardar');
  chk(!errs.length, 'sin errores de página ' + errs.join(' / '));
  await b.close(); console.log(fallas.length ? `FALLAS: ${fallas.length}` : 'SIN ERRORES'); process.exit(fallas.length ? 1 : 0);
})();
