# CavernaBURX 1.3 — Informe de implementación y validación

Fecha: 18 de octubre de 2026. Datos reproducibles: `npm test`, `npm run test:balance` y `npm run test:browser`. Resultados completos de simulación: [tests/build-results.json](tests/build-results.json). El equilibrio sigue siendo provisional; se distinguen los ensayos con presupuesto asignado de las campañas que ganan su propio oro.

## A. Cambios implementados

- `js/strategy.js`: Ruptura eliminada. Estilos conservados y tres definitivas temporales, con carga, duración y contadores independientes por encuentro.
- `js/combat.js`: un único motor para juego y simulación. `createEncounter` permite enfrentamientos aislados; `stepCombat(null, ...)` no concede recompensas ni modifica la partida. Telemetría de ataques, críticos, daño efectivo, armadura, curación y mitigación de definitiva.
- `js/config.js`: parámetros de definitivas, curvas independientes y límites del consejero centralizados.
- `js/advice.js`, `js/advice-worker.js`: diagnóstico del combate observado y comparación local de seis escenarios, ejecutada en un Web Worker. Sin servicios ni IA externos.
- `index.html`, `styles.css`, `js/app.js`: barra ámbar bajo la vida del protagonista, porcentaje accesible, nombre, efecto y duración activa; panel «Consejo de combate» junto al resumen existente. Un combate nuevo cancela el análisis anterior.
- Pruebas nuevas en `tests/ultimate.test.js`, simulación en `tests/simulate-builds.mjs` y ampliación de `tests/browser-check.mjs`. `tests/simulate.mjs` redirige al simulador actual. README y versión actualizados.

Se conservan seis cavernas y reliquias, mejoras y sus costes, oro, desbloqueos, repetición, AFK, hitos, navegación y migración. La clave y formato v2 permanecen; el identificador guardado `aggressive` sigue siendo válido aunque la interfaz diga «Ofensivo». La definitiva existe solo en el encuentro, nunca en los datos permanentes. Recargar abandona el combate como antes. No se han reiniciado partidas ni publicado cambios.

## B. Balance de Definitivas

Todas parten de cero. Cada ataque del protagonista que deja al boss vivo carga un tercio: 33%, 67%, activación automática y vuelta a 0%. La activación posterior a un golpe letal sería inútil y se omite. Los ataques enemigos no cargan. No hay carga durante el efecto ni acumulación de efectos.

La duración se mide en **acciones individuales**, no rondas: seis acciones posteriores a la activación equivalen a tres respuestas enemigas y tres ataques del protagonista. El ataque que completa la carga no recibe el efecto. Tras caducar hacen falta otros tres ataques para reactivar. Victoria, derrota y límite de acciones limpian carga y duración.

| Estilo / definitiva | Carga | Efecto durante 6 acciones | Activaciones medidas | Ataques por activación |
|---|---:|---|---:|---:|
| Ofensivo / Furia Desatada | 3 ataques | +35 puntos de probabilidad crítica: 12% → 47%; daño crítico intacto | 1223 | 6,55 |
| Defensivo / Bastión Inquebrantable | 3 ataques | Daño recibido después de armadura × 1/1,5: reducción adicional 33,3% | 2439 | 6,30 |
| Equilibrado / Armonía del Guerrero | 3 ataques | Ataque ×1,12 y daño recibido ×1/1,2: reducción adicional 16,7% | 1726 | 6,38 |

Mitigación adicional = `s / (1+s)`: no se suma a la armadura. Con `s=0,5`, sigue entrando 2/3 del daño que atravesaba la armadura; nunca hay invulnerabilidad. Crítico limitado explícitamente a [0,1]. La mejora ofensiva híbrida es menor que el aumento esperado de daño de Furia con el crítico base, aunque la armadura y los umbrales concretos pueden cambiar cuál resulta más útil.

**Método:** 864 enfrentamientos por estilo: seis bosses × normal/especial × nueve niveles de inversión próximos a la dificultad × ocho semillas. Personajes de laboratorio sin reliquias, no campañas financiadas. Cada prueba tiene una pareja con la misma semilla y definitiva desactivada. Hay 432 encuentros especiales por estilo. Los avanzados normales se prueban en nivel 1; los especiales en su primer múltiplo.

