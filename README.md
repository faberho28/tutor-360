# PC-Tutor 360

Aplicación web para técnicos y aprendices de reparación de equipos. Apuntas la cámara al interior de un computador (o de otro dispositivo) y la IA identifica y marca cada componente, señala las posibles anomalías y entrega un diagnóstico con pasos a seguir.

Monorepo con pnpm. La aplicación vive en `apps/web` y usa Next.js 16 (App Router), React 19, TypeScript estricto y Tailwind CSS v4.

## Qué hace

- **Detección abierta de componentes.** No hay una lista fija de piezas: la IA planifica qué buscar según el caso elegido y marca cada pieza sobre el video con su máscara, nombre y estado (`ok`, `warning` o `anomaly`).
- **Diagnóstico por pieza.** Al elegir una pieza marcada como `warning` o `anomaly`, la app explica qué es, qué se observa y qué hacer, con el motivo de cada paso. Los diagnósticos de anomalías se piden solos.
- **Paso a paso general.** Una guía escrita para quien está aprendiendo, generada a partir de la primera imagen analizada.
- **Modo automático.** Detecta cambios en la escena (cámara movida, pieza nueva o retirada) y vuelve a analizar solo cuando hace falta. Mientras tanto, las máscaras siguen los objetos en pantalla sin llamar a los modelos.
- **Capturas.** Guarda hasta 20 capturas con las máscaras visibles y los estados ya revisados.
- **Informe en PDF.** Genera un informe A4 en el navegador con las capturas, los diagnósticos y el avance de los pasos.
- **Ajustes.** Permite usar tu propia llave de la API; se guarda solo en la pestaña actual (`sessionStorage`).

El visor 3D todavía no está disponible: la API de modelos no ofrece generación 3D.

## Cómo funciona

1. **Planificación.** Muse Spark observa la imagen y propone, junto con el contexto del caso, qué tipos de piezas buscar (con varias formulaciones de cada una).
2. **Segmentación.** SAM 3.1 segmenta cada formulación por separado y se conserva la mejor de cada pieza. Se descartan manchas, máscaras gigantes, contenedores de otras máscaras y duplicados.
3. **Revisión.** Muse Spark mira cada tipo de pieza, le pone su nombre final en español y la califica (`ok`, `warning`, `anomaly`) con el motivo.
4. **Diagnóstico.** Para una pieza concreta se envía un recorte con contexto; si el recorte no respalda la falla reportada, la pieza baja de `anomaly` a `warning`.
5. **Seguimiento local.** Entre análisis, un seguimiento óptico (OpenCV.js, sin red) mueve las máscaras con la escena: sigue desplazamientos, giros y acercamientos de cada objeto por separado, repone los puntos que pierde y vuelve a consultar a los modelos solo cuando no puede seguir un objeto.

Las coordenadas en el estado de la app son normalizadas (0 a 1); el overlay aplica el recorte `object-cover` del video.

## Requisitos

- Node.js 24 (LTS), fijado en `.nvmrc`.
- pnpm 12, gestionado con Corepack (`corepack enable pnpm`). La versión exacta está en el campo `packageManager` de `package.json`.
- Una llave de la Meta Model API (en el servidor o desde Ajustes).
- Un navegador con cámara. La cámara requiere HTTPS o `localhost`.

## Instalación

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Abre `http://localhost:3000`. Si el puerto está ocupado: `pnpm --filter web exec next dev -p 3210`.

### Variables de entorno

Todas son solo de servidor (ninguna lleva el prefijo `NEXT_PUBLIC_`) y tienen valor por defecto, salvo la llave. `lib/env.ts` las valida con Zod y falla con un mensaje que nombra la variable inválida.

| Variable                   | Uso                                                                                   | Por defecto              |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------ |
| `MODEL_API_KEY`            | Llave de la Meta Model API (opcional si cada usuario pone la suya en Ajustes)         | —                        |
| `MODEL_API_BASE_URL`       | URL base de la API                                                                    | `https://api.meta.ai/v1` |
| `SEGMENTATION_MODEL`       | Modelo de segmentación                                                                | `sam-3.1`                |
| `SCENE_MODEL`              | Modelo que planifica y revisa las piezas                                              | `muse-spark-1.3`         |
| `DIAGNOSIS_MODEL`          | Modelo del diagnóstico y de los pasos                                                 | `muse-spark-1.3`         |
| `DIAGNOSIS_FALLBACK_MODEL` | Respaldo del diagnóstico ante cuota, tiempo agotado, red o errores del servidor       | `muse-spark-1.2`         |
| `SEGMENT_SCORE_THRESHOLD`  | Confianza (0 a 1) desde la que una máscara cuenta como segura al elegir formulaciones | `0.85`                   |

La llave que el usuario escribe en Ajustes viaja en la cabecera `x-model-api-key` y tiene prioridad sobre `MODEL_API_KEY`. Nunca se registra ni se guarda en el servidor.

## Uso

1. En la pantalla de inicio entra al **Laboratorio** y elige qué vas a escanear: Computador, Celular, Teclado, Legos o un caso personalizado (con tu propio contexto).
2. En **Scan** autoriza la cámara. Con el botón de captura (o con la barra espaciadora) se analiza el cuadro actual; con el modo automático la app analiza sola cuando detecta cambios.
3. Pasa el cursor sobre una máscara para ver su nombre y estado, o elige una pieza en la lista para ver su diagnóstico y sus pasos.
4. Genera el informe en PDF desde la barra de control.

