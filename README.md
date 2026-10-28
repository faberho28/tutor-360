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

## Convenciones

- Commits con Conventional Commits.
- Solo `README.md` se versiona entre los archivos Markdown; el resto de la documentación es local.
