# Fastify API

API REST con Fastify 5, TypeScript, MySQL 8 y Drizzle ORM. Incluye registro, inicio de sesión, renovación de sesión con rotación de refresh tokens, y un endpoint protegido con JWT.

## Requisitos

- Node.js 22 o superior (ver `.nvmrc`).
- Docker, para levantar MySQL con `docker-compose.yml`.

## Puesta en marcha

```bash
npm install
cp .env.example .env        # ajusta los valores si hace falta
npm run docker:db:up        # MySQL 8 en el puerto 3306
npm run db:migrate          # aplica las migraciones de Drizzle
npm run dev                 # http://localhost:3000
```

La documentación interactiva está en **http://localhost:3000/docs** (Swagger UI).

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor en modo desarrollo con recarga (`tsx watch`). |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta el build (`node dist/server.js`). |
| `npm test` | Ejecuta los tests con Vitest. Requiere MySQL en marcha. |
| `npm run typecheck` | Comprueba tipos sin generar archivos. |
| `npm run lint` / `lint:fix` | ESLint. |
| `npm run format` / `format:check` | Prettier. |
| `npm run docker:db:up` / `docker:db:down` | Levanta o detiene MySQL. |
| `npm run db:generate` | Genera una migración tras cambiar el esquema. |
| `npm run db:migrate` | Aplica las migraciones pendientes. |
| `npm run db:studio` | Interfaz de Drizzle Studio para explorar la base de datos. |

## Variables de entorno

Se leen desde `.env` (si existe) o desde el entorno. La validación ocurre al arrancar y el proceso se detiene si algo es inválido.

| Variable | Por defecto | Notas |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` o `production`. |
| `HOST` / `PORT` | `0.0.0.0` / `3000` | Dirección y puerto del servidor. |
| `LOG_LEVEL` | `info` | `fatal` a `trace`, o `silent`. |
| `CORS_ORIGIN` | `http://localhost:5173` | Orígenes separados por coma, o `*`. |
| `RATE_LIMIT_MAX` | `100` | Peticiones por IP en cada ventana. |
| `RATE_LIMIT_TIME_WINDOW` | `1 minute` | Duración de la ventana. |
| `DATABASE_HOST` / `DATABASE_PORT` | `127.0.0.1` / `3306` | Conexión a MySQL. |
| `DATABASE_USER` / `DATABASE_PASSWORD` | `fastify_user` / `fastify_password` | Usuario de la aplicación. |
| `DATABASE_NAME` | `fastify_db` | Base de datos. |
| `DATABASE_ROOT_PASSWORD` | `root_password` | Solo lo usa `docker-compose.yml`. |
| `JWT_SECRET` | valor de desarrollo | Firma los access tokens. Mínimo 16 caracteres. |
| `COOKIE_SECRET` | valor de desarrollo | Firma la cookie del refresh token. Mínimo 16 caracteres. |
| `JWT_EXPIRES_IN` | `15m` | Duración del access token. |
| `REFRESH_TOKEN_EXPIRES_DAYS` | `7` | Duración del refresh token. |

> **Producción:** con `NODE_ENV=production` el servidor **no arranca** si `JWT_SECRET` o `COOKIE_SECRET` son los valores de desarrollo o tienen menos de 32 caracteres. Genera secretos distintos para cada entorno, por ejemplo con `openssl rand -hex 32`.

## Endpoints

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| `GET` | `/` | No | Mensaje de comprobación. |
| `GET` | `/health/live` | No | Liveness: el proceso responde. |
| `GET` | `/health/ready` | No | Readiness: consulta `SELECT 1` a MySQL. Devuelve 503 si no hay conexión. |
| `POST` | `/auth/register` | No | Crea un usuario con rol `user`. Devuelve 201 con `accessToken`. |
| `POST` | `/auth/login` | No | Valida credenciales. Devuelve `accessToken`. |
| `POST` | `/auth/refresh` | Cookie | Rota el refresh token y devuelve un nuevo `accessToken`. |
| `POST` | `/auth/logout` | Cookie | Revoca el refresh token y borra la cookie. |
| `GET` | `/users/me` | Bearer | Perfil del usuario autenticado. |
| `GET` | `/docs` | No | Swagger UI. |

### Ejemplo

```bash
# Registro: guarda la cookie httpOnly y devuelve el access token
curl -i -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"StrongPassword123"}' \
  http://localhost:3000/auth/register

# Perfil con el access token
curl -H "Authorization: Bearer <accessToken>" http://localhost:3000/users/me

# Nuevo access token usando la cookie
curl -b cookies.txt -X POST http://localhost:3000/auth/refresh
```

Los errores tienen siempre la misma forma:

```json
{ "statusCode": 409, "error": "EMAIL_ALREADY_EXISTS", "message": "A user with this email already exists" }
```

Códigos habituales: `VALIDATION_ERROR` (400), `INVALID_CREDENTIALS` (401), `INVALID_REFRESH_TOKEN` (401), `UNAUTHORIZED` (401), `EMAIL_ALREADY_EXISTS` (409), `TOO_MANY_REQUESTS` (429).

## Seguridad

- **Contraseñas** con Argon2.
- **Access token**: JWT firmado con `JWT_SECRET`, enviado en `Authorization: Bearer`.
- **Refresh token**: 80 caracteres aleatorios en una cookie `httpOnly`, `sameSite=lax`, `path=/auth` y firmada. En la base de datos solo se guarda su hash SHA-256.
- **Rotación**: cada refresh revoca el token usado y emite uno nuevo.
- **Detección de reuso**: si se presenta un refresh token ya revocado, se revocan todas las sesiones del usuario.
- **Rol**: el registro público siempre crea usuarios con rol `user`. Hoy no hay endpoint para crear o promover administradores: se asignan directamente en la base de datos.
- **Cabeceras y CORS**: `@fastify/helmet` y `@fastify/cors` con `credentials: true`.
- **Rate limiting**: `@fastify/rate-limit`, configurable con las variables de arriba.
- **Cierre ordenado**: al recibir `SIGINT` o `SIGTERM` deja de aceptar conexiones, termina las peticiones en curso y cierra el pool de MySQL.

## Estructura

```
src/
├── app.ts              # Construye la aplicación (sin arrancar el servidor; los tests usan app.inject)
├── server.ts           # Punto de entrada: listen y cierre ordenado
├── config/             # Validación de variables de entorno y logger
├── db/                 # Cliente MySQL, esquema de Drizzle y migraciones
├── plugins/            # Seguridad, Swagger, base de datos, autenticación y manejo de errores
├── modules/
│   ├── auth/           # Rutas, servicio, repositorio y esquemas de autenticación
│   ├── users/          # Perfil del usuario
│   └── health/         # Probes de liveness y readiness
└── shared/errors/      # Errores de aplicación con código HTTP
test/                   # Tests de integración con app.inject y MySQL real
drizzle/                # Migraciones SQL generadas
```

## Tests

Los tests usan la base de datos real definida en `.env`, así que MySQL debe estar en marcha:

```bash
npm run docker:db:up
npm test
```

Los tests eliminan los usuarios que crean al terminar.
