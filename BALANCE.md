# Balance histórico 1.1 — seis bosses

Este documento describe la versión anterior a estilos, Rupturas e hitos. Los resultados actuales están en `INFORME-1.2.md` y `tests/simulation-results.json`. No usar sus cifras como validación de la versión 1.2.

Ejecutar `npm run test:balance` reproduce los datos de `tests/balance-results.json` usando las funciones reales de combate, recompensas, objetos y compras. Las cifras siguientes corresponden a la configuración entregada; no constituyen validación exhaustiva de todos los niveles y estrategias.

## Curvas

Estadística = base × 1,26^(ancla − 1) × crecimiento^(nivel − 1).

| Boss | Base vida / ataque / defensa | Ancla | Crecimiento vida / ataque / defensa | Crecimiento oro |
|---|---|---:|---|---:|
| Ataque | 48 / 10 / 1 | 1 | 1,26 / 1,26 / 1,25 | 1,30 |
| Defensa | 65 / 6 / 7 | 1 | 1,26 / 1,25 / 1,27 | 1,30 |
| Vida | 100 / 5 / 2 | 1 | 1,27 / 1,25 / 1,25 | 1,30 |
| Crítico | 60 / 8 / 1 | 55 | 2,4 / 2,4 / 2,3 | 2,8 |
| Penetración | 65 / 9 / 3 | 165 | 16 / 16 / 15 | 27 |
| Vampirismo | 75 / 10 / 3 | 380 | 100000 / 100000 / 90000 | 800000 |

El gran multiplicador por nivel de Vampirismo es intencionado: cada nivel representa un salto considerable de poder, mientras las mejoras cuestan un 18% más por nivel y solo aumentan la estadística un 15%. No se fuerzan ratios de niveles, ni se limita la cantidad alcanzable. Las recompensas de reliquias siguen siendo pequeñas y acumulativas; los multiplicadores enormes son dificultad/oro, no bonus de objeto.

Oro = 28 × 1,30^(ancla − 1) × crecimientoOro^(nivel − 1). Repetir entrega 80%, sin endurecer el boss. AFK entrega 5% del modo elegido y cobra 0,5% de la base al iniciar.

## Simulaciones de campaña

El agente de prueba comienza con 35 oro, compra sucesivamente la mejora más barata y busca desafíos vencibles sin críticos del jugador en una copia del combate. Si no puede avanzar, repite el guardián vencible de mayor recompensa. Las victorias reales usan RNG determinista. Esta selección conservadora tiene información perfecta y no representa a un jugador que desconoce la dificultad.

- Tres semillas (11, 22, 33), rotando los iniciales: Ataque 387, Defensa 392 y Vida 380; 1159 primeras victorias, 1854 mejoras y ninguna repetición necesaria. Entre 201005 y 201615 acciones. Todos los avanzados quedan desbloqueados por los hitos reales.
- Campaña centrada exclusivamente en Ataque hasta 100: 100 primeras victorias, 61 repeticiones, 469 mejoras y 1529 acciones. Farmeo útil y progresión posible, sin recibir niveles de objeto por repetir.
- Distribución equilibrada hasta los tres niveles 100: 300 victorias, 0 repeticiones, 4164 acciones.
- Inversión solo en ataque hasta al menos 100 en los tres: 309 victorias, 216 repeticiones, 711 acciones. Se detecta ventaja de velocidad del primer golpe; véanse pendientes.

La primera configuración probada (oro ×1,29) exigía 1954 repeticiones y más de 2,1 millones de acciones para alcanzar el hito 380. Se aumentó a ×1,30 para corregir ese cuello de botella, manteniendo costes y estadísticas de mejoras. Rotar tres fuentes de oro evita farmeo en el tramo probado; centrarse en una sí lo necesita. No se afirma que siempre haya que farmear.

