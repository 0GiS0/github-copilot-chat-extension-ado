# GitHub Copilot Chat for Azure DevOps

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

### Desarrollo local

1. Modifica `azure-devops-extension-dev.json` con tu publisher ID
2. Ejecuta `npm run publish-extension:dev` para publicar una versión de desarrollo

## 📚 Dependencias principales

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