| Estilo | Victorias con / sin definitiva | Combates con activación | Combates cortos (<3 ataques) / activaciones | Victorias especiales |
|---|---:|---:|---:|---:|
| Ofensivo | 638 / 635 | 440 / 864 | 336 / 0 | 320 / 432 |
| Defensivo | 667 / 655 | 515 / 864 | 224 / 0 | 329 / 432 |
| Equilibrado | 661 / 659 | 484 / 864 | 256 / 0 | 328 / 432 |

**Alternativas ejecutadas**, victorias en orden Ofensivo / Defensivo / Equilibrado:

| Variante | Victorias sobre 864 por estilo |
|---|---|
| Seleccionada: carga 3, duración 6 | 638 / 667 / 661 |
| Carga 5, duración 6 | 639 / 662 / 661 |
| Carga 3, duración 4 | 636 / 664 / 661 |
| Carga 3, duración 8 | 640 / 667 / 661 |
| Potencia inferior: +25 puntos; s=0,35; híbrida +8% y s=0,15 | 637 / 664 / 661 |
| Potencia superior: +45 puntos; s=0,75; híbrida +16% y s=0,3 | 640 / 678 / 662 |

Furia con **+35% relativo** solo eleva 12% a 16,2% y consiguió 635 victorias, frente a 638 con +35 puntos. Se eligen puntos para que el efecto sea apreciable sin modificar el multiplicador crítico. Cargar en tres ataques permite activar en más encuentros: 440 frente a 309 con carga cinco en Ofensivo. Seis acciones mantienen tres golpes útiles por efecto; ocho no mejora las victorias defensivas y prolonga la protección. La potencia superior favorece especialmente al Defensivo; se conserva el punto intermedio para no convertir la definitiva en el factor dominante.

Estas diferencias pequeñas de victorias no prueban un óptimo estadístico. El RNG emparejado es comparable, pero cambiar la duración cambia en qué golpe cae cada crítico. Ninguna variante garantiza ganar, y las definitivas deliberadamente no intervienen en victorias de un golpe. En las comparaciones por presupuesto también hay encuentros y cavernas donde cada estilo aventaja a otro: no se deduce superioridad universal del total agregado.

## C. Rebalanceo de cavernas

No hay penalizaciones por build ni límites por caverna. Cada estadística conserva su fórmula exponencial con crecimiento independiente. Ataque sube mucho más deprisa que vida en la Fosa; el Bastión exige intercambio sostenido contra armadura; el Santuario concentra dificultad en vida y regeneración.

| Caverna | Base vida / ataque / defensa | Crecimientos vida / ataque / defensa | Rasgo ordinario |
|---|---|---|---|
| Ataque | 48 / 12 / 1 | 1,25 / 1,38 / 1,18 | Eliminarlo antes de su respuesta o resistirla |
| Defensa | 80 / 4 / 12 | 1,30 / 1,30 / 1,42 | Resistencia 25%, armadura creciente |
| Vida | 100 / 5 / 2 | 1,40 / 1,19 / 1,12 | Regenera 0,5% de vida máxima en su acción |
| Crítico | 60 / 8 / 1, ancla 55 | 2,4 / 2,4 / 2,3 | Sin cambios |
| Penetración | 65 / 9 / 3, ancla 165 | 16,3 / 16,3 / 15 | Ignora 65% de defensa |
| Vampirismo | 75 / 10 / 3, ancla 380 | 100000 / 100000 / 90000 | Sin cambios |

Penetración pasa de ×16 a ×16,3 en vida y ataque: el oro ×27 financia un crecimiento aproximado de estadísticas de `27^(ln(1,15)/ln(1,18)) ≈ 16,17`. La pendiente anterior quedaba por debajo. Se corrige dificultad conservando recompensas; esto no demuestra por sí solo estabilidad infinita. Los hitos mantienen intervalos 100 / 50 / 25 / 10, habilidades y ×2 oro solo al cobrarlos por primera vez.

