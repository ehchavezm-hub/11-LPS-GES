# 04 — Cálculos y reglas

> Referencial. Fórmulas tal como estaban implementadas en ECM Project, con observaciones.

## 1. Semanas ISO (base de todo el LPS)
- Clave de semana `YYYY-WNN`, ISO 8601: la semana empieza el **lunes**; la semana 1 es la que contiene el 4 de enero.
- Inicio = lunes; fin = domingo. Rótulo: `Sem i · DD/MM–DD/MM (AAAA)`.
- Ventana LookAhead: semanas `ref, ref+1 … ref+N−1` con `ref` = semana actual; N = 1–8 (defecto 6).

## 2. PPC — Porcentaje de Plan Cumplido
```
PPC(semana) = round( completadas / planificadas × 100 )
planificadas = actividades LPS de la semana + tareas CPM que se cruzan con la semana
completadas  = ítems marcados ✓
```
- Sin planificadas → `N/A`. En el historial solo cuentan semanas con `saved = true`.
- **PPC promedio** = media simple de las semanas con dato. **Promedio acumulado** = media móvil desde la primera semana de la ventana.
- **No completadas** = planificadas − completadas.
- **Semáforo:** ≥ 75 % verde `#388E3C` · 60–74 % naranja `#F57C00` · < 60 % rojo `#D32F2F` · sin dato gris `#CFD8DC`. Metas LCI: 75 % (meta), 90 % (óptimo).
- ⚠ Incluía tareas CPM en el denominador automáticamente (no eran compromisos del Last Planner). LCI define el PPC solo sobre compromisos del Plan Semanal; revisar en LPS-GES.

## 3. Razones de varianza (Pareto)
Conteo de cada causa en `reasons` de todas las semanas guardadas; % = conteo / total; orden descendente. Causas fuera del catálogo se suman a "Otras causas".

## 4. Restricciones
- Activa ⇔ `status ≠ cleared`. Conteo por actividad: `taskId == id` **o** `activityNumber == code`.
- Pendientes / levantadas = conteos por estado.
- Una tarea CPM se considera "lista" si no tiene restricciones activas y no es crítica (no se mostraba explícitamente).
- ⚠ No se calculaban: días de atraso (hoy vs F. requerida), cumplimiento de fecha prometida, % de restricciones liberadas a tiempo. Son métricas LCI útiles para LPS-GES.

## 5. Asignación de tareas CPM a semanas
Una tarea (no resumen, no eliminada) pertenece a una semana si `inicio ≤ fin_semana` y `fin ≥ inicio_semana`, con `inicio = idxToDate(ES)` y `fin = idxToDate(max(ES, EF−1))`. Orden por ES.

**Lookahead simple:** tarea en ventana si `EF > refIdx` y `ES < refIdx + semanas × días_laborables_por_semana`; también se incluyen las **atrasadas** (`pct < 100` y `EF ≤ hoyIdx`). Estado: Completada (100 %) · Atrasada · En Curso (> 0 %) · Pendiente.

## 6. Calendario laborable
- Índices enteros de días laborables, fin exclusivo (D1): `ES=0, dur=3 → EF=3`; fecha fin mostrada = `idxToDate(EF−1)`.
- Día laborable = día de `work_week`, salvo excepción (`is_working` manda).
- `hoyIdx` = días laborables entre inicio del proyecto y hoy.

## 7. CPM (`js/cpm.js`)
- Duración: hito = 0; si hay avance, duración restante = `dur × (1 − pct/100)`.
- **Paso adelante** por orden topológico:
  - FS: `ES ≥ EF_pred + lag` · SS: `ES ≥ ES_pred + lag` · FF: `EF ≥ EF_pred + lag` · SF: `EF ≥ ES_pred + lag`.
  - `actual_start` fija ES; si una predecesora lo contradice → aviso `FUERA_DE_SECUENCIA`.
  - Restricciones: SNET (ES ≥ fecha), MSO (ES = fecha), FNET (EF ≥ fecha), MFO (EF = fecha). ES < 0 se recorta a 0 → `INICIO_RECORTADO`.
