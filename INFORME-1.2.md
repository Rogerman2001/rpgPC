# CavernaBURX 1.2 — Informe de implementación y simulación

Fecha: 18 de octubre de 2026. Versión jugable; **el balance a largo plazo no está validado**. Se han encontrado desequilibrios medibles, detallados abajo. Los ajustes experimentales se ejecutaron solo en el simulador y no alteran las partidas.

## 1. Cambios implementados

La navegación principal tiene dos destinos: **Personaje** y **Caverna**. Personaje reúne una silueta SVG del errante, estadísticas, selector de estilo, mejoras y seis reliquias pasivas. Caverna contiene Guardianes y Expedición AFK. Las tarjetas muestran nombre de la caverna, nivel pendiente y disponibilidad; el detalle conserva nombres originales, atributos, progreso, requisitos, reliquia y botones Desafiar/Repetir.

Se añadieron estilos, seis Rupturas, hitos temporales, premios exclusivos de primera victoria y resumen de daño/armadura. No se cambiaron curvas ordinarias, fórmulas de mejoras, reliquias, requisitos de desbloqueo ni porcentajes económicos de repetición/AFK. Este proyecto sigue sin cuentas o autenticación: no había un sistema de cuentas que migrar.

## 2. Archivos

- `index.html`, `styles.css`, `js/app.js`: organización visual, personaje, estilos, Ruptura, hitos y resumen.
- `js/config.js`: nombres de cavernas, estilos, condiciones, duración, multiplicadores de hitos.
- `js/strategy.js`: nuevo módulo de estilos, estado temporal de Ruptura y métricas.
- `js/combat.js`: aplicación por turnos, estadísticas reales y entrega única de premios.
- `js/bosses.js`: cálculo matemático de hitos, habilidades temporales y recompensa.
- `js/save.js`: extensión compatible del esquema v2.
- `tests/strategy.test.js`, `tests/browser-check.mjs`: pruebas nuevas y navegación actualizada.
- `tests/simulate.mjs`, `tests/simulation-results.json`: simulador aislado y resultados reproducibles.
- `package.json`, `.gitignore`, `README.md`, `BALANCE.md`: comandos, capturas locales y documentación. El informe 1.1 se conserva identificado como histórico.

## 3. Estilos y combate

| Estilo | Ataque | Vida máxima | Defensa |
|---|---:|---:|---:|
| Equilibrado | ×1 | ×1 | ×1 |
| Agresivo | ×1,25 | ×0,85 | ×0,8 |
| Defensivo | ×0,85 | ×1,2 | ×1,35 |

Valores provisionales configurables. El estilo persiste y se toma como una instantánea al empezar. No puede cambiarse durante combate o AFK activo. No modifica niveles, precios ni efectos permanentes de objetos. Equilibrado conserva las estadísticas previas; las nuevas Rupturas se aplican a todos los estilos.

El resumen utiliza daño efectivo sobre los puntos de vida, sin contabilizar sobre-daño. Para armadura acumula por ataque el daño bruto y la diferencia hasta el daño posterior a armadura, **antes de resistencia**. El porcentaje es `100 × sumaBloqueado / sumaBruto`; si no hubo ataques muestra «Sin ataques». Los críticos multiplican ambos términos, conservando la fórmula previa de críticos posterior a la resta de defensa. El daño perdido por resistencia, el sobre-daño y las curaciones no cuentan como armadura. «Turnos» se identifica como acciones individuales, no rondas completas.

## 4. Rupturas

Se activan después de la acción que cumple la condición y afectan a las **seis acciones siguientes** (aproximadamente tres rondas). No se acumula progreso durante la ventana. Al finalizar hay que reconstruirlo; cada encuentro comienza desde cero. Sobrevivir significa terminar la acción con vida positiva.

