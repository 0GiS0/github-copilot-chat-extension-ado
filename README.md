# GitHub Copilot Chat for Azure DevOps

🌍 *[Read in English](README.en.md)*

Una extensión de Azure DevOps que integra GitHub Copilot Chat directamente en tu flujo de trabajo de desarrollo.

![GitHub Copilot Chat Extension](static/copilot-icon.png)

## ✨ Características

- 💬 Interfaz de chat integrada en Azure DevOps
- 🤖 Integración con GitHub Copilot para asistencia de código
- 🎨 UI nativa que se adapta al tema de Azure DevOps

## 📋 Requisitos previos

- Una organización de Azure DevOps
- Node.js 16+
- npm o yarn
- [tfx-cli](https://github.com/microsoft/tfs-cli) para empaquetar y publicar la extensión

## 🚀 Inicio rápido

### Instalación de dependencias

```bash
npm install
```

### Desarrollo

Para ejecutar la API (servidor proxy) y la extensión (webpack-dev-server) **al mismo tiempo**:

```bash
npm run dev
```

Esto usa `concurrently` para lanzar ambos procesos en una sola terminal:

- **API** → `npm run server:dev` (servidor Express con hot reload via `tsx watch`)
- **EXT** → `npm run start:dev` (webpack-dev-server en `https://localhost:3000`)

> **Nota**: Antes de ejecutar, asegúrate de haber instalado también las dependencias del servidor con `npm run server:install`.

Si solo necesitas compilar la extensión sin levantar el servidor:

```bash
npm run build:dev
```

### Producción

```bash
npm run build
```

Esto genera un archivo `.vsix` que puede subirse al [Visual Studio Marketplace](https://marketplace.visualstudio.com/azuredevops).

## 📦 Scripts disponibles

| Script                      | Descripción                                     |
| --------------------------- | ----------------------------------------------- |
| `npm run clean`             | Limpia la carpeta `dist`                        |
| `npm run compile`           | Compila en modo producción                      |
| `npm run compile:dev`       | Compila en modo desarrollo                      |
| `npm run build`             | Alias de `compile`                              |
| `npm run build:dev`         | Compila y empaqueta con incremento de versión   |
| `npm run package-extension` | Empaqueta la extensión en un archivo `.vsix`    |
| `npm run publish-extension` | Publica la extensión en el Marketplace          |
| `npm run start:dev`         | Inicia el servidor de desarrollo con hot reload |
| `npm run dev`               | Ejecuta API + extensión simultáneamente          |
| `npm run server:install`    | Instala dependencias del servidor (API)          |
| `npm run server:dev`        | Inicia solo la API en modo desarrollo            |

## 🏗️ Estructura del proyecto

```
├── src/
│   ├── Hub/
│   │   ├── copilot-hub-group.tsx    # Componente principal del chat
│   │   ├── copilot-hub-group.html   # Página HTML del hub
│   │   ├── copilot-hub-group.json   # Configuración de contribuciones
│   │   └── copilot-hub-group.scss   # Estilos del chat
│   ├── Common.tsx                    # Componentes compartidos
│   └── Common.scss                   # Estilos compartidos
├── static/                           # Recursos estáticos (iconos, imágenes)
├── azure-devops-extension.json       # Manifiesto de la extensión
└── azure-devops-extension-dev.json   # Manifiesto para desarrollo
```

## 🔧 Configuración

### Publicar tu propia extensión

1. Crea un publicador en el [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
2. Modifica el campo `publisher` en `azure-devops-extension.json`
3. Ejecuta `npm run publish-extension`

## 🛠️ Desarrollo local con Hot Reload

Esta extensión está configurada para desarrollo local con **hot reload**, lo que permite ver los cambios en tiempo real sin necesidad de republicar la extensión en cada modificación.

### ¿Cómo funciona?

El "truco" consiste en usar la propiedad `baseUri` en el manifiesto de desarrollo (`azure-devops-extension-dev.json`). Esta propiedad le indica a Azure DevOps que cargue los recursos de la extensión desde tu servidor local (`https://localhost:3000`) en lugar del paquete publicado.

### Configuración paso a paso

#### 1. Configurar el manifiesto de desarrollo

El archivo `azure-devops-extension-dev.json` debe incluir:

```json
{
    "baseUri": "https://localhost:3000",
    ...
}
```

#### 2. Crear un Personal Access Token (PAT)

1. Ve a [Azure DevOps](https://dev.azure.com) → User Settings → Personal Access Tokens
2. Crea un nuevo token con scope **Marketplace → Manage**
3. Asegúrate de seleccionar **All accessible organizations**
4. Guarda el token en un archivo `.env`:

```bash
AZURE_DEVOPS_PAT=tu_token_aqui
```

#### 3. Publicar la extensión de desarrollo (solo la primera vez)

```bash
source .env && npm run publish-extension:dev -- --token $AZURE_DEVOPS_PAT
```

Después de publicar, ve al [Marketplace](https://marketplace.visualstudio.com/manage) y:

- Comparte la extensión con tu organización de Azure DevOps
- Instala la extensión en tu organización

#### 4. Iniciar el servidor de desarrollo

```bash
npm run start:dev
```

Esto inicia webpack-dev-server en `https://localhost:3000` con HTTPS.

#### 5. Aceptar el certificado SSL

1. Abre `https://localhost:3000` en tu navegador
2. Acepta el certificado auto-firmado (Advanced → Proceed)

> **Nota para Edge**: Si Edge bloquea el certificado, ve a `edge://flags/#allow-insecure-localhost` y activa la opción.

#### 6. Usar la extensión

1. Ve a tu proyecto en Azure DevOps
2. La extensión cargará los recursos desde `localhost:3000`
3. Los cambios en el código se reflejan automáticamente 🔥

### Flujo de trabajo recomendado

```bash
# Instalar dependencias (solo la primera vez o cuando cambien)
npm install && npm run server:install

# Arrancar API + extensión con un solo comando
npm run dev

# En otra terminal, si necesitas republicar el manifiesto
source .env && npm run publish-extension:dev -- --token $AZURE_DEVOPS_PAT
```

> **Importante**: Solo necesitas republicar cuando cambies los archivos `*.json` (manifiestos). Los cambios en código TypeScript/SCSS se recargan automáticamente.

### Solución de problemas

| Problema                  | Solución                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| Certificado SSL rechazado | Activa `edge://flags/#allow-insecure-localhost` o usa Firefox              |
| 404 en recursos           | Verifica que `output.publicPath` en webpack esté configurado como `/dist/` |
| Extensión no carga        | Asegúrate de que el servidor está corriendo y el puerto 3000 está libre    |

## � Publicar en Producción

Una vez que hayas terminado el desarrollo y todo funcione correctamente, sigue estos pasos para publicar la versión de producción:

### 1. Compilar para producción

```bash
npm run build
```

Esto genera el bundle optimizado y crea el archivo `.vsix`.

### 2. Publicar la extensión de producción

```bash
source .env && npm run publish-extension -- --token $AZURE_DEVOPS_PAT
```

> **Nota**: La extensión de producción usa `azure-devops-extension.json`, que **no tiene** `baseUri`, por lo que carga los recursos desde el paquete publicado en el Marketplace.

### 3. Actualizar en Azure DevOps

Si ya tenías instalada la extensión de desarrollo (`github-copilot-chat-dev`), puedes:

- **Opción A**: Desinstalar la versión de desarrollo e instalar la de producción
- **Opción B**: Mantener ambas versiones (tienen IDs diferentes)

### Diferencias entre desarrollo y producción

| Aspecto                 | Desarrollo (`-dev`)               | Producción                        |
| ----------------------- | --------------------------------- | --------------------------------- |
| Manifiesto              | `azure-devops-extension-dev.json` | `azure-devops-extension.json`     |
| `baseUri`               | `https://localhost:3000`          | _(no definido - usa Marketplace)_ |
| ID de extensión         | `github-copilot-chat-dev`         | `github-copilot-chat`             |
| Requiere servidor local | ✅ Sí                             | ❌ No                             |
| Hot reload              | ✅ Sí                             | ❌ No                             |

### Flujo completo de desarrollo a producción

```bash
# 1. Desarrollar con hot reload
npm run start:dev

# 2. Hacer cambios y probar en Azure DevOps...

# 3. Cuando todo esté listo, compilar para producción
npm run build

# 4. Publicar versión de producción
source .env && npm run publish-extension -- --token $AZURE_DEVOPS_PAT

# 5. ¡Listo! La extensión está disponible en el Marketplace
```

## �📚 Dependencias principales

- [azure-devops-extension-sdk](https://github.com/Microsoft/azure-devops-extension-sdk) - SDK para extensiones de Azure DevOps
- [azure-devops-extension-api](https://github.com/Microsoft/azure-devops-extension-api) - APIs REST de Azure DevOps
- [azure-devops-ui](https://developer.microsoft.com/azure-devops) - Componentes UI de Azure DevOps
- React 16.x - Framework de UI
- TypeScript - Tipado estático
- Webpack - Bundler

## 📖 Documentación

- [Documentación de extensiones de Azure DevOps](https://docs.microsoft.com/en-us/azure/devops/extend/?view=azure-devops)
- [Puntos de contribución de Azure DevOps](https://learn.microsoft.com/en-us/azure/devops/extend/reference/targets/overview?view=azure-devops)
- [Guía de publicación de extensiones](https://docs.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops)

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