- **Paso atrás:** LF = mín. sobre sucesoras (FS: `LS_suc − lag`; SS: `LS_suc − lag + dur`; FF: `LF_suc − lag`; SF: `LF_suc − lag + dur`); SNLT, FNLT, MSO, MFO limitan LF/LS. `LS = LF − dur`.
- **Holgura total** `TF = LS − ES`. **Holgura libre** `FF = min(TF, mín. por sucesora)` (FS: `ES_suc − lag − EF`, SS: `ES_suc − lag − ES`, FF: `EF_suc − lag − EF`, SF: `EF_suc − lag − ES`).
- **Crítica** ⇔ TF ≤ 0. Tareas al 100 % → TF = null, no críticas (D13). "Casi crítica" si TF ≤ `nearThreshold` (defecto 5 d).
- **Resúmenes:** ES = mín. de hijos, EF = máx. de hijos (bottom-up).
- Avisos de calidad: `CICLO`, `LEAD` (lag < 0), `LAG_HIGH`, `NO_PRED`, `NO_SUCC`, `HARD_CONSTRAINT`.
- Validaciones al enlazar: sin ciclos, sin dependencias en resúmenes, los hitos no pueden tener hijos.

## 8. Alertas (`js/notifications.js`), horizonte 7 días
Para tareas no completadas: `díasRestantes = EF − hoyIdx`.
- < 0 → 🔴 **Atrasada** · ≤ 7 → 🟡 **Próxima** · TF = 0 → 🔷 **Crítica**. Orden por días restantes.

## 9. Curva S (`js/curva-s.js`) — ponderada por duración
- Peso de tarea = `EF − ES` (mín. 1). Muestras: ~50 puntos entre mín. ES y máx. EF.
- **Planificado(d)** = Σ (peso si EF ≤ d; proporcional si ES < d < EF) / Σ pesos × 100.
- **Real(d)** = Σ peso × %avance × min(1, (d − ES)/peso) / Σ pesos × 100.
- **Proyectado:** recta desde el real de hoy hasta 100 % en el fin del proyecto.
- **Línea base:** igual que planificado con ES/EF guardados.

## 10. Valor Ganado (`js/evm.js`) — solo tareas hoja, sin hitos
- `BAC = Σ costo planificado` · `EV = BAC × %avance` · `AC = Σ costo real`.
- `PV = BAC × fracción transcurrida` a la fecha de corte (o hoy) entre inicio y fin CPM.
- `SV = EV − PV` · `CV = EV − AC` · `SPI = EV/PV` · `CPI = EV/AC` (si el denominador es 0: 1 si EV > 0, si no 0).
- `EAC = BAC/CPI` · `ETC = EAC − AC` · `VAC = BAC − EAC` · `TCPI = (BAC − EV)/(BAC − AC)`.
- `% completo = EV/BAC × 100`. Curva PV/EV/AC semanal.

## 11. DCMA 14 puntos (`js/dcma.js`) — sobre tareas hoja
| # | Chequeo | Meta |
|---|---|---|
| 1 | Sin predecesora (excluye hitos) | 0 % |
| 2 | Sin sucesora (excluye hitos) | 0 % |
| 3 | Adelantos (lag < 0) | 0 % |
| 4 | Lag > 5 d | 0 % |
| 5 | Relaciones no-FS | ≤ 10 % |
| 6 | Restricciones duras (≠ ASAP/ALAP) | ≤ 5 % |
| 7 | TF > 44 d | ≤ 5 % |
| 8 | TF < 0 | 0 % |
| 9 | Duración > 44 d | ≤ 5 % |
| 10 | Fechas reales en el futuro | 0 % |
| 11 | Sin recurso asignado | 0 % (N/A si no hay asignaciones) |
| 12 | Retrasadas vs fecha de corte | 0 % (N/A sin fecha de corte) |
| 13 | CPLI = (LF_máx + máx(0, TF_mín))/LF_máx | ≥ 0,95 |
| 14 | SPI | ≥ 1 (N/A si BAC = 0) |

Puntaje = aprobados / aplicables × 100.

## 12. Monte Carlo
Distribución **PERT** por tarea con 3 puntos (o ±15 % de la duración si no hay), N iteraciones (100–50 000) en worker, recálculo CPM por iteración. Salidas: P50 / P80 / P90 de fin de proyecto y por tarea, desviación estándar, sensibilidad, índice de criticidad, top 10 por (P80 − P50).

## 13. Recursos
- **Sobreasignación:** por recurso y día, carga = Σ unidades de tareas activas; sobrecarga si carga > `max_units` (+0,001).
- **Nivelación:** recorre tareas por prioridad y las retrasa día a día hasta que la carga quepa; devuelve `{taskId, delayDays}`.

## 14. Riesgos
`score = probabilidad × impacto` (1–25). Nivel: 1–4 **Bajo** `#4caf50` · 5–9 **Medio** `#ff9800` · 10–25 **Alto** `#f44336`.

## 15. Varianza vs línea base
`ΔI = ES_actual − ES_LB`, `ΔF = EF_actual − EF_LB`, `ΔD = dur_actual − dur_LB` (días laborables). Positivo = atraso (rojo), negativo = adelanto (verde).
