// Vista preliminar de reportes (iframe de pdf.js). Archivo aparte porque la política de seguridad (CSP: script-src 'self')
// bloquea los scripts escritos dentro del documento. Datos en <body data-una-hoja data-alto data-ancho> (mm).
(function () {
  var hoja = document.getElementById('hoja'), raiz = document.documentElement, d = document.body.dataset;
  function encajar() {
    raiz.style.setProperty('--vista', 1);
    raiz.style.setProperty('--vista', Math.min(1, (innerWidth - 28) / hoja.offsetWidth));
  }
  addEventListener('resize', encajar); addEventListener('load', encajar); encajar();
  // "Todo en 1 hoja": reduce el contenido hasta que entre en el alto útil de la hoja
  if (d.unaHoja === '1') {
    var ajustar = function () {
      var c = document.getElementById('contenido'); c.style.zoom = 1;
      var mm = 96 / 25.4, util = (Number(d.alto) - 20) * mm - 70, anchoUtil = (Number(d.ancho) - 20) * mm;
      c.style.zoom = Math.min(1, util / c.scrollHeight, anchoUtil / c.scrollWidth);
    };
    addEventListener('load', ajustar); setTimeout(ajustar, 50);
  }
})();