Desde la campaña real de nivel ~380, enfrentarse a cada avanzado y reinvertir su oro hasta la primera derrota permite 89 niveles de Crítico, 19 de Penetración y 1 de Vampirismo. Los tres llegan a una barrera; no apareció un bucle de oro que permitiera seguir indefinidamente. Crítico tiene muchos niveles recuperables porque se omite hasta bastante después de su desbloqueo.

## Dificultad medida en combates

Búsqueda del nivel común de mejoras de Ataque/Vida/Defensa necesario para vencer, sin bonus de reliquias ni legado, ejecutando encuentros completos con RNG fijo. Es un banco de prueba de dificultad; estos personajes no se presentan como partidas obtenidas por economía normal.

| Boss | Mejoras para nivel 1 | Para nivel 2 | Para nivel 10 |
|---|---:|---:|---:|
| Ataque | 0 | 0 | 11 |
| Defensa | 0 | 1 | 14 |
| Vida | 0 | 0 | 12 |
| Crítico | 86 | 93 | 143 |
| Penetración | 270 | 289 | 447 |
| Vampirismo | 626 | 708 | 1367 |

Equivalencias: Ataque nivel 55 requiere 86 mejoras, igual que Crítico 1; Ataque 165 necesita 267 frente a 270 de Penetración 1; Ataque 380 necesita 623 frente a 626 de Vampirismo 1. Con otras cinco semillas, los avanzados de nivel 1 requieren respectivamente 85–86, 269–270 y 626 mejoras. La aleatoriedad crítica se mantiene.

Con un personaje fijo con 1000 mejoras por estadística, sin comprar más pero recibiendo las reliquias reales de sus victorias, se alcanzan 614/617/594 niveles de Ataque/Defensa/Vida, 146 de Crítico, 37 de Penetración y 5 de Vampirismo. Las curvas crean diferencias sustanciales sin imponer límites. Las reliquias no producen una escalada autosuficiente en este escenario.

## Pendientes y límites conocidos

1. **Ventaja ofensiva por iniciativa.** Invertir solo en ataque gana muchos encuentros de un golpe, más rápido que equilibrar estadísticas, aunque necesita más repeticiones. No demuestra dominio universal: se compararon los iniciales hasta 100. Propuesta para la siguiente iteración: medir también tiempo de interacción y AFK, ajustar vida/armadura base de guardianes y valor de las mejoras defensivas. No se añadió una represalia ni daño obligatorio, porque cambiaría la regla de que el enemigo solo responde si sobrevive.
2. **Encuentros largos a niveles altos.** La campaña equilibrada hasta 380 promedia ~174 acciones por victoria, unas 28 s a ×4, con encuentros más largos cerca de las barreras. Propuesta: revisar crecimiento de vida de Defensa/Vida y su regeneración, o añadir mayor velocidad de visualización; no eliminar su especialización. Límite técnico actual: 2000 acciones, consideradas derrota sin recompensa.
3. **Grandes saltos de Vampirismo.** El crecimiento exigente consigue pocos niveles, pero podría sentirse demasiado abrupto. Propuesta: contrastar ×100000 con ×10000 en campañas prolongadas, manteniendo la recompensa por nivel del objeto y recalibrando oro.
4. **Escala infinita no significa equilibrio probado infinito.** Las campañas reales cubren hasta ~380 iniciales y benchmarks más altos. Las curvas independientes pueden divergir a decenas de miles de niveles. Hace falta simular más estrategias y datos de juego antes de afirmar que esos tramos están equilibrados.
5. **Legado v1.** Mantener el poder antiguo puede adelantar la nueva progresión de partidas veteranas. No se confunde con balance de partidas nuevas; el bonus es fijo y el original permanece recuperable.
6. **AFK y 24h/1h.** Conserva los porcentajes provisionales. La diferencia de duración entre bosses, las pausas y la limitación del navegador impiden asegurar una equivalencia horaria exacta.

No se simulan estados elementales, guardianes secundarios, cuentas, nube ni producción offline.
