# CavernaBURX 1.4 — Activación manual de cuentas y nube

Actualización de sincronización: véase [SINCRONIZACION-1.4.md](SINCRONIZACION-1.4.md). La nube se carga automáticamente; la recuperación solo aparece ante cambios pendientes divergentes o restauración explícita. No requiere SQL adicional ni nuevas variables.

La implementación está preparada en `codex/cavernaburx-1-4`. **No se ha conectado ni modificado el Supabase, Google Cloud o Vercel del propietario. No se ha desplegado ni integrado en main.** No publiques hasta completar la validación real de este documento. La producción 1.3 puede seguir funcionando mientras se prepara una vista previa.

## 1. URL y clave pública — propietario

En el proyecto **CavernaBURX**, localiza la Project URL en Settings → API / API Settings y la clave **publishable** en Settings → API Keys. Una clave `sb_publishable_…` está destinada al cliente; también se admite la clave heredada `anon`. Nunca uses `sb_secret_…`, `service_role`, contraseñas PostgreSQL ni el Client Secret de Google. El compilador rechaza claves secretas conocidas y JWT que no tengan rol `anon`. [Documentación oficial de claves](https://supabase.com/docs/guides/getting-started/api-keys).

No tienes que enviar secretos al asistente. La URL y la clave pública se colocan en tu entorno local y en Vercel. Se incorporan al JavaScript público al compilar; su seguridad depende de los permisos y las funciones SQL.

## 2. Preparar el entorno local — propietario

Requiere Node 22.12+ y npm. Copia `.env.example` a `.env.local` y rellena:

```dotenv
VITE_SUPABASE_URL=https://TU_REFERENCIA.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICA
```

```sh
npm ci
npm run build
npm start
```

Abre `http://localhost:4173/`. El servidor solo sirve **dist/**. Para cambiar el puerto en PowerShell: `$env:PORT='4174'` antes de `npm start`. Autoriza ese origen por separado. `npm run dev` recompila y arranca; no incluye vigilancia automática de archivos.

Sin variables la compilación funciona, pero el acceso queda cerrado con una explicación. No existe modo invitado. No sirve abrir `index.html` con doble clic: OAuth y los módulos compilados necesitan HTTP(S). `CavernaBURX.html` se conserva como artefacto histórico 1.3 y **no se copia a dist ni se publica**.

## 3. Ejecutar la migración — propietario

Revisión previa: consulta [AUDITORIA-SQL-1.4.md](AUDITORIA-SQL-1.4.md) y [NUMERIC_MIGRATION.md](NUMERIC_MIGRATION.md). La migración actual conserva el formato v2 y su límite de enteros seguros; la ampliación exacta requiere el futuro motor v3. Ejecuta el archivo completo como `postgres`, propietario explícito de tablas y funciones. Las auxiliares no deben recibir EXECUTE de clientes aunque residan en `public`.

Antes de cambiar la base de datos, revisa las tablas existentes y conserva una copia si ya hay datos. En Supabase → SQL Editor, abre una consulta nueva y ejecuta **completo**:

`supabase/migrations/202610180001_accounts.sql`

La transacción crea dos tablas, índices, RLS y funciones. No elimina partidas. Puede repetirse contra su propio esquema; si ya existe una estructura incompatible con esos nombres, detente y revisa el error, no borres las tablas para continuar. No ejecutes `tests/database.test.mjs` contra producción: utiliza su propio PostgreSQL embebido local.

## 4. Tablas y permisos creados

| Objeto | Contenido y acceso |
|---|---|
| `player_profiles` | UID interno, nombre permanente y fecha. Un perfil por UID; índice único sobre `lower(username)`. Lectura directa solo del propietario. Sin INSERT/UPDATE/DELETE directos para clientes. |
| `player_saves` | Documento íntegro, versión, revisión, fechas, poder logarítmico y `verified=false`. Lectura directa solo del propietario. Sin escrituras directas. |
| `register_player(text, uuid)` | Valida UID autenticado y que tenga identidad Google; registra nombre una sola vez. El UUID solicitado es una comprobación de sesión, nunca una autorización. |
| `read_player_save()` | Devuelve solo la partida propia; revisión como texto para evitar redondeo de bigint. Devuelve null únicamente si no existe. |
| `commit_player_save(jsonb,text,uuid)` | Valida cuenta, esquema y revisión; guarda partida y calcula poder en una misma transacción. No acepta puntuación ni posición del cliente. |
| `leaderboard_page(integer)` | 100 resultados públicos por página, solo autenticados; sin UID, email ni datos privados. Offset 0…10000 en pasos de 100. |
| `my_rank()` | Posición propia aunque quede fuera de esas páginas. |

Los helpers de validación/poder no son ejecutables directamente por `anon` o `authenticated`. Las funciones `security definer` fijan `search_path=''`, cualifican objetos y comprueban identidad. RLS protege lecturas; los permisos y RPC protegen escrituras y revisión. [Funciones](https://supabase.com/docs/guides/database/functions) y [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 5. Verificar RLS — propietario

En SQL Editor, estas consultas son de lectura:

```sql
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('player_profiles','player_saves');
select tablename, policyname, roles, cmd, qual
from pg_policies where schemaname='public'
and tablename in ('player_profiles','player_saves');
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('player_profiles','player_saves')
and grantee in ('anon','authenticated');
```

Ambas tablas deben tener RLS activo. `authenticated` tiene SELECT, filtrado al propietario; `anon` no tiene acceso. No concedas INSERT, UPDATE o DELETE para hacer desaparecer un error de sincronización.

La prueba local `npm run test:database` verifica con PostgreSQL real embebido los roles, las funciones y los conflictos. En el proyecto alojado, comprueba también con dos cuentas Google de prueba que cada una carga su partida y que una petición directa de la cuenta A a los registros de B no devuelve datos. SQL Editor normalmente opera con privilegios elevados: consultar allí no demuestra que RLS funcione para un navegador.

## 6. Google OAuth — propietario

En Supabase Authentication → Providers, conserva Google habilitado con las credenciales ya configuradas. No copies su secreto al repositorio. Deshabilita proveedores de contraseña/email y acceso anónimo si no se utilizan. La interfaz solo inicia Google y la escritura SQL exige una identidad Google real en `auth.identities`.

En Authentication → URL Configuration:

- Site URL: `https://cavernaburx.vercel.app`
- Redirect URL explícita: `https://cavernaburx.vercel.app/`
- Desarrollo: `http://localhost:4173/` y, si lo usas, `http://localhost:4174/`.
- Si abres `127.0.0.1`, añade exactamente `http://127.0.0.1:4173/`; es un origen diferente.
- Para preview, añade su URL concreta con `/`, y retírala cuando ya no se necesite. Evita comodines amplios.

La aplicación usa PKCE y vuelve a la raíz del origen desde el que se inició. En Google Cloud, el **Authorized redirect URI** sigue siendo el callback de Supabase `https://TU_REFERENCIA.supabase.co/auth/v1/callback`, no el dominio del juego. Revisa los orígenes JavaScript autorizados indicados por el proveedor. [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [URLs permitidas](https://supabase.com/docs/guides/auth/redirect-urls).

## 7. Google en modo Testing — propietario

En Google Cloud → Google Auth Platform / OAuth consent screen → Audience, comprueba si la aplicación sigue en Testing. Añade las cuentas que harán las pruebas en Test users. Si Google bloquea a un usuario, revisa esta lista antes de cambiar código o desactivar controles de Supabase. No cambies a producción pública hasta revisar el consentimiento y los requisitos aplicables del proveedor.

## 8. Vercel — propietario, después de las pruebas

Se entrega `vercel.json`: proyecto estático, compilación `npm run build`, salida `dist`. **server.js es solo para desarrollo; no se despliega como servidor persistente.** Instala dependencias con `npm ci` y utiliza Node 22.12+ o 24.

En Project Settings → Environment Variables añade las dos variables públicas anteriores a **Preview** para la validación y después a **Production** al aprobar la versión. Los cambios de variables requieren una nueva compilación. Revisa que no haya overrides antiguos que sirvan la raíz del repositorio o eviten el build.

No publiques la compilación de tests con URL `https://testing.supabase.co`. Es un destino ficticio que solo funciona interceptado por Playwright. No contiene una conexión real. [Entornos de Vercel](https://vercel.com/docs/environment-variables).

El propietario debe aprobar la integración en `main` después de probar la preview. No se ha hecho push, merge ni despliegue en esta tarea.

## 9. Autenticación y persistencia reales — propietario

1. Abre preview/local sin sesión: solo debe aparecer «Continuar con Google».
2. Cancela una autorización: no debe aparecer el juego ni crearse una partida vacía.
3. Inicia sesión. Si no hay perfil, crea un nombre y comprueba su persistencia al cerrar y volver a abrir.
4. Completa un combate, compra una mejora y espera **Guardado** en la cabecera. «Respaldo local actualizado» no es una confirmación de nube.
5. Cierra sesión y vuelve a entrar. Abre la misma cuenta en otro dispositivo y comprueba oro, niveles, reliquias y estilo.
6. Interrumpe la conexión después de entrar; realiza un cambio. Debe quedar respaldo pendiente. Recupera conexión y espera confirmación.
7. Usa PC y móvil simultáneamente, modifica ambos: uno podrá guardar y el otro mostrará conflicto. Exporta las copias y elige explícitamente al volver a entrar. No se fusionan recursos.
8. Intenta cerrar sesión con pendientes: debe advertirse. Si decides salir, el respaldo queda asociado a esa cuenta en ese navegador.

Hay debounce de 1,2 segundos, un escritor por cuenta/pestaña, comprobación de revisión en PostgreSQL y reintentos de 5 a 60 segundos. Las peticiones RPC tienen plazo de 15 segundos. Un acuse perdido puede producir un conflicto aunque la escritura se haya confirmado: se abre recuperación excepcional con archivo de ambas versiones y confirmación. No se promete sincronización en tiempo real ni progreso offline.

## 10. Migración de partidas — propietario

- **Misma URL que 1.3:** se detectan `cavernaburx.save.v2` y v1; la copia original nunca se elimina ni sobrescribe por el guardado de cuenta.
- **Partida en HTML local o localhost:** exporta JSON desde 1.3. El navegador no comparte almacenamiento entre archivo, localhost y producción. Tras entrar en 1.4 usa Partida → Importar JSON, confirma el reemplazo y espera Guardado.
- Solo local: se ofrece importarla, cancelar o crear una nueva. Solo nube: se recupera. Ambas: se carga la nube automáticamente si la local está confirmada; solo se comparan copias si hay cambios pendientes divergentes. Sin ninguna: se crea solo después de una lectura de nube correcta.
- Al importar una copia sin propietario se exige confirmar que es tuya. Tras la primera importación confirmada se registra la cuenta propietaria local; no se ofrece a otras cuentas.
- Antes de sustituir nube se permite exportarla y se conserva una copia por revisión en el navegador. Los respaldos de cuenta usan `cavernaburx.account.<UID>`, separados de las claves antiguas.
- Una copia dañada se puede descargar y cancelar. Si decides continuar, se conserva el original antes de reemplazar el respaldo. Una nube incompatible bloquea el acceso: no se crea una partida nueva para ocultar el error.
- Se conserva la migración v1 del motor. Importar reemplaza el estado validado; no concede de nuevo recompensas ni suma inventarios.

AFK empieza pausado tras entrar y los combates parciales se abandonan, conservando el coste ya cobrado. Esta decisión evita que dos dispositivos continúen automáticamente la misma expedición mientras se resuelve una elección de partida.

## 11. Nombres — propietario

Prueba un nombre de 3–20 caracteres, letras ASCII A–Z/a–z, números o `_`. No se recortan espacios silenciosamente. `BURXMaster` y `burxmaster` compiten por el mismo índice único; solo uno puede registrarse incluso con peticiones simultáneas. Admin, Administrator, Moderator, Support y CavernaBURX se reservan sin distinguir mayúsculas. No hay cambio de nombre. No se toman nombres completos, email ni fotos de Google para mostrarlos públicamente.

Comprueba el nombre en Personaje, junto a la vida del protagonista y en Clasificación. Una respuesta de red fallida durante el registro no debe dejar entrar sin perfil; repetir la petición recupera el perfil si ya se había creado.

## 12. Ranking y números enormes — propietario

Comprueba los 100 primeros, las páginas siguientes, tu fila y tu posición individual. La ordenación SQL usa `power_log NUMERIC DESC, user_id ASC`: el UID desempata, pero nunca se devuelve públicamente. Cada guardado actualiza partida y poder de forma atómica. Los resultados muestran cuándo se consultaron y tu última fecha de guardado; pulsa Actualizar para refrescar.

Se reutiliza `10 × ataque + vida + 10 × defensa`, con estilo y reliquias permanentes una sola vez, sin definitivas. SQL reproduce esa fórmula en logaritmos; no se convierte el poder completo a un double ni se ordena por texto formateado. En UI, convertir **el logaritmo** a la representación `Huge` existente solo sirve para mostrarlo. Puede haber redondeo respecto a PostgreSQL en los últimos dígitos.

El documento de nube tiene `format=1`, `numeric_encoding='log10-binary64-v1'` y el JSON v2 íntegro como **cadena payload**. Esto mantiene exactamente las cifras serializadas por 1.3, las futuras propiedades y la copia de migración sin una conversión numérica adicional de JSONB. Los niveles continúan limitados a enteros seguros del motor y las magnitudes son aproximaciones logarítmicas, como antes; no se promete precisión matemática ilimitada. Las revisiones/posiciones viajan como cadenas. Se valida un máximo de 20 MiB de payload; cuotas de navegador y límites del servicio pueden ser menores.

**Clasificación provisional, no verificada:** el servidor calcula poder y no permite escribir posiciones/puntuaciones arbitrarias, pero acepta progreso válido estructuralmente enviado por el cliente. Un jugador puede manipular sus propias mejoras o importar una partida editada. RLS protege otras cuentas, no demuestra que se hayan ganado victorias. Para ranking competitivo haría falta motor autoritativo, eventos/compras validados en servidor, protección contra replay e importaciones con procedencia verificada. También conviene limitar tasa de RPC y revisar costes de ranking a gran escala; la posición propia cuenta filas anteriores y no es tiempo constante.

## 13. Recuperación de problemas

| Síntoma | Acción |
|---|---|
| «Pendiente de configuración» | Comprueba variables del entorno correcto y recompila. |
| `redirect_uri_mismatch` | Revisa el callback de Supabase en Google Cloud. |
| Vuelve al dominio equivocado | Revisa Site URL, redirect exacto y origen utilizado. |
| Nombre ocupado | Elige otro; no elimines el índice único. |
| RPC inexistente o permiso denegado | Revisa que la migración se ejecutó completa y el usuario accedió con Google. No concedas escrituras directas. |
| Conflicto | Exporta el respaldo, pulsa Resolver conflicto y compara copias. No se reintenta sobrescribir en bucle. |
| Partida en otra pestaña | Cierra esa pestaña y vuelve a entrar. Web Locks es obligatorio para evitar escritores simultáneos locales. |
| Sin conexión / cambios pendientes | Mantén la pestaña abierta; al volver la red reintenta. Exporta si necesitas cerrar. |
| Cuota local agotada | Exporta antes de liberar espacio. No borres almacenamiento sin copia. |
| Archivo de respaldo completo | Contiene `data.payload`; este último es el JSON de partida importable. Conserva el envoltorio para diagnosticar su revisión. |
| Nube incompatible | No sobrescribas; conserva/exporta el registro desde el panel y revisa versión/migración. |

**Pendiente de validación externa:** OAuth real, políticas en el proyecto alojado, límites del plan, preview Vercel y continuidad física PC/móvil. Las pruebas locales y respuestas simuladas de navegador no sustituyen esas comprobaciones.
