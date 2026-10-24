// Ingreso, registro, recuperación de contraseña y selección de usuario de demostración.
import { api, modoDemo, supabaseConfigurado, usarModo, mensajeError } from '../data/api.js';
import { ROLES } from '../data/catalogos.js';
import { esc, html } from '../core/util.js';
import { error, ok } from '../ui/ui.js';

export function mostrarLogin(raiz, continuar) {
  if (modoDemo) return loginDemo(raiz, continuar);
  raiz.innerHTML = '';
  const caja = html(`<div class="login"><div class="login-caja">
    <div class="logo"><span>LPS<b style="color:var(--naranja)">-GT</b></span></div>
    <div class="lema">Last Planner System® para la Gerencia Técnica</div>
    <form data-f="ingresar">
      <div class="campo"><label for="l-email">Correo</label><input id="l-email" type="email" autocomplete="username" required></div>
      <div class="campo"><label for="l-clave">Contraseña</label><input id="l-clave" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primario" type="submit">Ingresar</button>
    </form>
    <form data-f="registrar" class="oculto">
      <div class="campo"><label for="r-nombre">Nombre y apellido</label><input id="r-nombre" required></div>
      <div class="campo"><label for="r-email">Correo</label><input id="r-email" type="email" autocomplete="username" required></div>
      <div class="campo"><label for="r-clave">Contraseña (mínimo 8 caracteres)</label><input id="r-clave" type="password" autocomplete="new-password" minlength="8" required></div>
      <button class="btn btn-primario" type="submit">Crear cuenta</button>
      <p class="nota">El administrador debe aprobar su cuenta y asignarle un rol antes de que pueda usar el aplicativo.</p>
    </form>
    <p style="display:flex;justify-content:space-between;margin-top:12px;font-size:13px">
      <a href="#" data-a="alternar">Crear una cuenta</a><a href="#" data-a="olvido">Olvidé mi contraseña</a></p>
    <p class="nota" style="text-align:center;margin-top:10px"><a href="#" data-a="demo">Probar el modo demostración</a></p>
  </div></div>`);
  raiz.append(caja);
  const fIng = caja.querySelector('[data-f="ingresar"]');
  const fReg = caja.querySelector('[data-f="registrar"]');
  fIng.addEventListener('submit', async e => {
    e.preventDefault();
    const b = fIng.querySelector('button'); b.disabled = true;
    try {
      await api.auth.ingresar(caja.querySelector('#l-email').value.trim(), caja.querySelector('#l-clave').value);
      continuar();
    } catch (err) { error(mensajeError(err)); } finally { b.disabled = false; }
  });
  fReg.addEventListener('submit', async e => {
    e.preventDefault();
    const clave = caja.querySelector('#r-clave').value;
    if (clave.length < 8) return error('La contraseña debe tener al menos 8 caracteres.');
    try {
      const r = await api.auth.registrar(caja.querySelector('#r-email').value.trim(), clave, caja.querySelector('#r-nombre').value.trim());
      if (r.session) continuar();
      else ok('Cuenta creada. Revise su correo para confirmarla y luego ingrese.');
    } catch (err) { error(mensajeError(err)); }
  });
  caja.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    e.preventDefault();
    if (a === 'alternar') {
      fIng.classList.toggle('oculto'); fReg.classList.toggle('oculto');
      e.target.textContent = fReg.classList.contains('oculto') ? 'Crear una cuenta' : 'Ya tengo cuenta';
    }
    if (a === 'olvido') {
      const email = caja.querySelector('#l-email').value.trim() || prompt('Correo de su cuenta:');
      if (!email) return;
      try { await api.auth.recuperar(email); ok('Le enviamos un correo para restablecer su contraseña.'); } catch (err) { error(mensajeError(err)); }
    }
    if (a === 'demo') usarModo('demo');
  });
}

function loginDemo(raiz, continuar) {
  const usuarios = api.usuariosDemo().filter(u => u.activo);
  raiz.innerHTML = '';
  const caja = html(`<div class="login"><div class="login-caja">
    <div class="logo"><span>LPS<b style="color:var(--naranja)">-GT</b></span></div>
    <div class="lema">Modo demostración · datos ficticios guardados solo en este navegador</div>
    <p style="font-weight:700;margin:0 0 8px">Ingresar como:</p>
    <div class="usuarios-demo">${usuarios.map(u => `<button data-id="${u.id}"><span class="avatar">${esc((u.codigo || '?').slice(0, 2))}</span>
      <span><b>${esc(u.nombre)}</b><small>${esc(ROLES[u.rol] || u.rol)}${u.es_admin_principal ? ' principal' : ''}</small></span></button>`).join('')}</div>
    <p class="nota" style="margin-top:12px">Abra otra pestaña con un usuario distinto para ver el trabajo simultáneo en tiempo real.</p>
    ${supabaseConfigurado ? '<p class="nota" style="text-align:center"><a href="#" data-a="real">Volver al modo real</a></p>' : ''}
  </div></div>`);
  raiz.append(caja);
  caja.addEventListener('click', async e => {
    const b = e.target.closest('[data-id]');
    if (b) { await api.auth.ingresar(b.dataset.id); continuar(); }
    if (e.target.closest('[data-a="real"]')) { e.preventDefault(); usarModo('real'); }
  });
}

export function mostrarPendiente(raiz, mensaje) {
  raiz.innerHTML = '';
  const caja = html(`<div class="login"><div class="login-caja">
    <div class="logo"><span>LPS<b style="color:var(--naranja)">-GT</b></span></div>
    <div class="aviso warn" style="margin-top:14px">${esc(mensaje)}</div>
    <button class="btn" data-a="salir">Cerrar sesión</button></div></div>`);
  raiz.append(caja);
  caja.querySelector('[data-a="salir"]').onclick = async () => { await api.auth.salir(); location.reload(); };
}

export function mostrarNuevaClave(raiz) {
  raiz.innerHTML = '';
  const caja = html(`<div class="login"><div class="login-caja">
    <div class="logo"><span>LPS<b style="color:var(--naranja)">-GT</b></span></div>
    <div class="lema">Defina su nueva contraseña</div>
    <form><div class="campo"><label for="n1">Nueva contraseña</label><input id="n1" type="password" minlength="8" required autocomplete="new-password"></div>
    <div class="campo"><label for="n2">Repetir</label><input id="n2" type="password" minlength="8" required autocomplete="new-password"></div>
    <button class="btn btn-primario" type="submit">Guardar</button></form></div></div>`);
  raiz.append(caja);
  caja.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const a = caja.querySelector('#n1').value, b = caja.querySelector('#n2').value;
    if (a.length < 8) return error('Mínimo 8 caracteres.');
    if (a !== b) return error('Las contraseñas no coinciden.');
    try { await api.auth.cambiarClave(a); ok('Contraseña actualizada.'); location.hash = ''; setTimeout(() => location.reload(), 800); }
    catch (err) { error(mensajeError(err)); }
  });
}
