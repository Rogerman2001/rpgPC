# Progresión extrema: diseño de guardado v3

Estado: diseño compatible, **no activado en 1.4**. La migración SQL actual acepta exclusivamente v2. No aumentar `valid_game_integer` sin sustituir también el motor numérico. La versión 1.4 no garantiza niveles ilimitados ni precisión matemática ilimitada.

## Diagnóstico

`Number` representa exactamente enteros hasta 9007199254740991. `save.js`, `bosses.js`, `combat.js` y `upgrades.js` dependen de ese contrato. `BigInt` permite contadores exactos mayores, pero no se serializa directamente con JSON ni admite `Math.log10`. Convertirlo después a Number volvería a perder precisión.

`Huge` evita materializar magnitudes como 10^100000, pero almacena su logaritmo en binary64. A medida que aumenta el exponente, pierde resolución: sumar el incremento de una mejora puede dejar de cambiar el resultado. No basta con cambiar los contadores. Oro, costes, daño, vida, defensa, poder y bonos heredados requieren aritmética decimal logarítmica de precisión configurable. Los logaritmos son aproximaciones; no se puede prometer exactitud absoluta de esas magnitudes.

PostgreSQL `numeric` conserva enteros grandes, pero tiene límites: hasta 131072 dígitos enteros y 16383 decimales sin precisión declarada. Tampoco es infinito. Referencia: https://www.postgresql.org/docs/current/datatype-numeric.html

## Contrato propuesto

- Sobre `format: 2`, `numeric_encoding: "decimal-log-v1"`; `payload` sigue siendo una cadena JSON. Estado `version: 3` y versión de reglas independiente.
- Todos los contadores persistentes como cadenas decimales canónicas: `"0"` o `[1-9][0-9]*`. Incluye niveles de mejoras/reliquias, highest/next/wins/repeats, combatSeq, pending.token/level y todos los índices de hitos. Nada de exponentes, signo positivo, ceros iniciales o números JSON para esos campos.
- En memoria: BigInt para contadores. En SQL: validar tipo string, expresión regular y longitud antes de convertir a numeric. Propuesta inicial: 256 dígitos por contador como límite de recursos explícito y ampliable; supera ampliamente binary64 sin aceptar entradas arbitrariamente costosas.
- Magnitudes: `{ "log10": "12345678901234567890.123456789" }`; cero: `{ "log10": null }`. El logaritmo admite signo negativo; no admite NaN/Infinity. Serialización decimal canónica, nunca conversión intermedia a Number. Igual representación para bonos logarítmicos heredados.
- Precisión de cálculo: al menos `max(dígitos enteros de los logaritmos operados, dígitos de los contadores) + 50` dígitos significativos. Usar una biblioteca decimal mantenida y evaluada con logaritmos, exponenciales y redondeo explícito. Escalar también la precisión de las constantes log(growth), no precalcularlas con Math.log10.
- Comparaciones y compras usan esa misma precisión y regla de redondeo en cliente y servidor. Sumas/restas logarítmicas con guardas para cancelación; nunca redondear oro hacia arriba al pagar. Solo la presentación puede redondear. La garantía es contadores exactos y error controlado en magnitudes, no aritmética real exacta.
- En PostgreSQL mantener `power_log numeric`, sin convertir a double para ordenar. Calcular con escala suficiente de operandos; verificar la precisión efectiva de log/power con vectores compartidos. El rango de 256 dígitos cabe en numeric. Orden por poder y UID como desempate, posiciones y revisiones como texto.
- Compras máximas por búsqueda acotada sobre BigInt, sin un bucle por nivel; procesamiento de hitos mediante intervalos/resúmenes versionados, no arrays que crezcan hasta el nivel alcanzado. Limitar trabajo por turno y tamaño del documento.

## Migración compatible, sin recompensas duplicadas

1. Conservar el sobre original y su revisión en un respaldo descargable. Para v1, ejecutar primero el migrador existente v1 → v2; conservar su `migration.source` intacto. Validar completamente v2 antes de convertir.
2. Clonar el estado, conservando propiedades desconocidas. Convertir solo los campos enumerados de contadores: comprobar `Number.isSafeInteger(n)` y después `BigInt(n).toString()`. Rechazar un número inseguro: no es posible recuperar sus dígitos originales tras redondearlo. No convertir automáticamente toda cadena numérica del documento.
3. Convertir cada logaritmo binary64 finito mediante `n.toString()` a decimal; `gold:null` sigue representando cero. Esto conserva el valor serializado, no recupera precisión histórica perdida. Guardar el original para auditar y poder volver atrás. No recalcular victorias, drops ni recursos durante la conversión.
4. Validar v3 e invariantes exactas (`next=highest+1`, `wins=highest+repeats`, nivel de reliquia, hitos), pausar AFK y tratar combates pendientes según la política de recuperación existente. No devolver el coste ya cobrado ni conceder una victoria pendiente.
5. Una migración SQL posterior ampliará `save_version` a 2/3 y añadirá validadores separados. El servidor aceptará v2 mientras existan clientes antiguos, y calculará poder con la fórmula correspondiente a cada versión. La primera escritura v3 será CAS sobre la revisión leída, actualizando documento, save_version, revisión y poder atómicamente. Si falla, el original queda intacto.
6. Una fila convertida a v3 rechazará escrituras v2 aunque tengan revisión vigente. Los clientes 1.4 deben mostrar incompatibilidad y ofrecer exportación; nunca crear una partida vacía ni degradar silenciosamente. No hacer migración masiva destructiva. Rollback: restauración explícita del respaldo anterior con nueva revisión, advirtiendo que descarta progreso posterior; no convertir contadores grandes a Number.

## Condiciones para activar v3

Migrar conjuntamente numbers/save/upgrades/bosses/items/combat/strategy, hitos, AFK, nube, importación/exportación y UI; eliminar conversiones Number de contadores. Añadir vectores JS/PostgreSQL en 2^53−1, 2^53, 2^53+1 y contadores de 256 dígitos; incrementos consecutivos distintos, compra/pago sin creación de oro, operaciones entre magnitudes próximas, ranking de poderes próximos y todos los caminos v1/v2/v3. Probar CAS y rechazo de downgrade entre dispositivos. No habilitar el nuevo validador hasta superar estas pruebas.

La validación numérica y estructural no acredita que el progreso se haya ganado. Tanto v2 como v3 permanecen **no verificadas** mientras el cliente controle la progresión.