| Boss | Condición | Efecto temporal |
|---|---|---|
| Ataque | Sobrevivir a 2 golpes cuyo daño bruto sea ≥8% de tu vida máxima | Ataque enemigo ×0,65 |
| Defensa | 3 golpes que conserven ≥40% de daño tras armadura | Defensa enemiga ×0,35 |
| Vida | Daño acumulado ≥25% de su vida máxima en los últimos 3 ataques propios | Regeneración desactivada |
| Crítico | Sobrevivir a 2 críticos | Bonus sobre ×1 de daño crítico reducido al 25% |
| Penetración | Sobrevivir a daño adicional por ignorar armadura equivalente al 15% de tu vida máxima | Penetración ×0,25 |
| Vampirismo | Durante 2 ataques consecutivos limitar su curación potencial a ≤2% de su vida máxima, con al menos 2% de vida faltante | Robo de vida ×0,2 |

Penetración compara el daño real posterior a armadura con y sin penetración y limita la diferencia al daño efectivo recibido. No basta con recibir daño sin armadura. Vampirismo usa curación potencial, no la truncada por alcanzar vida completa, para evitar activaciones gratuitas. No se ha sustituido ninguna condición avanzada silenciosamente.

En 405 encuentros controlados por boss (135 por estilo, cinco semillas y varias distribuciones de mejoras):

| Boss | Encuentros con Ruptura | Derrotas convertidas en victorias frente a Ruptura desactivada | Acciones ahorradas entre victorias emparejadas |
|---|---:|---:|---:|
| Ataque | 230 | 20 | 0 |
| Defensa | 99 | 0 | 234 |
| Vida | 183 | 0 | 192 |
| Crítico | 57 | 0 | 0 |
| Penetración | 88 | 3 | 0 |
| Vampirismo | 248 | 4 | 130 |

Estos son escenarios cercanos a umbrales, con personajes de prueba declarados como tales, no campañas obtenidas jugando. La comparación usa el mismo motor y semilla con Ruptura activada/desactivada. Reducir turnos cambia qué tiradas posteriores corresponden a cada actor; no es una prueba estadística exhaustiva.

La influencia del jugador es observable: en Crítico, Defensivo produjo 30 activaciones frente a 11 de Agresivo; en Penetración 45 frente a 23; en Vampirismo 179 frente a 66. Aun así, Crítico depende del azar y su utilidad para ganar fue nula en esta muestra. Se mantiene provisional y se estudia una alternativa cuantificada en el apartado 10.

## 5. Hitos y escalado

`especial = nivel % intervalo === 0`. Cada atributo especial parte del atributo ordinario **de ese nivel** y se multiplica una sola vez. No hay evoluciones permanentes ni acumulación.

| Boss | Intervalo | Vida | Ataque | Defensa | Modificación propia |
|---|---:|---:|---:|---:|---|
| Ataque | 100 | ×1,7 | ×1,4 | ×1,2 | Cada tercer ataque hace ×1,5 daño |
| Defensa | 100 | ×1,8 | ×1,25 | ×1,5 | Resistencia 30% |
| Vida | 100 | ×2 | ×1,25 | ×1,2 | Regeneración 2,5% |
| Crítico | 50 | ×1,7 | ×1,35 | ×1,2 | Probabilidad 40%, daño crítico ×2,3 |
| Penetración | 25 | ×1,7 | ×1,35 | ×1,3 | Ignora 80% de defensa |
| Vampirismo | 10 | ×1,8 | ×1,35 | ×1,25 | Robo de vida 30% |

Comprobación con combates reales y búsqueda del nivel común de mejoras necesario para vencer, sin reliquias, semilla 42:

| Boss / primer hito | Normal del mismo nivel | Especial | Nivel siguiente normal |
|---|---:|---:|---:|
| Ataque 100 | 159 | 163 | 161 |
| Defensa 100 | 161 | 164 | 163 |
| Vida 100 | 160 | 164 | 161 |
| Crítico 50 | 393 | 396 | 400 |
| Penetración 25 | 745 | 748 | 765 |
| Vampirismo 10 | 1367 | 1370 | 1449 |

