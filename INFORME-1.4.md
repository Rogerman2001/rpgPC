# CavernaBURX 1.4 — Entrega revisable

## Implementación

Rama local `codex/cavernaburx-1-4`, sin integración en main ni despliegue. Se conserva el motor 1.3: no se han cambiado curvas, economía, reliquias, hitos, definitivas ni fórmulas de combate.

- `js/bootstrap.js`: SDK oficial Supabase, Google PKCE, sesión validada, perfil obligatorio, comparación de partidas, recuperación, cierre de sesión y ranking.
- `js/cloud-sync.js`: respaldos por UID, debounce, escrituras serializadas, revisiones como texto, conflictos explícitos, reintentos y protección frente a respuestas de una cuenta anterior.
- `js/cloud-data.js`: representación versionada que conserva el JSON original, validación, nombres y fórmula compartida de Poder Total.
- `js/account-context.js`: el juego solo obtiene un estado después del flujo autenticado.
- `js/combat-statistics.js`, `js/app.js`: estadísticas reales y efectivas durante las definitivas; guardado de cuenta y pausa ante conflicto.
- `index.html`, `account.css`: acceso, onboarding, nombre del personaje, estado de nube y Clasificación responsive.
- `supabase/migrations/202610180001_accounts.sql`: perfiles, partidas, RLS, validadores, control de concurrencia y ranking calculado en servidor. Sin borrados destructivos.
- `scripts/build.mjs`, `package.json`, `package-lock.json`, `.env.example`, `vercel.json`, `server.js`: compilación estática con esbuild, SDK oficial, configuración pública y servidor local que sirve dist.
- `tests/cloud.test.js`, `tests/database.test.mjs`, `tests/accounts-browser.mjs`: nuevas pruebas. El portátil 1.3 y sus pruebas permanecen separados y fuera del despliegue 1.4.

## Decisiones y seguridad

La nube no se interpreta como vacía ante un error. Una nueva partida solo se crea tras confirmar ausencia de registro. Las copias antiguas quedan intactas; las decisiones de reemplazo son explícitas y no fusionan monedas ni conceden recompensas. Se utiliza el UUID autenticado, no el nombre, como identidad estable.

Las escrituras requieren identidad Google real, UID coincidente con la sesión y revisión esperada. Cambiar de cuenta oculta el juego, cancela trabajo y reinicia la entrada. El UUID que acompaña una escritura solo detecta cambios de sesión: la función siempre actúa sobre `auth.uid()`. Los clientes no pueden actualizar perfiles, puntuaciones, posiciones ni partidas por acceso directo a tablas.

Los nombres se validan también en PostgreSQL, con unicidad insensible a mayúsculas. El ranking solo expone nombre, posición, poder, fecha e indicador propio; nunca UID, email o datos privados. Se calcula a partir del estado aceptado, pero **es provisional y no verificado** porque el cliente todavía controla el progreso.

No se introduce una representación que materialice 10 elevado a exponentes enormes. Se conserva el JSON v2 como cadena dentro del documento versionado; PostgreSQL ordena logaritmos NUMERIC. Esto preserva la precisión ya disponible en el motor, no convierte el juego en aritmética exacta ilimitada.

## Pruebas ejecutadas

- **29 pruebas de Node superadas:** las 23 anteriores más seis de nube, números, cola, desconexión, conflictos, cambio de cuenta y estadísticas.
- **34 comprobaciones PostgreSQL/PGlite superadas:** migración repetida, permisos anónimos, RLS entre cuentas, unicidad de nombre, reserva de nombres, inmutabilidad de perfiles, rechazo de escritura de puntuación, validación, revisión CAS, payload íntegro, empates, magnitudes altas, revisiones superiores a 2^53, páginas de 100 y posición fuera de las 100 primeras.
- **Suite de navegador de cuentas superada con contratos HTTP simulados:** acceso sin sesión, redirección Google solicitada, cancelación, perfil obligatorio, nombre duplicado, migración local, combate y compra, persistencia, ranking, 390/320 px, reintento offline, conflicto, bloqueo de otra pestaña, cierre, aislamiento entre cuentas, estadísticas avanzadas y lectura de nube fallida sin sobrescritura. SDK real; respuestas de autenticación y base de datos interceptadas en el contexto aislado de test. No es una prueba del proyecto Supabase alojado.
- **Suite histórica 1.3 de navegador superada** sobre `CavernaBURX.html`: combate, definitivas, consejero, AFK, copias y migración. No se presenta como validación del acceso 1.4.
- **Compilación estática ejecutada** con configuración ausente y con configuración ficticia interceptada para tests. La primera cierra el acceso sin tocar copias; la segunda permite probar contratos sin cuentas reales.

Durante las pruebas se corrigió una regresión visual: faltaba actualizar los botones de combate al bloquear la partida por conflicto. También se corrigieron supuestos de las pruebas sobre revisiones y acceso a almacenamiento en documentos sin origen. No se han atribuido esos errores a Supabase.

## Límites y pendientes

1. **Activación externa pendiente.** No se han ejecutado migraciones en Supabase del propietario ni configurado variables/OAuth/Vercel. Debe realizarse [SUPABASE_SETUP.md](SUPABASE_SETUP.md) antes de integrar y publicar.
2. **OAuth real pendiente.** No se han utilizado credenciales personales, ni validado usuarios de prueba de Google o continuidad en dos dispositivos físicos. Tampoco se han probado Safari/Firefox ni políticas específicas del proyecto alojado.
3. **Competición no autoritativa.** RLS protege acceso y la puntuación se deriva en SQL, pero las estadísticas propias siguen siendo manipulables. Falta validar acciones en servidor para un ranking verificado.
4. **Concurrencia sin fusión automática.** PC y móvil pueden divergir; se detiene al detectar una revisión incompatible y se permite elegir conservando copias. AFK queda pausado tras la entrada. Una pestaña por cuenta y origen necesita Web Locks.
5. **Respaldo local y cuotas.** Cerrar sin confirmar puede dejar progreso solo en ese dispositivo. Se advierte y permite exportar. Borrar sus datos antes de sincronizar puede perder los cambios pendientes.
6. **Escala.** Ranking limitado a lecturas de 100 filas y offsets acotados, con índices; la posición individual puede recorrer muchas entradas. No se ha realizado prueba de carga ni configurado rate limiting del servicio.
7. **Compatibilidad de números.** Continúan los límites de enteros seguros para niveles y la precisión aproximada logarítmica de 1.3. El documento de nube es extensible, pero nuevas reglas/inventarios requerirán migraciones versionadas.

## Ejecución y revisión

Con Node 22.12+ y npm: `npm ci`, configurar `.env.local`, `npm run build`, `npm start`. Las pruebas de lógica son `npm test` y `npm run test:database`. El navegador requiere Playwright y Chrome; sus instrucciones están en README.

El siguiente paso del propietario es activar y probar en un entorno autorizado siguiendo **SUPABASE_SETUP.md**, y después aprobar la integración en main. No hay un enlace 1.4 de producción nuevo que se haya publicado desde esta tarea.
