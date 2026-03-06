# Naitus - Sistema de Gestión de Vacaciones

Sistema de gestión de vacaciones para empresas, desarrollado con Next.js y Firebase. Cumple con la legislación laboral chilena para el cálculo de días de vacaciones legales, días Naitus (bonificación) y permisos sin goce de sueldo.

## Tecnologías

- **Next.js 16** - Framework fullstack con App Router
- **React 19** - Interfaz de usuario
- **TypeScript 5** - Tipado estático
- **Firebase** - Autenticación (Auth) y base de datos (Firestore)
- **Tailwind CSS 4** - Estilos
- **Radix UI / shadcn/ui** - Componentes de interfaz
- **React Hook Form + Zod** - Formularios y validación
- **Recharts** - Gráficos y reportes
- **date-fns** - Manejo de fechas
- **Node.js / Docker** - Despliegue en servidor

## Funcionalidades

### Empleados
- Visualización de balance de vacaciones (legales, Naitus, deuda)
- Solicitud de vacaciones con flujo de aprobación
- Historial de solicitudes
- Calendario de equipo

### Administradores
- Dashboard con resumen general
- Gestión de empleados (alta, baja, edición)
- Importación masiva de usuarios
- Aprobación/rechazo de solicitudes
- Ajuste manual de balances de vacaciones
- Registro de vacaciones por parte del admin
- Gestión de contratos y tipos de empleado

### Integraciones
- **Google Calendar** - Creación de eventos de vacaciones vía n8n
- **n8n** - Automatización de flujos de trabajo (webhooks)
- **Google Sheets** - Registro de credenciales
- **Boostr API** - Feriados legales de Chile

## Requisitos previos

- **Node.js** >= 18
- **npm**
- Proyecto en **Firebase** con Firestore y Authentication habilitados

## Variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY=   # JSON string de la service account

# Webhooks
GOOGLE_SHEETS_WEBHOOK_URL=      # URL del Google Apps Script
```

## Instalación

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd vacation-management-app

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con las credenciales correspondientes
```

## Ejecución

### Desarrollo

```bash
npm run dev
```

La aplicación se levanta en `http://localhost:3000`.

### Producción

```bash
npm run build
npm start
```

### Seed del usuario administrador

Para crear el primer usuario administrador:

```bash
npm run seed
```

Este script crea un usuario en Firebase Auth y su documento correspondiente en Firestore con rol de administrador.

## Scripts disponibles

| Comando         | Descripción                              |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Levanta el servidor de desarrollo        |
| `npm run build` | Genera el build de producción            |
| `npm start`     | Inicia el servidor en modo producción    |
| `npm run lint`  | Ejecuta ESLint                           |
| `npm run seed`  | Crea el usuario administrador en Firebase|

## Estructura del proyecto

```
├── app/                    # Rutas y páginas (App Router)
│   └── api/                # API Routes (create-user, webhooks, etc.)
├── components/             # Componentes React
│   └── ui/                 # Componentes shadcn/ui
├── contexts/               # React Contexts (auth, data, holidays)
├── hooks/                  # Custom hooks
├── lib/                    # Configuración Firebase, servicios, utilidades
├── scripts/                # Scripts de seed y utilidades
├── styles/                 # Estilos globales
└── public/                 # Archivos estáticos
```

## Despliegue en producción

### Opción 1: VPS con Node.js + PM2

Ideal para servidores Linux (Ubuntu, Debian, CentOS, etc.) en proveedores como DigitalOcean, AWS EC2, Linode, Hetzner, etc.

**1. Requisitos en el servidor**

```bash
# Instalar Node.js 18+ (usando nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Instalar PM2 globalmente
npm install -g pm2
```

**2. Clonar y configurar**

```bash
git clone https://bitbucket.org/naitusspa/timhub-vacaciones.git
cd timhub-vacaciones

npm install

# Configurar variables de entorno
cp .env.example .env.local
nano .env.local  # Completar con las credenciales
```

**3. Build y arranque**

```bash
npm run build
pm2 start npm --name "timhub-vacaciones" -- start
```

**4. Configurar PM2 para que inicie con el sistema**

```bash
pm2 startup
pm2 save
```

**5. Configurar Nginx como reverse proxy (recomendado)**

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**6. SSL con Certbot (HTTPS)**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

**Comandos útiles de PM2:**

```bash
pm2 status                    # Ver estado de la app
pm2 logs timhub-vacaciones    # Ver logs en tiempo real
pm2 restart timhub-vacaciones # Reiniciar la app
pm2 stop timhub-vacaciones    # Detener la app
```

**Actualizar la aplicación:**

```bash
cd timhub-vacaciones
git pull
npm install
npm run build
pm2 restart timhub-vacaciones
```

---

### Opción 2: Docker

Ideal para entornos con Docker instalado o para orquestadores como Docker Compose, Kubernetes, etc.

**1. Crear el `Dockerfile`** en la raíz del proyecto:

```dockerfile
FROM node:20-alpine AS base

# Instalar dependencias
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build de la aplicación
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Imagen de producción
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

**2. Crear el archivo `docker-compose.yml`:**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    restart: unless-stopped
```

**3. Construir y ejecutar:**

```bash
# Con Docker Compose
docker compose up -d --build

# O directamente con Docker
docker build -t timhub-vacaciones .
docker run -d -p 3000:3000 --env-file .env.local --name timhub-vacaciones timhub-vacaciones
```

**4. Habilitar standalone output** en `next.config.mjs`:

```js
const nextConfig = {
  output: 'standalone',
  // ... resto de la configuración
}
```

> **Nota:** La opción `standalone` es necesaria para que el Dockerfile funcione correctamente. Genera un servidor Node.js independiente que no requiere `node_modules` en producción.

**Comandos útiles de Docker:**

```bash
docker compose logs -f        # Ver logs
docker compose restart        # Reiniciar
docker compose down           # Detener y eliminar contenedor
docker compose up -d --build  # Reconstruir y levantar
```

## Licencia

Proyecto privado - Todos los derechos reservados.
