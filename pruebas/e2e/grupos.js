const { chromium } = require('playwright');
const BASE = 'http://localhost:8099/';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/fonts.g*/**', r => r.abort());
  const chk = (c, m) => { console.log((c ? 'OK  ' : 'FALLA ') + m); if (!c) errs.push(m); };
  await p.goto(BASE + '?demo'); await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + '?demo&x=1#/'); await p.waitForSelector('.usuarios-demo button'); await p.click('.usuarios-demo button:nth-child(1)'); await p.waitForTimeout(1000);
  await p.goto(BASE + '?demo#/config/listas'); await p.waitForTimeout(1200);
  const g = await p.$$eval('[data-l] optgroup', gs => gs.map(x => x.label + ': ' + [...x.querySelectorAll('option')].map(o => o.textContent).join(', ')));
  g.forEach(x => console.log('  ' + x));
  chk(g.length === 3 && g[0].startsWith('Gerencias, proyectos y servicios: Gerencias (clientes internos), 🏗 Proyectos / Procesos (catálogo) →, CET / Servicio'), 'tres grupos, el primero con Proyectos');
  chk((await p.$eval('[data-l]', s => s.value)) === 'gerencias', 'abre en Gerencias');
  // nueva lista en grupo nuevo
  await p.click('[data-a="nueva"]'); await p.waitForTimeout(300);
  await p.fill('.modal input[name="nombre"]', 'Disciplinas'); await p.fill('.modal input[name="grupo_nuevo"]', 'Calidad');
  await p.click('.modal-pie button:has-text("Guardar")'); await p.waitForTimeout(1200);
  const g2 = await p.$$eval('[data-l] optgroup', gs => gs.map(x => x.label));
  chk(g2.includes('Calidad') && (await p.$eval('[data-l]', s => s.value)) === 'disciplinas', 'lista nueva en grupo nuevo: ' + g2.join(' | '));
  // mover CNC a "Otras listas"
  await p.selectOption('[data-l]', 'cnc'); await p.waitForTimeout(800);
  await p.click('[data-a="grupo"]'); await p.waitForTimeout(300);
  await p.selectOption('.modal select[name="grupo"]', 'Otras listas'); await p.click('.modal-pie button:has-text("Guardar")'); await p.waitForTimeout(1000);
  const otras = await p.$$eval('[data-l] optgroup[label="Otras listas"] option', o => o.map(x => x.value));
  chk(otras.includes('cnc'), 'CNC movida a Otras listas');
  await p.selectOption('[data-l]', '__proyectos'); await p.waitForTimeout(1000);
  chk(p.url().includes('#/proyectos'), 'opción Proyectos lleva al catálogo');
  console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : 'SIN ERRORES');
  await b.close();
})();
