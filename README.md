# CavernaBURX 1.4 — Cuentas y progreso en la nube

Actualización revisable sobre 1.3: acceso obligatorio con Google/Supabase, nombre público único, respaldos por cuenta, guardado con revisiones, recuperación entre dispositivos, ranking provisional y estadísticas de combate ampliadas. Las mecánicas y el balance se conservan.

**La activación en Supabase/Google/Vercel es manual y está pendiente.** No se ha desplegado ni integrado en main. Sigue [SUPABASE_SETUP.md](SUPABASE_SETUP.md) antes de publicar; consulta [INFORME-1.4.md](INFORME-1.4.md) para decisiones, pruebas y límites.

## Ejecutar

Node 22.12+ y npm:

```sh
npm ci
# Copia .env.example a .env.local y configura URL y clave pública.
npm run build
npm start
```

Abre http://localhost:4173/. `npm run dev` compila y arranca. El servidor local sirve `dist`, no la raíz del repositorio. Sin configuración el juego muestra una pantalla de acceso cerrada y conserva las partidas antiguas.

Vercel utiliza `vercel.json`: compilación `npm run build`, salida `dist`, sin servidor persistente. No publiques la raíz ni secretos. El SDK oficial se incluye en el bundle. Configuración pública: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Guardado y compatibilidad

El motor mantiene el formato v2, sus migraciones v1, estadísticas derivadas y magnitudes logarítmicas. La nube almacena el JSON completo como cadena en un documento versionado para no reinterpretar sus números. Las revisiones y posiciones viajan como texto. PostgreSQL calcula y ordena el Poder Total en escala logarítmica.

Las claves antiguas permanecen intactas. Los respaldos nuevos están separados por UID. Se compara explícitamente local/nube cuando corresponde; no se suman inventarios ni recursos. Una lectura fallida nunca crea una partida vacía. Conflictos detienen el juego hasta elegir una copia; el cierre con pendientes advierte al usuario. AFK queda pausado al entrar.

El ranking es **provisional y no verificado**: el servidor calcula la fórmula, pero el progreso todavía procede del cliente. RLS protege otras cuentas; no convierte las victorias en autoritativas.

`CavernaBURX.html` es el artefacto histórico 1.3 sin cuentas, conservado para recuperación local; no forma parte del build 1.4. Exporta allí tu JSON e impórtalo en la cuenta si deseas trasladarlo. El generador portátil anterior se ha deshabilitado para no sobrescribirlo con una versión que necesita OAuth.

## Pruebas

```sh
npm test
npm run test:database
```

La segunda utiliza PostgreSQL embebido PGlite, sin proyecto externo ni credenciales. Prepara tablas de Auth de prueba, ejecuta SQL real, aplica roles y verifica permisos, revisiones, perfiles y ranking.

Pruebas de navegador: requieren Chrome y Playwright disponible. `PLAYWRIGHT_PATH` debe apuntar a su `index.mjs` (no es dependencia de producción). En una terminal PowerShell de pruebas aislada:

```powershell
$env:VITE_SUPABASE_URL='https://testing.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_local_test'
npm run build
$env:PORT='4174'
npm start
```

En otra terminal, define `PLAYWRIGHT_PATH` y ejecuta `npm run test:browser`. La suite intercepta todas las llamadas al destino ficticio: prueba los contratos y la interfaz usando el SDK real; **no prueba Google ni Supabase alojado**. Nunca despliegues ese build. Cierra la terminal de prueba o elimina sus dos variables y recompila con tu configuración real al terminar.

`npm run test:legacy-browser` conserva la suite histórica: establece `GAME_URL` a la URL `file:///.../CavernaBURX.html` de tu archivo 1.3. `npm run test:balance` mantiene las simulaciones del motor sin modificar las curvas.

## Organización

- `js/bootstrap.js`: acceso, perfil, elección de partida y ranking.
- `js/cloud-sync.js`, `cloud-data.js`, `account-context.js`: persistencia y estado autenticado.
- `supabase/migrations/202610180001_accounts.sql`: tablas, índices, RLS, validación y RPC.
- `js/combat-statistics.js`: presentación de atributos efectivos, sin cambiar combate.
- `js/app.js`: interfaz del juego autenticado; módulos de combate/progresión separados.
- `scripts/build.mjs`, `vercel.json`: entrega estática y configuración pública.
- `tests/`: pruebas de lógica, PostgreSQL, contratos de navegador y simulaciones.

Los informes 1.1, 1.2 y 1.3 y sus resultados son históricos. La documentación vigente de cuentas y despliegue es SUPABASE_SETUP.md.
