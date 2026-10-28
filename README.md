# PC-Tutor 360

Monorepo de PC-Tutor 360. La aplicación web (`apps/web`) usa Next.js (App Router), TypeScript estricto y Tailwind CSS v4.

## Requisitos

- Node.js 24 (LTS), fijado en `.nvmrc`.
- pnpm 12, gestionado con Corepack (`corepack enable pnpm`). La versión exacta está en el campo `packageManager` de `package.json`.

## Instalación

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

Completa los valores de `apps/web/.env.local`. Todas las variables son solo de servidor; ninguna lleva el prefijo `NEXT_PUBLIC_`.

| Variable                  | Uso                                                  |
| ------------------------- | ---------------------------------------------------- |
| `MODEL_API_KEY`           | Llave de la Meta Model API                           |
| `MODEL_API_BASE_URL`      | URL base de la API (`https://api.meta.ai/v1`)        |
| `SEGMENTATION_MODEL`      | Id del modelo de segmentación                        |
| `DIAGNOSIS_MODEL`         | Id del modelo de diagnóstico                         |
| `SEGMENT_SCORE_THRESHOLD` | Umbral de confianza entre 0 y 1 (por defecto `0.85`) |

`lib/env.ts` valida estas variables con Zod y falla con un mensaje que nombra la variable inválida o faltante.

## Scripts

| Script                              | Descripción                                    |
| ----------------------------------- | ---------------------------------------------- |
| `pnpm dev`                          | Servidor de desarrollo de `apps/web`           |
| `pnpm build`                        | Build de producción                            |
| `pnpm lint`                         | ESLint                                         |
| `pnpm typecheck`                    | `tsc --noEmit`                                 |
| `pnpm format` / `pnpm format:check` | Prettier escribe / verifica                    |
| `pnpm test` / `pnpm test:watch`     | Vitest, una corrida / modo watch               |
| `pnpm check`                        | `format:check` + `lint` + `typecheck` + `test` |

Ejecuta `pnpm check` antes de cada commit.

## Estructura

```
apps/web/          Aplicación Next.js (UI + rutas de API)
services/vision/   Reservado para el servicio Python (HU-26); sin código aún
samples/           Fotos de muestra
```

`services/*` no forma parte del workspace de pnpm porque será Python.

## Sistema de diseño

- Stack de UI: Tailwind CSS v4, shadcn/ui (base Radix, preset `vega`), `lucide-react` e Inter (`next/font`).
- Los tokens de color, los radios y el tema claro/oscuro viven en `apps/web/app/globals.css`. Los colores del overlay y la clase → estado de cada componente viven en `apps/web/lib/overlay-theme.ts` y `apps/web/lib/component-status.ts`.
- Los componentes de shadcn están en `apps/web/components/ui/`. Se agregan con `pnpm dlx shadcn@latest add <componente>` desde `apps/web`.
- El tema sigue al sistema por defecto y se puede forzar con `ThemeToggle`; la elección se guarda en `localStorage`.
- Guía visual: con `pnpm dev`, abre `http://localhost:3000/design`. La ruta solo existe en desarrollo y responde 404 en producción.
- Todo texto debe cumplir contraste AA (4.5:1). `app/globals.contrast.test.ts` lo verifica sobre `globals.css`, en claro y oscuro.

## Convenciones

- Commits con Conventional Commits.
- Solo `README.md` se versiona entre los archivos Markdown; el resto de la documentación es local.
