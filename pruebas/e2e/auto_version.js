// Pedido 175: al publicar una versión nueva, el aplicativo se actualiza solo, pero espera si hay un formulario abierto.
// Uso: AUTO_DIR=<copia de app/ servida en el puerto 8098> node auto_version.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const DIR = process.env.AUTO_DIR; const B = 'http://localhost:8098/';
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/fonts.g*/**', r => r.abort());
  const fallas = []; const chk = (c, m) => { console.log((c ? 'OK    ' : 'FALLA ') + m); if (!c) fallas.push(m); };
  const sw = path.join(DIR, 'sw.js');
  const publicar = v => fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/const VERSION = '[^']*'/, `const VERSION = '${v}'`));
  publicar('lpsgt-prueba-1');
  await p.goto(B + '?demo'); await p.evaluate(() => localStorage.clear());
  await p.goto(B + '?demo&x=1#/'); await p.waitForSelector('.usuarios-demo button'); await p.click('.usuarios-demo button:nth-child(1)');
  await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 });
  await p.reload(); await p.waitForTimeout(1500);   // como un usuario real: la página ya abre con el service worker activo
  if (await p.locator('.usuarios-demo button').count()) await p.click('.usuarios-demo button:nth-child(1)');
  await p.evaluate(() => navigator.serviceWorker.addEventListener('controllerchange', () => { window.__cambio = (window.__cambio || 0) + 1; }));
  await p.waitForTimeout(21000);   // pasado el arranque: ya no es "recién abierta"
  await p.evaluate(() => { window.__marca = 1; });
  // 1) Con un formulario abierto: NO se recarga
  await p.evaluate(async () => { const m = await import('./js/views/proyectos.js'); m.formularioProyecto(); });
  await p.waitForSelector('.modal-fondo');
  publicar('lpsgt-prueba-2');
  await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await p.waitForTimeout(9000);
  chk(await p.evaluate(() => window.__marca === 1), 'con un formulario abierto, espera (no se recarga)');
  const aviso = await p.locator('.toast, .toasts').allInnerTexts().catch(() => []);
  console.log('  controllerchange:', await p.evaluate(() => window.__cambio || 0));
  console.log('  aviso:', aviso.join(' | ').slice(0, 160));
  // 2) Al cerrar el formulario: se recarga sola
  await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.modal-fondo').forEach(x => x.remove()));
  await p.waitForFunction(() => window.__marca !== 1, null, { timeout: 20000 }).then(() => chk(true, 'al cerrar el formulario, se actualiza sola'))
    .catch(() => chk(false, 'al cerrar el formulario, se actualiza sola'));
  await p.waitForTimeout(2000);
  const cache = await p.evaluate(async () => (await caches.keys()).join(','));
  console.log('  cachés:', cache);
  chk(cache.includes('lpsgt-prueba-2') && !cache.includes('lpsgt-prueba-1'), 'usa la versión nueva');
  chk(!errs.length, 'sin errores de página ' + errs.join(' / '));
  await b.close(); console.log(fallas.length ? `FALLAS: ${fallas.length}` : 'SIN ERRORES'); process.exit(fallas.length ? 1 : 0);
})();
