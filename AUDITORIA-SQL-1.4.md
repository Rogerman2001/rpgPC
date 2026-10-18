# Auditoría previa a Supabase — 18/10/2026

No se ha accedido a producción ni integrado en main. La revisión modifica la migración inicial, todavía pendiente de aplicación manual.

## Cambios y conclusiones

- `leaderboard_page` ya utilizaba posiciones absolutas: PostgreSQL evalúa row_number antes de LIMIT/OFFSET. Se documenta expresamente para evitar sumar el offset dos veces. Ahora rechaza offset NULL, además de offsets negativos, fuera de rango o no múltiplos de 100. Las páginas no son una instantánea entre peticiones: si cambian puntuaciones durante la navegación, pueden moverse jugadores; refrescar empieza una nueva consulta.
- El validador del sobre ahora rechaza campos ausentes y SQL NULL mediante `IS DISTINCT FROM`. También exige format como número JSON, coherente con el cliente. Antes, una comparación con NULL podía dejar pasar un sobre incompleto.
- Propietario de las dos tablas y nueve funciones fijado a `postgres`, rol administrativo de confianza del SQL Editor. Ningún cliente debe poseer, heredar o poder asumir ese rol. No se crea ningún rol con contraseña ni se conceden permisos sobre auth a clientes.
- Se revocan permisos de tablas también a PUBLIC, además de anon/authenticated. Solo authenticated recibe SELECT, sujeto a RLS de cuenta propia. Sin escrituras directas.
- Las cinco RPC de cuenta/ranking son SECURITY DEFINER con search_path vacío y nombres de objetos cualificados. Comprobación de auth.uid en cada entrada; las escrituras comprueban además identidad Google y coincidencia de cuenta. Su propietario puede saltarse RLS: por eso los filtros explícitos de cuenta son imprescindibles. No hay SQL dinámico.
- `is_google_player` es auxiliar SECURITY DEFINER; validación, entero seguro y poder son SECURITY INVOKER. Las cuatro auxiliares siguen en public pero **sin EXECUTE para PUBLIC, anon ni authenticated**. Estar en un esquema expuesto no concede permiso de ejecución. Solo las cinco RPC previstas reciben EXECUTE para authenticated; anon no ejecuta ninguna. Revocación y creación son una misma transacción. No conceder EXECUTE a todas las funciones de public posteriormente.
- Los clientes reciben exclusivamente nombres/poder/posición/fecha y marcadores públicos en ranking; nunca UUID o guardados ajenos. Las lecturas privadas se limitan a la cuenta propia.
- `verified=false` continúa impuesto por CHECK y en ambas respuestas de ranking; la UI ya muestra «Puntuaciones provisionales, no verificadas». Calcular poder en servidor no impide editar niveles válidos en el cliente. Estas medidas protegen cuentas y consistencia, **no son antitrampas**.
- El límite seguro v2 permanece intencional. El diagnóstico y diseño compatible v3 están en `NUMERIC_MIGRATION.md`; no se ha activado un motor BigInt/decimal ni cambiado las partidas existentes.

## Pruebas reproducibles

`npm run test:database`: PostgreSQL embebido mediante PGlite, base efímera nueva, roles anon/authenticated y fixture local auth.uid/identidades. Ejecuta SQL real, no un mock del motor. Comprueba migración desde cero y repetición vacía/poblada, 252 jugadores, puestos 1–100 / 101–200 / 201–252, desempates, my_rank, página vacía y parámetros inválidos; RLS, permisos de tablas/funciones, propietario y search_path, denegación de auxiliares, identidad y cuenta, sobres inválidos, revisión CAS exacta superior a 2^53 y marcador no verificado. El fixture no sustituye Google OAuth ni PostgREST.

`npm test`: pruebas del juego/nube y fronteras de precisión del formato actual. No se requieren cambios de interfaz para esta revisión.

Resultado de esta revisión: **98 comprobaciones PostgreSQL y 30 pruebas JavaScript aprobadas**, sin errores SQL. Se ejecutaron los scripts con el Node local del entorno. Las pruebas incluyen incremento exacto de un numeric de 256 dígitos como comprobación de capacidad para el diseño v3; esto no significa que el motor actual acepte esos niveles.

## Aplicación manual

Preparada para aplicación manual **con guardados v2 y sus límites documentados**, ejecutando el SQL completo como postgres en un esquema nuevo o en el esquema compatible generado por este archivo. La transacción debe confirmar íntegra. No es una certificación del proyecto alojado ni habilita progresión exacta ilimitada.

Antes de aplicar, revisar objetos homónimos, políticas y concesiones existentes: CREATE IF NOT EXISTS no reconcilia esquemas ajenos. En una instalación previamente modificada, políticas adicionales, grants a otros roles o sobrecargas antiguas requieren auditoría específica. Tras aplicar en un proyecto Supabase de pruebas, verificar dos cuentas Google y peticiones REST/RPC reales; anon debe recibir denegación, las auxiliares no deben ser ejecutables y authenticated solo debe leer su propia partida. No exponer service_role/secret keys. Revisar propietarios y pertenencia de roles en el proyecto real; no modificar esos roles desde el cliente.

El máximo actual de navegación es offset 10000; my_rank sigue disponible fuera de esas páginas. Las pruebas locales no verifican configuración de esquemas expuestos, caché PostgREST, OAuth, límites de servicio ni grants ajenos del Supabase del propietario.

Referencias: [seguridad de funciones PostgreSQL](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY), [límites numeric](https://www.postgresql.org/docs/current/datatype-numeric.html).