### Atajos en Scan

| Tecla     | Acción                                     |
| --------- | ------------------------------------------ |
| `Espacio` | Capturar y analizar el cuadro actual       |
| `A`       | Activar o pausar el modo automático        |
| `R`       | Generar el informe                         |
| `G`       | Mostrar u ocultar la cuadrícula de cambios |
| `?`       | Ver la ayuda de atajos                     |

### Otras acciones

- **Doble clic** sobre una máscara la oculta (no la borra). Con el cursor encima se ve su contorno y nombre; un clic la vuelve a mostrar. El botón de ojo de la lista hace lo mismo.
- **Reiniciar contexto** (menú «…» de la barra de control) descarta el plan, las revisiones y el seguimiento, y conserva el caso y la cámara. Pide confirmación si hay capturas.
- Salir de `/scan` descarta toda la sesión.

## Rutas

| Ruta                 | Descripción                                              |
| -------------------- | -------------------------------------------------------- |
| `/`                  | Pantalla de bienvenida                                   |
| `/laboratorio`       | Elegir el caso a escanear                                |
| `/scan?caso=<id>`    | Pantalla de escaneo (sin `caso` redirige al Laboratorio) |
| `/design`            | Guía de estilo; solo en desarrollo (404 en producción)   |
| `GET /api/health`    | Estado del servicio                                      |
| `POST /api/analyze`  | Planifica las piezas y las segmenta por formulación      |
| `POST /api/review`   | Nombra y califica un tipo de pieza                       |
| `POST /api/diagnose` | Diagnóstico de una pieza a partir de un recorte          |
| `POST /api/steps`    | Pasos generales a partir del primer cuadro analizado     |

## Scripts

| Script                              | Descripción                           |
| ----------------------------------- | ------------------------------------- |
| `pnpm dev`                          | Servidor de desarrollo de `apps/web`  |
| `pnpm build`                        | Build de producción                   |
| `pnpm lint`                         | ESLint                                |
| `pnpm typecheck`                    | `tsc --noEmit`                        |
| `pnpm format` / `pnpm format:check` | Prettier escribe / verifica           |
| `pnpm check`                        | `format:check` + `lint` + `typecheck` |

Ejecuta `pnpm check` antes de cada commit.

## Estructura

```
apps/web/
  app/               Rutas, layout, estilos globales y rutas de API
  components/scan/   Pantalla de escaneo: escenario, overlay, barra de control, panel, lista y detalle
  components/lab/    Laboratorio: tarjetas de casos y diálogo del caso personalizado
  components/ui/     Componentes de shadcn/ui
  hooks/             Consultas de medios, pantalla completa, atajos y temporizadores
  lib/session/       Estado de la sesión (Zustand) y su proveedor
  lib/overlay/       Geometría, dibujo de máscaras y etiquetas, composición de capturas
  lib/camera/        Acceso a la cámara, lista de dispositivos y captura de cuadros
  lib/vision/        Detección local de cambios en el video
  lib/tracking/      Seguimiento local de máscaras (OpenCV.js)
  lib/models/        Cliente de la Meta Model API (solo servidor)
  lib/analysis/      Planificación, segmentación, limpieza de máscaras y programación de análisis
  lib/diagnosis/     Recortes y cliente del diagnóstico
  lib/report/        Informe en PDF (jspdf, cargado bajo demanda)
  lib/lab/           Casos del Laboratorio
  lib/services/      Servicios que usa la interfaz (diagnóstico, informe, análisis)
services/vision/     Reservado para un servicio Python futuro; sin código aún
samples/             Fotos de muestra
```

`services/*` no forma parte del workspace de pnpm porque será Python.

## Sistema de diseño

- Tailwind CSS v4, shadcn/ui (base Radix, preset `vega`), `lucide-react` e Inter (`next/font`).
- Los tokens de color, los radios y el tema claro/oscuro viven en `apps/web/app/globals.css`. Los colores del overlay según el estado de cada pieza están en `apps/web/lib/overlay-theme.ts` y `apps/web/lib/component-status.ts`.
- Los componentes de shadcn están en `apps/web/components/ui/`. Se agregan con `pnpm dlx shadcn@latest add <componente>` desde `apps/web`. Si se vuelve a agregar `select`, `dropdown-menu`, `tooltip` o `progress`, hay que reaplicar sus modificaciones locales (ver `components/ui/portal-container.tsx`).
- El tema sigue al sistema por defecto y se puede forzar con el selector de tema; la elección se guarda en `localStorage`.
- Con `pnpm dev`, la guía visual está en `http://localhost:3000/design`.
- Los pares de color de texto cumplen contraste AA (4.5:1) en claro y oscuro; al cambiar un token, hay que medirlo de nuevo.

## Limitaciones

- La calidad de la detección depende de la imagen: buena luz y la pieza a la vista. El mismo cuadro puede dar resultados algo distintos entre análisis.
- En una placa con muchos componentes la lista puede llegar a decenas de máscaras.
- Los textos impresos en las piezas no se leen para segmentar.
- Cada análisis consume llamadas a la API de modelos; el modo automático solo analiza cuando detecta un cambio.

## Convenciones

- Commits con Conventional Commits.
- Código, identificadores y comentarios en inglés; texto de la interfaz en español (es-CO).
- Solo `README.md` se versiona entre los archivos Markdown; el resto de la documentación es local.
