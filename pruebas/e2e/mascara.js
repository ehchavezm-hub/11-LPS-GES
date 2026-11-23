// Pedido 176: lo que ve el usuario. Celular usable (contenido a todo el ancho, menú flotante que se cierra al tocar fuera),
// íconos de línea en el menú, indicadores alineados, columna Semana angosta y vista previa de PDF sin bloqueos de la CSP.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const fallas = []; const chk = (c, m) => { console.log((c ? 'OK    ' : 'FALLA ') + m); if (!c) fallas.push(m); };
  const B = 'http://localhost:8099/';
  const entrar = async (p, n = 1) => {
    await p.goto(B + '?demo'); await p.evaluate(() => localStorage.clear());
    await p.goto(B + '?demo&x=1#/'); await p.waitForSelector('.usuarios-demo button'); await p.click(`.usuarios-demo button:nth-child(${n})`); await p.waitForTimeout(1500);
  };
  // Computadora
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })).newPage();
  const csp = [], errs = [];
  p.on('console', m => { if (/Content Security Policy/.test(m.text())) csp.push(m.text().slice(0, 100)); });
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/fonts.g*/**', r => r.abort());
  await entrar(p);
  await p.goto(B + '?demo#/plan'); await p.waitForTimeout(2000);
  chk(await p.locator('.nav-modulos a .ico svg').count() >= 8 && await p.locator('.nav-modulos a .ico').evaluateAll(es => es.every(e => e.querySelector('svg'))), 'menú con íconos de línea (sin emojis)');
  const sem = await p.locator('.tabulator-col[tabulator-field="semana"]').evaluate(e => e.getBoundingClientRect().width).catch(() => 0);
  const txt = await p.locator('.tabulator-row').first().locator('[tabulator-field="semana"]').innerText().catch(() => '');
  chk(sem > 0 && sem <= 100 && /^S-\d+$/.test(txt.trim()), `columna Semana angosta (${Math.round(sem)} px, «${txt.trim()}»)`);
  await p.goto(B + '?demo#/tablero'); await p.waitForTimeout(2000);
  const kp = await p.locator('.kpis .kpi').evaluateAll(es => es.map(e => [Math.round(e.getBoundingClientRect().top), Math.round(e.querySelector('.kpi-val').getBoundingClientRect().top)]));
  chk(kp.length >= 7 && new Set(kp.map(k => k[0])).size === 1, `Tablero: indicadores en una sola fila (${kp.length})`);
  chk(new Set(kp.map(k => k[1])).size === 1, 'Tablero: valores de los indicadores alineados');
  await p.goto(B + '?demo#/reportes'); await p.waitForTimeout(3500);
  const vista = await p.evaluate(() => document.querySelector('[data-prev]')?.contentDocument?.documentElement.style.getPropertyValue('--vista') || '');
  chk(vista !== '', 'vista previa de PDF: se ajusta al ancho (su script corre)');
  chk(!csp.length, 'sin bloqueos de la política de seguridad (CSP) ' + csp.join(' | '));
  // Celular
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', isMobile: true, hasTouch: true })).newPage();
  m.on('pageerror', e => errs.push(e.message));
  await m.route('**/fonts.g*/**', r => r.abort());
  await entrar(m, 3);
  await m.goto(B + '?demo#/plan'); await m.waitForTimeout(2000);
  const r = await m.evaluate(() => { const c = document.querySelector('.contenido').getBoundingClientRect(); return { pag: document.documentElement.scrollWidth, x: c.x, w: c.width }; });
  chk(r.pag <= 392 && r.x === 0 && r.w >= 380, `celular: contenido a todo el ancho (${JSON.stringify(r)})`);
  await m.click('[data-a="menu"]'); await m.waitForTimeout(400);
  chk(await m.evaluate(() => document.body.classList.contains('menu-abierto')), 'celular: el menú se abre');
  await m.mouse.click(370, 500); await m.waitForTimeout(400);
  chk(await m.evaluate(() => !document.body.classList.contains('menu-abierto')), 'celular: tocar fuera cierra el menú');
  chk(!errs.length, 'sin errores de página ' + errs.join(' / '));
  await b.close(); console.log(fallas.length ? `FALLAS: ${fallas.length}` : 'SIN ERRORES'); process.exit(fallas.length ? 1 : 0);
})();