**Presupuestos equivalentes:** misma cartera inicial para las tres builds y compras geométricas reales. Ofensiva asigna 99,5% a ataque y 0,5% a vida; Defensiva, 2% a ataque, 48% a vida y 50% a defensa; Equilibrada, un tercio a cada atributo. No se regalan reliquias ni desbloqueos. Se obtienen al ganar, utilizando el motor y las recompensas reales. El oro ganado queda apartado sin reinvertirse para mantener fijo el techo de inversión. Se recorren cavernas hasta tres derrotas en una barrera y hasta tres pasadas. Semilla 73.

La siguiente tabla mantiene **estilo Equilibrado en todas las builds**, aislando el reparto de compras. El JSON incluye las 36 combinaciones de cuatro presupuestos, tres builds y tres estilos. Un 0 significa ninguna victoria en esa caverna, esté bloqueada o no. Son máximos observados, no máximos matemáticos garantizados.

| Presupuesto | Build | Ataque | Defensa | Vida | Crítico | Penetración | Vampirismo |
|---|---|---:|---:|---:|---:|---:|---:|
| 1e3, temprano | Ofensiva | 8 | 6 | 8 | 0 | 0 | 0 |
| 1e3 | Defensiva | 7 | 7 | 9 | 0 | 0 | 0 |
| 1e3 | Equilibrada | 9 | 7 | 10 | 0 | 0 | 0 |
| 1e8, intermedio | Ofensiva | 51 | 38 | 43 | 0 | 0 | 0 |
| 1e8 | Defensiva | 42 | 43 | 37 | 0 | 0 | 0 |
| 1e8 | Equilibrada | 48 | 46 | 44 | 0 | 0 | 0 |
| 1e25, avanzado | Ofensiva | 204 | 168 | 149 | 39 | 3 | 0 |
| 1e25 | Defensiva | 190 | 173 | 139 | 38 | 3 | 0 |
| 1e25 | Equilibrada | 201 | 175 | 146 | 39 | 3 | 0 |
| 1e150, escala extrema | Ofensiva | 1300 | 1103 | 878 | 319 | 92 | 18 |
| 1e150 | Defensiva | 1288 | 1107 | 868 | 318 | 91 | 18 |
| 1e150 | Equilibrada | 1298 | 1108 | 875 | 320 | 91 | 18 |

Las mejoras indivisibles dejan remanentes: las carteras son iguales, el gasto no es idéntico. Se conserva el gasto exacto y los niveles comprados en `fixed[].spent` y `upgrades`; por ejemplo, en 1e8 se gastan aproximadamente 9,14e7 / 8,96e7 / 9,17e7. No se equiparan artificialmente los niveles de mejoras.

**Control con curvas anteriores y definitivas nuevas:** en 1e8 la Ofensiva obtenía 51/50/48 y la Defensiva 50/50/46; ahora son 51/38/43 y 42/43/37. En 1e25 la Ofensiva pasaba de 199/197/196 a 204/168/149. La distancia entre cavernas deja de ser de unos pocos niveles. En el Bastión intermedio, cinco niveles adicionales de la Defensiva frente a la Ofensiva representan ×3,71 en vida/ataque y ×5,77 en armadura.

**Otras semillas:** en 1e8, semillas 11/22/33, Ofensiva alcanza siempre 53/38/43; Defensiva, 42/43/37; Equilibrada, 46–48/46/44. La dirección de las diferencias se mantiene. El tramo temprano conserva diferencias pequeñas; la especialización se acentúa al crecer las curvas.

**Campañas con ingresos reales**, separadas del ensayo anterior: comienzan con 35 oro, invierten después de cada victoria según su reparto, rotan cavernas disponibles y repiten tras perder. Usan su estilo correspondiente, semilla 641 y 6000 encuentros cada una. No reciben oro ni reliquias de laboratorio.

| Build | Máximos Ataque / Defensa / Vida / Crítico / Penetración / Vampirismo | Victorias / derrotas | Repeticiones ganadas | Oro ganado | Acciones |
|---|---|---|---:|---:|---:|
| Ofensiva | 1415 / 36 / 41 / 1 / 0 / 0 | 5918 / 82 | 4425 | 1,60e163 | 8044 |
| Defensiva | 64 / 50 / 41 / 1 / 0 / 0 | 4943 / 1057 | 4787 | 9,99e10 | 1078845 |
| Equilibrada | 109 / 49 / 46 / 2 / 0 / 0 | 4706 / 1294 | 4500 | 4,54e14 | 99460 |

