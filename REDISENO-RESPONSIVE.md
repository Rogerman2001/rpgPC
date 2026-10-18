# Rediseño visual PC y móvil

Rama: `codex/rediseno-responsive`, creada conservando el trabajo existente. Sin merge, push ni despliegue. No requiere SQL, cambios de variables ni configuración de Supabase/Vercel.

## Distribución

A partir de 1100 px: CSS Grid 20fr / 55fr / 25fr tras descontar separaciones. Las cavernas quedan a la izquierda, combate y resultado en el centro y estadísticas a la derecha. Al plegarlas, la distribución pasa a 20/80. La altura disponible se mide desde el comienzo del área hasta el pie de página; los paneles pueden desplazarse internamente. En portátiles bajos la presentación del boss se compacta sin quitar datos.

Por debajo de 1100 px: selección de cavernas mediante lista expandible, combate como contenido principal, barra inferior fija con zona segura y espacio reservado. Estadísticas abre un dialog nativo superpuesto con cierre, Escape, foco e interior desplazable; el fondo no se desplaza. Tablets usan esta distribución para no forzar columnas estrechas. Ajustes mantiene exportación/cierre de sesión y añade acceso directo a Seguridad de la partida.

El registro y análisis queda en un desplegable en PC y en el modal «Ver análisis del combate» en móvil. Los consejos de derrota aparecen directamente cuando corresponde y también se pueden consultar dentro del modal. AFK, Personaje/mejoras/reliquias y Clasificación mantienen sus accesos. El aviso de sincronización permanece visible.

## Conservación funcional

`responsive-ui.js` mueve los nodos existentes: no copia estadísticas, no calcula valores y no crea un segundo motor. El renderizador original sigue actualizando Ataque, Defensa, críticos, regeneración por acción propia, penetración, robo de vida, resistencia, furia y valores efectivos de definitivas cuando correspondan. Los controles conservan sus identificadores y listeners. Solo se elimina el título decorativo de la antigua pantalla de combate.

No se han modificado módulos de combate, configuración, economía, autenticación, sincronización, partidas, SQL ni ranking. En bootstrap se importa únicamente el módulo visual nuevo; build copia la hoja de estilos nueva.

## Archivos de esta actualización

- `responsive.css`: disposición y estilos responsive.
- `js/responsive-ui.js`: reorganización DOM, controles visuales y modal.
- `index.html`: referencia a la hoja de estilos.
- `js/bootstrap.js`: importación del módulo visual.
- `scripts/build.mjs`: inclusión del CSS en dist.
- `tests/accounts-browser.mjs`: regresión de interfaz ampliada.
- Este documento. Capturas locales: `responsive-390.png` y `responsive-1920.png`.

## Pruebas

35 pruebas de lógica y 98 comprobaciones PostgreSQL/PGlite. Chrome automatizado con Supabase simulado: anchos 320, 360, 390, 430, 768, 1024, 1366 y 1920; ausencia de desbordamiento horizontal; proporciones; controles de combate dentro del viewport en PC y sin scroll de página en el escenario inicial; plegado; selector; estadísticas actualizadas; Escape/foco; combate mientras el modal está abierto; desafío/repetición; mejoras; clasificación; exportación y cierre de sesión; regresiones de sincronización. También se prueban magnitudes con 100000 niveles de ataque. No son dispositivos físicos ni OAuth real.

## Cómo probar

Con las variables públicas habituales ya configuradas: `npm run build` y `npm start`; abrir http://localhost:4173/. Sin configuración, el acceso queda cerrado como antes. Cambiar el tamaño de ventana y probar selección, combate, estadísticas y Ajustes. En Vercel Preview, usar esta rama tras revisar y subir los cambios; no se ha creado un despliegue desde esta tarea. El acceso OAuth de una URL Preview depende de las URLs ya autorizadas del proyecto: esta actualización no las modifica.

En pantallas bajas, zoom elevado, mensajes largos o resultados extensos puede haber desplazamiento interno o de página; ningún contenido queda recortado. El modal no pausa el combate. Las capturas son escenarios de prueba, no partidas de producción.

## Pulido final del contenido secundario

Eliminados «Eco del combate» y el texto inicial decorativo. El resultado mantiene el oro y las reliquias reales obtenidas; las recompensas previstas quedan en un desplegable junto al resultado. El registro y el resumen mantienen sus nodos y valores originales, con modal móvil que permite desplazamiento interno, Escape y retorno del foco. El consejo vuelve a su lugar tras cerrar el modal. Se elimina únicamente el enlace duplicado del pie «Partida y copias»; todas sus funciones siguen en Ajustes → Seguridad de la partida.

Archivos del pulido: index.html, js/responsive-ui.js, responsive.css, js/app.js (solo elimina la creación del enlace del pie), tests/accounts-browser.mjs y este documento. No se cambia el motor, sincronización ni posición de la navegación inferior. Capturas adicionales: combat-mobile-final.png, combat-desktop-final.png y analysis-mobile.png.

Validación adicional: 35 pruebas de lógica y navegador con victoria/repetición, conservación literal del registro/resumen al abrir el modal, Escape/foco, cierre por botón y consejos tras una derrota real del motor. Los ocho anchos, proporciones de PC y pruebas de seguridad de cuenta continúan en la suite.
