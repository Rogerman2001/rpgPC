# CavernaBURX 1.3 — Definitivas y estrategia

Tres definitivas automáticas sustituyen las Rupturas. Curvas independientes revisadas y un consejero de derrotas local con simulaciones en segundo plano. El informe **INFORME-1.3.md** contiene los apartados A–F, las tablas de presupuesto equivalente, los ejemplos reales y los límites encontrados. Los informes 1.1 y 1.2 son históricos.

Pruebas: `npm test` (23 pruebas), `npm run test:balance` (comparaciones reproducibles y campañas de ingresos reales), `npm run test:browser` (Chrome con Playwright opcional). Resultados actuales: `tests/build-results.json`.

Compatibilidad: se mantiene la clave v2 y se añade `rulesVersion: 1`, estilo y registro de hitos. Los guardados anteriores reciben estilo equilibrado; los hitos por debajo de su progreso quedan excluidos de premios retroactivos. No se reinician recursos, mejoras ni reliquias. La migración desde v1 sigue disponible.

RPG incremental estático en español, sin dependencias de producción. Se ha sustituido la cadena infinita de bosses/objetos por **seis bosses permanentes, seis reliquias y niveles independientes sin tope de diseño**.

## Ejecutar y publicar

**Archivo para jugar directamente:** abre `CavernaBURX.html` con doble clic en Chrome. Incluye estilos, motor y consejero local; funciona sin servidor. Para llevar una partida desde localhost, exporta su JSON e impórtalo en este archivo: cada ubicación mantiene su propio guardado. Puedes regenerarlo con `node tests/build-portable.mjs` después de editar los módulos.

`npm start` → http://localhost:4173. Requiere Node 20+ para el servidor y las pruebas; el juego solo necesita un navegador moderno. También sirve cualquier servidor estático. Abre `index.html` mediante HTTP, no mediante file://.

En Vercel: importa el repositorio, preset **Other**, sin comando de compilación, directorio de salida `.`. No hay autenticación ni servicios externos. No se ha publicado automáticamente.

## Sistemas

Cada tarjeta representa un guardián fijo. Seleccionarlo muestra sus estadísticas, especialización, reliquia y botones **DESAFIAR** (máximo derrotado + 1) y **REPETIR** (último nivel vencido de ese mismo guardián). No se cambia de guardián automáticamente. No hay selección libre de niveles anteriores.

| Boss | Especialización | Desbloqueo: uno inicial / los tres iniciales |
|---|---|---|
| Ataque | Daño alto, poca defensa | Inicial |
| Defensa | Armadura alta, 25% resistencia | Inicial |
| Vida | Mucha vida, regenera 0,5% de vida máxima en su turno | Inicial |
| Crítico | 30% probabilidad, daño crítico ×2 | 50 / 25 |
| Penetración | Ignora 65% de defensa | 150 / 75 |
| Vampirismo | Recupera 20% del daño efectivo infligido | 350 / 175 |

Los requisitos son simultáneos y usan niveles **derrotados**. El desbloqueo queda guardado permanentemente.

Primera victoria de cada nivel: 100% del oro, +1 nivel del boss y de su única reliquia. Al vencer el nivel 1 se obtiene la reliquia. Repetición: 80% del oro normal, dificultad constante, sin XP, sin niveles, sin objetos nuevos ni desbloqueos. Derrota: no da recompensas. Los bosses no se endurecen con repeticiones.

Reliquias de Ataque/Vida/Defensa: multiplicador `1 + 0,025 × nivel`. Crítico: +0,025 al multiplicador crítico por nivel (2,5 puntos porcentuales), sin cambiar la probabilidad del 12%. Penetración: `x / (1 + x)`, con `x = 0,005 × nivel`; robo de vida: misma fórmula con `x = 0,004 × nivel`. Las curaciones usan daño efectivo, no daño excedente, y nunca sobrepasan la vida máxima. Los niveles no tienen límite artificial.

AFK conserva desbloqueo de 200 oro, coste del 0,5% de la recompensa base por combate y entrega del 5% de la recompensa del modo elegido (en repetición: 5% × 80% = 4% de la base). Avanza o repite **el guardián seleccionado**. Una derrota al desafiar pasa a repetir ese mismo boss; si nunca se venció, se detiene. Derrota en repetición o falta de oro detienen AFK. Detenerlo deja finalizar el encuentro en curso. No se simula tiempo offline.

## Fórmulas y configuración

`js/config.js` centraliza bases, crecimientos, anclas, requisitos, recompensas, habilidades y porcentajes.

Para cada estadística: `base × 1,26^(ancla − 1) × crecimiento^(nivel − 1)`. Las anclas son 1 en iniciales, 55 en Crítico, 165 en Penetración y 380 en Vampirismo. Cada boss tiene sus propios multiplicadores, detallados en **INFORME-1.3.md**. El oro usa `28 × 1,30^(ancla − 1) × crecimientoOro^(nivel − 1)`.