Todos exigen más mejoras que su equivalente ordinario. En los avanzados, el enorme salto de la curva original puede hacer que el siguiente nivel normal siga siendo más difícil que el hito; no se alteró esa curva para forzar lo contrario. A escalas altas, un personaje sobreequipado aún puede trivializar hitos.

## 6. Premios y persistencia

Primera victoria de un hito: **×2 oro normal**, con el mismo incremento de una reliquia. Repetir el hito: ×0,8 del oro ordinario, sin extra, XP ni nivel de objeto. AFK: primera victoria especial entrega ×2 ×0,05; repetir entrega ×0,8 ×0,05. El coste AFK sigue siendo ×0,005 de la recompensa base, sin duplicarse por hito.

La extensión `rulesVersion: 1` mantiene la clave v2. Añade `style` y, por boss, `milestones: {legacyThrough, claimed}`. El registro reclamado es persistente, ordenado y validado. El token de encuentro impide resolver dos veces; el premio se registra junto a la victoria antes de guardar. Recargar un combate parcial no da premios. Repetir jamás entra en la rama de recompensa especial.

Partidas antiguas: se conservan oro, mejoras, bosses, reliquias y AFK; se asigna Equilibrado. `legacyThrough` marca el nivel ya superado como no elegible para premios retroactivos. No se reinicia la partida ni se entregan extras al importar repetidamente. La migración v1 y la copia original siguen disponibles. Modificar deliberadamente JSON sigue siendo posible en un juego local; no se promete antitrampas de servidor.

## 7. Metodología de simulación acelerada

Comando: `npm run test:balance`. Por defecto, 25.000 encuentros por comportamiento y comparación. `SIM_BATTLES` modifica el presupuesto. Ningún acceso a localStorage, cuentas, navegador o red. Se utiliza el combate completo, compras, drops, desbloqueos y premios reales, sin esperas.

- **Básico:** rota por los bosses desbloqueados, compra la mejora más barata, usa Equilibrado y repite tras fallar. No busca el mayor rendimiento económico.
- **Optimizador heurístico:** estima daño y supervivencia con estadísticas públicas, compara los tres estilos y oro por acción estimada. Prioriza mínimos necesarios para desbloqueos. Compra según crecimiento marginal por coste con prioridades Ataque 0,58, Vida 0,30 y Defensa 0,12. Recuerda derrotas con el mismo equipo y prueba de nuevo periódicamente. Estas prioridades son heurísticas, no una demostración de optimalidad.
- **Especializado:** invierte solo en ataque, usa Agresivo y elige objetivos según daño/eficiencia estimados. Permite detectar dependencia del primer golpe.

No se ejecuta ningún combate futuro para decidir la campaña, ni se consulta la semilla o próximos críticos. Las fórmulas esperadas solo usan información pública; los RNG reales se consumen al combatir. El análisis controlado y las comparaciones contrafactuales están separados de las campañas.

Semilla de campaña: 20261018. Se ejecutaron 75.000 encuentros de campañas base y 50.000 adicionales de propuestas económicas, más escenarios controlados. Tiempo real de la ejecución registrada: **44,48 segundos**, dependiente del equipo.

## 8. Máximos y resultados medidos

| Estrategia | Ataque | Defensa | Vida | Crítico | Penetración | Vampirismo |
|---|---:|---:|---:|---:|---:|---:|
| Básico | 4260 | 4257 | 4257 | 3782 | 3358 | 808 |
| Optimizador heurístico | 1494 | 1666 | 994 | 569 | 15648 | 27 |
| Especializado ofensivo | 187 | 196 | 194 | 35 | 2 | 0 |

Las tres campañas terminaron por presupuesto de encuentros, no por un bloqueo matemático probado. Los niveles dependen de la selección: un avanzado puede superar en número a los iniciales si se concentra allí todo el juego; no son una comparación de dificultad a igualdad de personaje.

