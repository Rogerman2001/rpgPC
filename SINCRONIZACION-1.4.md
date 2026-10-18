# Guardado oficial y recuperación — 18/10/2026

Supabase es la fuente oficial. Esta actualización no cambia el formato de progreso, balance, nombres, tablas ni revisiones existentes. No se ha accedido a producción, desplegado ni integrado en main.

## Funcionamiento

- Al entrar se valida la sesión Google y se lee la nube. Un error bloquea la entrada: nunca equivale a partida inexistente.
- Una copia local confirmada, aunque sea antigua, no abre un selector. Se archiva y se carga la oficial automáticamente.
- Cambios pendientes con la misma revisión base se reanudan mediante CAS. Si la revisión ha cambiado, se pausa la sesión y se abre recuperación excepcional. No se fusionan recursos.
- Sin partida oficial, una copia local elegible requiere importación explícita; sin copia se crea una nueva mediante revisión 0.
- Antes de cada escritura se consulta la revisión; después la RPC existente vuelve a comprobarla atómicamente. También se comprueba al recuperar foco, visibilidad, conexión y cada 30 segundos con la pestaña visible. La comprobación previa no sustituye CAS.
- Sin conexión se mantiene el documento pendiente y se reintenta. Una respuesta perdida tras un commit puede producir un conflicto conservador: no se supone que el reintento sea una operación nueva segura.
- Los respaldos por UID incluyen formato del respaldo, sobre de progreso, revisión base, identificador de sesión de sincronización, estado pendiente/confirmado/conflicto y fecha auxiliar. Se leen también respaldos del formato anterior. No se ordenan partidas por fecha, oro o poder.
- Seguridad de la partida muestra cuenta, estado, revisión y última confirmación. Permite descargar respaldo vinculado, comprobar sincronización y abrir recuperación avanzada, incluidas copias archivadas.
- Restaurar detiene la sesión, conserva las versiones, ofrece descargas, muestra progreso, requiere confirmación y vuelve a leer la revisión antes del CAS. Si cambia, rechaza la restauración. Un respaldo con otro UID se rechaza.

## SQL y Vercel

**No hace falta una migración SQL nueva ni cambiar variables de entorno.** Se reutilizan `read_player_save()` y `commit_player_save(jsonb,text,uuid)` con su CAS existente. No volver a ejecutar la migración inicial como requisito de este cambio. Si el proyecto alojado no dispone de ese contrato, revisar su instalación antes de publicar; no se ha inspeccionado el proyecto remoto.

Se mantienen VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. Las pruebas usan URL y clave ficticias con interceptación HTTP. No subir una compilación de pruebas a Vercel; Vercel debe compilar con sus variables habituales. No se han añadido secretos.

## Verificación manual PC/móvil

1. En PC, jugar y esperar «Guardado en la nube». Entrar con la misma cuenta en móvil: debe cargar directamente la oficial, incluso si hay un respaldo local antiguo confirmado.
2. Mantener PC abierto y guardar un cambio desde móvil. Volver a PC: al recuperar foco o al siguiente guardado debe pausarse si la revisión avanzó. Cargar la oficial conservando las copias archivadas.
3. Cortar Internet con la sesión iniciada, cambiar estilo o jugar y comprobar estado pendiente. Reconectar sin cambios externos: debe confirmar. Repetir haciendo avanzar el móvil: debe mostrar conflicto y conservar el progreso local.
4. Cambiar de cuenta: no debe ofrecer respaldos vinculados al otro UID. Simular fallo de lectura al entrar: no debe aparecer una partida vacía.
5. En Partida → Seguridad de la partida → Recuperación avanzada, importar un respaldo propio. Descargar las copias, cancelar y comprobar que no hubo sustitución. Repetir confirmando. Si otro dispositivo guarda durante la confirmación, la operación debe rechazarse.

## Pruebas y límites

`npm test`, `npm run test:database` y `npm run test:accounts` cubren la lógica, PostgreSQL embebido y contratos HTTP del SDK en Chrome. La prueba de navegador necesita PLAYWRIGHT_PATH y un servidor local con compilación de prueba; no usa Google ni Supabase reales. Se incluyen dispositivos con copia antigua, desconexión/reconexión, conflictos, cuentas separadas, fallo inicial, formato anterior y restauración con revisión cambiada.

El almacenamiento local puede agotarse, borrarse o fallar: no puede garantizarse recuperación tras borrar el navegador. Los archivos de recuperación no se purgan automáticamente; descargar antes de liberar espacio. Si no se puede archivar, la restauración se interrumpe. Los respaldos JSON antiguos sin UID requieren declaración explícita de pertenencia: técnicamente no se puede verificar su origen. No son evidencia antitrampas. La clasificación sigue no verificada.

La comprobación periódica puede tardar y los navegadores suspenden pestañas; CAS continúa evitando sobrescrituras. Las copias archivadas consumen espacio. Los cambios pendientes permanecen en su dispositivo hasta confirmarse; no hay motor offline ni fusión entre dispositivos. OAuth y PostgREST alojados necesitan la comprobación manual indicada.

Resultados: 35 pruebas de lógica, 98 comprobaciones PostgreSQL y contratos de navegador aprobados, incluidos restauración confirmada y rechazo si cambia la revisión durante la confirmación. Sin validación contra servicios de producción.
