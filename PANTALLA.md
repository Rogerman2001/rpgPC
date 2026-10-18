# Ajustes de pantalla

Cambios preparados en `codex/rediseno-responsive` para la PR existente. No se ha hecho push, merge ni despliegue, ni se ha modificado configuración de Vercel/Supabase.

## Uso

Ajustes → Pantalla. Automática (recomendada) es el valor inicial. Personalizada habilita el deslizador 75–150 % en pasos de 5 %. Compacto (90), Normal (100), Grande (125) y Muy grande (150) activan el modo personalizado. Restablecer vuelve a automático y conserva 100 como valor manual inicial. Todo se aplica sin recargar.

La preferencia se guarda únicamente en `cavernaburx.display.v1`: `{version:1, mode:"auto"|"manual", manual:100}`. No entra en partidas, exportaciones ni Supabase. Datos inválidos o almacenamiento inaccesible usan valores predeterminados; si no puede persistirse un cambio, se avisa. Las preferencias pertenecen al navegador, no a una cuenta concreta.

## Escala automática

Usa ancho y alto del viewport CSS (`innerWidth`/`innerHeight`), no la resolución física ni devicePixelRatio. El zoom del navegador altera ese espacio y provoca la reevaluación. También escucha resize, cambio de viewport visual y pantalla completa. La fórmula es `clamp(0.9, 1 + 0.75 × (min(ancho/1920, alto/1080) − 1), 1.5)`, redondeada a centésimas.

| Viewport | Escala automática |
|---|---|
| 1366 × 768 | 90 % |
| 1920 × 1080 | 100 % |
| 2560 × 1440 | 125 % |
| 3840 × 2160 | 150 % máximo |
| Menos de 1100 px de ancho | 100 %, diseño móvil/tablet existente |

Una ventana ancha pero baja conserva una escala compacta. Los tamaños se aplican mediante `--ui-scale`, calc y clamp: tipografía, controles, iconos, padding, espacios, tarjetas, barras y paneles. No se escala el contenedor con transform ni zoom. Los mínimos de legibilidad y tamaño táctil pueden limitar la reducción de algunos elementos al 75 %. El ancho máximo crece con la escala, reduciendo los márgenes en 1440p sin extenderse ilimitadamente en 4K.

El cálculo visual de altura disponible descuenta la cabecera, navegación y pie reales tras aplicar los tamaños. Se recalcula al escalar, redimensionar y volver a Combate. Los paneles permiten desplazamiento cuando hace falta; nunca se recorta información para forzar un encaje. Las columnas conservan 20/55/25 (20/80 con estadísticas plegadas).

La escala personalizada se aplica solo a escritorio/tablets anchas desde 1100 px. En móviles o tablets estrechas se conserva el diseño anterior; el ajuste seleccionado se recuerda para cuando haya una ventana de escritorio. El panel indica esta limitación. La barra inferior, selector y modales móviles no se rediseñan.

## Archivos

Nuevos: `display.css`, `js/display-scale.js`, `js/display-settings.js`, `tests/display.test.js`, este documento y capturas `display-1920.png` / `display-2560.png`.

Integración: `index.html` carga el CSS, `js/bootstrap.js` importa el módulo visual, `scripts/build.mjs` copia el CSS, `js/responsive-ui.js` recalcula la altura útil, `package.json` incluye las pruebas y `tests/accounts-browser.mjs` amplía los contratos de interfaz. No se modifican fórmulas ni módulos de guardado, autenticación o sincronización.

## Pruebas

38 pruebas de lógica, incluidas las nuevas pruebas de límites y preferencias. Chrome automatizado sin zoom adicional: 1366×768, 1920×1080, 2560×1440, 3840×2160, 1024×768, 390×844, 360×800 y 320×568; las comprobaciones responsive anteriores también permanecen.

Se verifican los 16 porcentajes manuales, cuatro perfiles, restablecimiento, persistencia tras recarga y conservación del payload de progreso; ausencia de overflow horizontal, límites del modal y proporciones. Continúa la suite de combate, estadísticas/análisis, consejos, exportación, cuentas y conflictos con HTTP de Supabase simulado. No se ha probado en dispositivos físicos ni monitores reales; las capturas son viewports simulados al 100 % de zoom.

Para revisar: compilar y arrancar con `npm run build` y `npm start`, usando las variables públicas habituales; o incorporar los cambios a la PR existente y abrir su Preview. No se requieren nuevas variables ni migraciones. Sin configuración local de Supabase, el acceso permanece cerrado como antes.