No son campañas de igual duración ni inversiones óptimas. El JSON incluye una estimación de tiempo a ×4 más un segundo por decisión; no es tiempo humano observado. La enorme ventaja económica ofensiva se comunica como problema, no como prueba de equilibrio conseguido.

## D. Análisis de derrotas

El diagnóstico prioriza derrota ajustada (≤10% vida restante), curación que compensa ≥55% del daño, supervivencia corta (≤3 ataques), armadura que bloquea ≥60%, falta de daño prolongada e intercambio desfavorable. Armadura, resistencia y definitiva se registran por separado. Se emplean daños efectivos y curación realmente aplicada, nunca cifras de ejemplo inventadas.

El consejero compara seis escenarios: sin cambios; tres mejoras adicionales de ataque, vida o defensa; y los otros dos estilos. Aplica el coste geométrico correspondiente a los niveles al iniciar el combate. Cada variante recibe las mismas doce semillas. Ordena por victorias y vida restante; con efectividad similar prefiere un cambio gratuito o asequible. Las compras realizadas durante el combate no se incorporan retroactivamente a esa fotografía. No recomienda comprar crítico, penetración ni atributos sin botón de mejora.

Ejemplos ejecutados y guardados en `examples`:

1. **Fosa 5, dos mejoras en cada atributo y reliquia de Ataque nivel 4:** derrota observada con 9% de vida enemiga. Recomienda +3 ataque, coste 74,6 oro, requiere ahorrar. Escenarios: 12/12 victorias frente a 0/12 base; +3 vida gana 6/12. No garantiza victoria ni confunde la semilla observada con la muestra contrafactual.
2. **Fosa 21, mejoras 25/20/15:** solo un ataque antes de morir. +3 ataque cuesta 3358 y reduce la vida enemiga media de 84,7% a 76,4%, pero ambos escenarios ganan 0/12. El mensaje declara expresamente que la mejora no bastó. No recomienda defensa solo porque el personaje murió rápido.
3. **Santuario 21, mismas mejoras y su reliquia nivel 20:** el boss recuperó 99,9% del daño recibido. Detecta curación; ninguna opción moderada supera el umbral de evidencia. Recomienda obtener recursos y reevaluar, sin asegurar que tres mejoras resuelvan la regeneración.
4. **Bastión 21, mismas mejoras:** sobrevive tres ataques propios y activa su definitiva, pero pierde. Ninguna de las alternativas consigue una mejora suficiente: consejo prudente. Los casos de armadura, falta de daño y derrota ajustada también tienen pruebas unitarias específicas de clasificación.

El análisis corre fuera del hilo de interfaz. Límite de doce lotes, seis variantes por lote y 2000 acciones por combate: como máximo 144000 acciones simuladas. Presupuesto temporal de 1500 ms comprobado entre lotes completos; puede sobrepasarse en el último lote. Si hay menos de seis muestras, no se recomienda una variante. Cambiar de combate termina el worker. Si no está disponible, queda el diagnóstico observado con aviso de comparación no disponible.

## E. Problemas detectados y alcance