| Estrategia | Victorias | Derrotas | Repeticiones ganadas | Acciones | Hitos cobrados |
|---|---:|---:|---:|---:|---:|
| Básico | 23545 | 1455 | 2823 | 50415 | 415 |
| Optimizador | 20399 | 4601 | 1 | 9132453 | 677 |
| Especializado | 21757 | 3243 | 21143 | 28375 | 3 |

El básico y el optimizador superaron el primer hito de los seis bosses y hitos posteriores. El especialista no desbloqueó Vampirismo y no alcanzó hitos avanzados. Sus ingresos continuaban: podía seguir farmeando; no se declara imposible superar la barrera. Su siguiente objetivo de Vida 195 requiere sobrevivir a una respuesta, algo que su vida/defensa sin mejorar no permiten.

Desbloqueos medidos en número de encuentro (Crítico / Penetración / Vampirismo): básico **148 / 545 / 1541**, optimizador **100 / 362 / 875**, especialista **633 / 6069 / no alcanzado**.

Oro total / oro de repetición: básico **1,73e4825 / 5,33e4802**; optimizador **5,00e22416 / 1,10e96**; especialista **2,46e25 / 2,11e25**. Los resultados JSON contienen costes pagados, oro por segundo modelado, daño total, armadura, uso de estilos, Rupturas y cada hito con su encuentro y tiempo modelado.

**Estimación temporal, no tiempo de jugador medido:** 0,1625 s por acción (visualización ×4) + 1 s por decisión de combate; sin tiempo de compra, pausas o navegación. Totales: básico **9,22 h**, optimizador **419,17 h**, especialista **8,23 h**. El optimizador heurístico no fue eficiente en tiempo: numerosas peleas largas y fallos alcanzaron el límite de acciones. No se presenta su nombre como evidencia de superioridad.

## 9. Problemas detectados

1. **Penetración permite escalada económica excesiva.** Oro ×27 frente a estadísticas ×16, junto a mejoras +15% por coste +18%, hace que la potencia comprable crezca ligeramente más rápido que el enemigo. Se observa nivel 15648 sin miles de repeticiones. La comparación corta 1.1 no lo detectó.
2. **Arrastre de oro avanzado.** El oro enorme de un boss permite comprar poder que trivializa otros bosses, incluidos hitos. Las curvas son distintas, pero no garantizan las proporciones deseadas si la economía se realimenta. No puede afirmarse que los avanzados mantengan siempre una progresión mucho más lenta.
3. **Optimizador imperfecto.** Su cálculo esperado no modela fielmente ventanas de Ruptura, regeneración por umbral y variación crítica. Puede escoger peleas de 2000 acciones. Es una deficiencia de la heurística y de la duración máxima tolerada, no prueba de progreso inviable.
4. **Crítico: Ruptura tardía y aleatoria.** 57/405 activaciones, sin convertir derrotas en victorias en esta muestra. Defensivo permite más activaciones, pero no garantiza utilidad.
5. **Estilos situacionales, sin prueba universal.** Se encontraron casos en que solo Agresivo ganaba y otros en que solo Defensivo ganaba (por ejemplo, 2 y 5 casos respectivamente contra Defensa). Esto refuta una superioridad absoluta en la muestra, pero no demuestra balance global. Equilibrado sigue siendo una referencia sin penalizaciones.
6. **Rupturas de Defensa/Vida aportan velocidad, no nuevas victorias en el banco probado.** Son útiles para duración, pero requieren más escenarios cerca de barreras reales. Penetración y Vampirismo sí convirtieron 3 y 4 derrotas, respectivamente.

## 10. Ajustes comparados, no aplicados

