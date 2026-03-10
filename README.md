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

## Arquitectura backend

Este proyecto no cuenta con un backend tradicional. En su lugar utiliza servicios externos que cumplen ese rol:

- **Firebase Authentication** - Manejo de usuarios, login y sesiones
- **Cloud Firestore** - Base de datos NoSQL (empleados, balances, solicitudes, feriados, contratos)
- **Firebase Admin SDK** - Operaciones privilegiadas del lado del servidor (crear/eliminar usuarios) ejecutadas desde las API Routes de Next.js (`app/api/`)
- **n8n Cloud** (`naitus.app.n8n.cloud`) - Automatización de flujos de trabajo mediante webhooks:
  - `/webhook/naitus` - Recibe datos de usuarios creados (incluye contraseñas provisorias)
  - `/webhook/vacaciones-equipo` - Envía vacaciones aprobadas a Google Calendar
  - `/webhook/eliminar-vacacion` - Elimina eventos de calendario al cancelar vacaciones
  - `/webhook/anexo` - Manejo de anexos de contrato

Las API Routes de Next.js actúan como proxy entre el frontend y estos servicios, sin necesidad de un servidor backend separado.

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

Ideal para entornos con Docker instalado. El repositorio ya incluye los archivos `Dockerfile`, `docker-compose.yml` y `.dockerignore` listos para usar.

> **Nota:** `next.config.mjs` ya tiene configurado `output: 'standalone'`, necesario para que el build de Docker genere un servidor Node.js independiente sin `node_modules`.

#### Requisitos en el servidor

- Docker >= 20
- Docker Compose >= 2 (incluido en Docker Desktop o instalable por separado)

#### Clonar y configurar

```bash
git clone https://bitbucket.org/naitusspa/timhub-vacaciones.git
cd timhub-vacaciones
```

Las variables de entorno de producción están en el archivo `.env` (incluido en el repositorio). Si necesitas sobreescribir algún valor, edítalo directamente:

```bash
nano .env
```

#### Opción 2A: Docker Compose (recomendado)

```bash
docker compose up -d --build
```

La app estará disponible en `http://localhost:3000`.

**Comandos útiles:**

```bash
docker compose ps             # Ver estado del contenedor
docker compose logs -f        # Ver logs en tiempo real
docker compose restart        # Reiniciar la app
docker compose down           # Detener y eliminar contenedor
```

**Actualizar la aplicación:**

```bash
git pull
docker compose up -d --build
```

Docker Compose reconstruye la imagen con los cambios y reemplaza el contenedor automáticamente.

---

#### Opción 2B: Docker sin Compose

**Construir la imagen:**

```bash
docker build -t timhub-vacaciones .
```

**Ejecutar el contenedor:**

```bash
docker run -d -p 3000:3000 --env-file .env --name timhub-vacaciones timhub-vacaciones
```

**Comandos útiles:**

```bash
docker ps                                    # Ver contenedores activos
docker logs -f timhub-vacaciones             # Ver logs en tiempo real
docker restart timhub-vacaciones             # Reiniciar
docker stop timhub-vacaciones                # Detener
docker rm timhub-vacaciones                  # Eliminar contenedor
```

**Actualizar la aplicación:**

```bash
git pull
docker stop timhub-vacaciones && docker rm timhub-vacaciones
docker build -t timhub-vacaciones .
docker run -d -p 3000:3000 --env-file .env --name timhub-vacaciones timhub-vacaciones
```

---

### Cambiar el puerto (si el 3000 está ocupado)

Por defecto la aplicación se levanta en el puerto `3000`. Si necesitas usar otro puerto (por ejemplo `4000`), sigue los pasos según tu opción de despliegue:

#### VPS con PM2

**1.** Iniciar la app con el nuevo puerto:

```bash
PORT=4000 pm2 start npm --name "timhub-vacaciones" -- start
```

**2.** Actualizar el `proxy_pass` en la configuración de Nginx (`/etc/nginx/sites-available/tu-dominio.com`):

```nginx
proxy_pass http://localhost:4000;
```

**3.** Recargar Nginx para aplicar el cambio:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### Docker Compose

**1.** Editar `docker-compose.yml` y cambiar el mapeo de puertos:

```yaml
services:
  app:
    build: .
    ports:
      - "4000:3000"   # puerto-host:puerto-contenedor
    env_file:
      - .env
    restart: unless-stopped
```

> El primer número (`4000`) es el puerto del servidor donde se accede a la app. El segundo (`3000`) es el puerto interno del contenedor y no debe cambiarse.

**2.** Reconstruir y levantar:

```bash
docker compose down
docker compose up -d --build
```

La app estará disponible en `http://localhost:4000`.

#### Docker sin Compose

Pasar el puerto deseado con `-p`:

```bash
docker run -d -p 4000:3000 --env-file .env --name timhub-vacaciones timhub-vacaciones
```

#### Configurar Nginx como reverse proxy (recomendado para ambas opciones Docker)

Si usas Docker en un servidor con dominio, configura Nginx para redirigir al puerto que elegiste:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:4000;  # Debe coincidir con el puerto del host
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

Luego habilitar el sitio y recargar Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/tu-dominio.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Licencia

Proyecto privado - Todos los derechos reservados.