Se mantienen mejoras de oro ×1, ×10 y máximo, +15% base por nivel y costes +18%. El daño usa `max(ataque − defensa × (1 − penetración), ataque × 0,08) × (1 − resistencia)`, multiplicado por daño crítico si corresponde. El jugador empieza con vida completa y ataca primero. Las estadísticas se fijan al entrar; compras durante el encuentro se aplican al siguiente.

## Guardado v2 y migración

`cavernaburx.save.v2` almacena seis registros `{highest, next, unlocked, wins, repeats}`, hasta seis objetos `{level}`, oro logarítmico, mejoras, boss seleccionado, AFK, velocidad, secuencia y encuentro pendiente. Las estadísticas se derivan de estos datos.

Una partida v1 válida se migra una sola vez:

- Se conservan oro, mejoras, velocidad y desbloqueo AFK. AFK queda detenido para revisar el nuevo sistema.
- Las antiguas familias 0/3 corresponden a Ataque, 1/4 a Vida y 2/5 a Defensa. Cada profundidad vencida cuenta una vez para su especialización; las repeticiones no cuentan como niveles. Es una conversión de hitos, no una afirmación de equivalencia de dificultad.
- Solo esas correspondencias generan las tres reliquias iniciales. Nunca se convierte un objeto antiguo en Crítico/Penetración/Vampirismo.
- Se conserva el poder anterior mediante un multiplicador fijo de legado por estadística: `max(0, logBonusAnterior − logBonusNuevo)`. No crece al repetir ni crea nuevos objetos. La XP antigua no tiene equivalente en el sistema de un nivel por primera victoria; queda en la copia original.
- La clave v1 permanece intacta. El JSON original se incluye en la exportación v2 y puede descargarse por separado desde **Partida**. Archivos incompatibles o incompletos bloquean el guardado/juego con aviso; nunca se reinician silenciosamente.
- Importar valida antes de reemplazar, solicita confirmación y conserva el guardado anterior en `cavernaburx.before-import`. Cualquier fallo de almacenamiento pausa el juego para exportar la copia en memoria.

Los encuentros llevan una secuencia y solo pueden resolverse una vez. Recargar abandona un combate parcial, sin devolver el coste AFK ni otorgar victoria. Web Locks permite una única pestaña escritora; hay detección de cambios externos como respaldo. Los datos locales y JSON editables no son un sistema antitrampas contra manipulación deliberada; no hay servidor.

## Archivos y pruebas

- `index.html`, `styles.css`: seis tarjetas, detalle, requisitos, inventario fijo y diseño adaptable.
- `js/app.js`: UI, temporizadores, controles AFK, copias y bloqueo de pestañas.
- `js/config.js`, `bosses.js`, `items.js`, `combat.js`, `upgrades.js`: reglas independientes de la UI.
- `js/save.js`: validación, v2 y migración segura desde v1.
- `js/numbers.js`: magnitudes en log10, evita desbordamiento de valores convencionales.
- `tests/game.test.js`, `tests/strategy.test.js`, `tests/ultimate.test.js`: `npm test` (23 pruebas funcionales).
- `tests/simulate-builds.mjs`: `npm run test:balance`; compras geométricas, presupuestos equivalentes, reliquias ganadas, campañas desde 35 oro y comparaciones de definitivas. Genera `tests/build-results.json`. `tests/simulate.mjs` conserva un acceso compatible.
- `tests/balance.mjs`: diagnóstico histórico con exploración en copias; no sustenta las conclusiones actuales.
- `js/strategy.js`: estilos y efectos temporales; `js/advice.js` y `js/advice-worker.js`: diagnóstico y escenarios hipotéticos aislados, sin API externa.
- `tests/browser-check.mjs`: con servidor activo y Playwright disponible, establece `PLAYWRIGHT_PATH` a su `index.mjs` y ejecuta `npm run test:browser`. Usa Chrome; `BROWSER_CHANNEL` permite otro canal. No es dependencia de producción.

Verificado en Chrome: seis tarjetas, bloqueo, desafíos/repeticiones, inventario, compras, persistencia, AFK, importación/exportación, migración, múltiples pestañas y anchos 390/320 px. Capturas locales excluidas de Git.

Límites técnicos: enteros seguros JavaScript para niveles; números logarítmicos aproximados; 2000 acciones máximas por encuentro para evitar curaciones interminables; importaciones hasta 20 MB; cuota de localStorage dependiente del navegador. Ya no se acumulan objetos/victorias por cada nivel, por lo que los seis registros de bosses y objetos tienen tamaño constante; la lista de hitos cobrados crece con los hitos. Una migrada conserva además su original. El balance a muy largo plazo sigue siendo provisional.