| Cambio probado | Motivo/resultado esperado | Resultado real con 25.000 encuentros |
|---|---|---|
| Oro inicial ×1,30 → ×1,305, incluidas anclas | Facilitar recursos iniciales | Optimizador: 1354/1365/1318/422/15650/26; 4865 derrotas y 10011699 acciones. No corrige Penetración y empeora tiempo total. No recomendado como solución general. |
| Oro de Penetración ×27 → ×26 | Cortar realimentación de crecimiento | 2769/2781/2687/717/218/48; 2483 repeticiones, 13297 derrotas, 25113461 acciones. Recupera diferencias de progresión, pero empeora mucho el comportamiento de esta heurística. Candidato a ajustar, no balance definitivo. |

Justificación matemática: un multiplicador de oro `g` compra aproximadamente una multiplicación de estadística `g^(ln(1,15)/ln(1,18))`. Para Penetración, el punto de igualdad es **26,668**. Con 27 resulta **16,168**, superior a ×16 del boss; con 26 resulta **15,661**, inferior. Son aproximaciones asintóticas sin reliquias: la campaña confirma que la diferencia es relevante. Antes de aplicar, conviene probar valores entre 26 y 26,668 y mejorar la elección de combates para no convertir el ajuste en esperas excesivas.

Otra comparación controlada: exigir **1 crítico sobrevivido en lugar de 2**. Activaciones pasan de 57/405 a **136/405**, y derrotas convertidas en victorias de 0 a **1**. Defensivo gana 85 casos frente a 84. Sigue dependiendo del azar y el beneficio es pequeño; no se aplicó silenciosamente. Alternativa estratégica pendiente de probar: cargar también progreso parcial al resistir ataques normales de ese boss, manteniendo el crítico como acelerador. No está implementada ni se afirma eficaz.

No se tocaron las curvas principales de producción. Los valores originales se restauran con `finally` en el proceso aislado del simulador; los archivos de configuración del juego no se escriben.

## 11. Validación técnica

- **19/19 pruebas unitarias aprobadas:** reglas previas, estilos y snapshot, hitos infinitos y retorno a normal, premio único, repetición/recarga, AFK, compatibilidad v2 antigua, condiciones/duración/efectos de todas las Rupturas y métricas de armadura separadas de resistencia/sobre-daño.
- **Chrome aprobado**, sin errores JavaScript: dos destinos principales, personaje, seis cavernas, selección, compras, estilo persistente, resumen, AFK, importación/exportación, migración, bloqueo entre pestañas, primera victoria de hito y repetición sin duplicar. Navegación comprobada a 1440, 390 y 320 px.
- Sintaxis de módulos verificada con `node --check`. Es una web estática, no necesita compilación de producción.
- El diagnóstico anterior `tests/balance.mjs` también termina sin aserciones fallidas. No se usa como prueba de campañas 1.2 porque hace exploración de combates en copias.
- **Pruebas técnicas fallidas al cierre: ninguna. Objetivos de balance no satisfechos:** crecimiento económico avanzado controlado, utilidad decisiva de Ruptura de Crítico y eficiencia temporal del optimizador. No se ocultan tras pruebas de sintaxis exitosas.

## 12. Limitaciones y pendientes

Una semilla por campaña larga, cinco por banco controlado; falta ampliar semillas, estrategias defensivas dedicadas y mediciones con jugadores. Las duraciones son estimaciones bajo el modelo indicado, no tiempo real de uso. La parada de 25.000 encuentros es un presupuesto de prueba, no un límite del juego. Las pruebas de niveles extremos mantienen representación logarítmica; índices siguen sujetos a enteros seguros de JavaScript. El registro de premios crece con los hitos, y localStorage conserva sus límites de capacidad.

Las reliquias mantienen sus fórmulas; en esta versión las enormes cantidades de oro y el reparto de mejoras explican la desviación observada, pero no se ha aislado exhaustivamente la contribución de cada reliquia. No se puede asegurar equilibrio infinito. Los porcentajes de estilos, condiciones avanzadas y multiplicadores de hitos quedan centralizados para iterar sin rehacer el sistema.
