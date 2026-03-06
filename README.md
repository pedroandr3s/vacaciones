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
- **Vercel** - Hosting y despliegue

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

## Despliegue en Vercel

El proyecto está configurado para desplegarse directamente en Vercel:

1. Conectar el repositorio en [vercel.com](https://vercel.com)
2. Configurar las variables de entorno en el dashboard de Vercel
3. Vercel detecta automáticamente que es un proyecto Next.js y ejecuta `npm run build`
4. Cada push a la rama `main` genera un despliegue automático

## Licencia

Proyecto privado - Todos los derechos reservados.