- **Economía ofensiva dominante en la campaña probada.** El primer ataque y la vida relativamente baja de la Fosa facilitan victorias de un golpe. La campaña llegó a 1415 allí mientras otras cavernas quedaron en 36/41. Hay especialización extrema, pero su oro puede financiar una redistribución posterior que este agente de inversión fija no explora. No se han alterado recompensas ni la regla de iniciativa para ocultar el problema.
- **La Defensiva no es la mejor build del Bastión.** Supera a la Ofensiva en el ensayo intermedio, pero la Equilibrada obtiene más niveles allí. Mejoró la utilidad relativa de defensa; el objetivo de que cada especialización destaque muchísimo frente a todas las demás no está plenamente demostrado. La comparación sigue siendo provisional.
- **Bloqueos de acceso:** Vida y Defensa frenan los requisitos conjuntos de Penetración y Vampirismo en las tres campañas de 6000 encuentros. Ambos avanzados se validaron en pruebas controladas de escala alta, no en esas campañas financiadas.
- **Encuentros largos:** la campaña Defensiva consume más de un millón de acciones. El límite de 2000 sigue contando como derrota; el consejero lo identifica como falta de daño cuando corresponde. La regeneración de hitos de Vida conserva 2,5%, un salto importante sobre el 0,5% ordinario.
- **Definitivas de impacto moderado:** muchas victorias están decididas antes de cargar. La mejora híbrida cambió solo dos resultados del banco. Podría revisarse con datos de jugadores, sin afirmar que las pequeñas diferencias sean concluyentes.
- **Análisis acotado:** doce muestras no son una garantía estadística; no busca combinaciones de compras, redistribuciones, equipamiento futuro ni políticas óptimas. Una mejora puede reducir vida restante sin conseguir ninguna victoria; el mensaje lo dice.
- **Persistencia y precisión:** las partidas conservan poder y niveles, pero la dificultad del siguiente boss cambia. Los números son aproximados en log10; niveles usan enteros seguros de JavaScript. Progresión sin tope de diseño no significa equilibrio probado infinito. No hay cuentas, nube ni simulación offline.

## F. Pruebas realizadas

**Pasadas:** 23 pruebas automáticas de motor, compras, reliquias, grandes magnitudes, críticos, resistencia, curación, desbloqueos, estilos, definitivas, hitos, AFK, guardado, migración, diagnósticos y aislamiento de simulación. Incluyen crítico ≤100%, mitigación válida, reinicio y ausencia de efectos permanentes.

**Simulaciones pasadas:** 36 comparaciones de presupuesto/build/estilo, nueve comprobaciones adicionales con otras semillas, seis controles con curvas anteriores, tres campañas de 6000 encuentros, bancos de definitivas con variantes de carga/duración/potencia y ejemplos del consejero. Aserciones del simulador verifican ventajas cruzadas intermedias y que todas las comparaciones llegan a una barrera sin agotar el límite de exploración. Tiempo del último lote completo: aproximadamente tres segundos en este equipo; no se extrapola a móviles.

**Navegador:** Chrome mediante Playwright, escritorio 1440 px y anchos móviles 390/320 px. Comprobados carga visual 0→33%, actividad, reinicio, bloqueo de cambio de estilo durante combate, cambio posterior, consejo calculado por worker, resumen, desafíos/repetición, mejoras, inventario, AFK victoria/derrota, recarga, exportación/importación, migración v1 y bloqueo entre pestañas. Sin errores JavaScript registrados y sin desbordamiento horizontal en las vistas comprobadas. Capturas revisadas de escritorio y consejo móvil.

**Fallos encontrados y corregidos:** una comparación estricta de porcentajes fallaba por redondeo de coma flotante; ahora usa tolerancia. Las primeras curvas candidatas dejaban a la Defensiva por detrás de la Ofensiva en el Bastión; se ajustaron base y crecimiento y se repitieron las simulaciones. Los scripts antiguos de Ruptura quedaron sustituidos por el punto de entrada actual.

**No ejecutado:** dispositivos móviles físicos, Safari/Firefox, rendimiento en teléfonos de gama baja, sesiones AFK de 24 horas, publicación en Vercel, ni una validación exhaustiva de todas las semillas y niveles. Los resultados históricos 1.1/1.2 no se presentan como pruebas de esta actualización.

Para probar: `npm start` y abrir http://localhost:4173. Es una web estática con entrada `index.html`; no requiere compilación ni dependencias de producción.

**Entrega portátil solicitada después:** `CavernaBURX.html` reúne los módulos, CSS y un worker Blob local en un único archivo. Generador reproducible: `node tests/build-portable.mjs`. Se ejecutó de nuevo la suite completa de navegador abriendo este archivo mediante `file://` en Chrome: pasó, incluidos consejero, guardado, AFK y migración. También pasaron otra vez las 23 pruebas y la comprobación de sintaxis/UTF-8 de 21 archivos JavaScript. No necesita instalación ni servidor para jugar. El guardado de localhost y el del archivo son ubicaciones distintas; exportación/importación JSON permite trasladarlo.
