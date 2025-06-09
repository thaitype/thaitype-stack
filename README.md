# 🚀 Thaitype-stack

Support node 16 and above (due to https://github.com/sindresorhus/execa/releases/tag/v8.0.0)

## Stack
- Vite + Hono + React (SPA)
- Azure Static Web App
- Azure Functions (+ quota)
- Tan stack router

## Stack Options
- Deploy
  - Docker
  - Azure Static Web App
- Database
  - MongoDB
  - ...

## Todo
- migrate to use `@thaitype/funx` -- All in one toolbox for Azure Functions
- migrate to use `beeze` -- Build tool for production
- Write orpc Azure Functions Adatper, see: @marplex/hono-azurefunc-adapter
  - Currently using `@marplex/hono-azurefunc-adapter` with orpc