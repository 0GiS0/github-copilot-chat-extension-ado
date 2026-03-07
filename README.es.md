# GitHub Copilot Chat for Azure DevOps

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1) [![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0) [![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Sígueme-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/) [![X Follow](https://img.shields.io/badge/X-Sígueme-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>

---

🌍 *[Read in English](README.md)*

¡Hola developer 👋🏻! Este proyecto es una extensión de Azure DevOps que integra GitHub Copilot Chat directamente en tu flujo de trabajo de desarrollo.

<div align="center">
  <img src="static/copilot-icon.png" alt="GitHub Copilot Chat Extension" width="200" />
</div>

---

## ✨ Características

- 💬 Interfaz de chat integrada en Azure DevOps
- 🤖 Integración con GitHub Copilot para asistencia de código
- 🎨 UI nativa que se adapta al tema de Azure DevOps
- 🔐 Autenticación OAuth con GitHub Device Flow
- 🔄 Hot Reload para desarrollo local

## 📋 Requisitos Previos

- Azure DevOps organization
- Node.js 18+
- [tfx-cli](https://github.com/microsoft/tfs-cli)
- Cuenta de GitHub con acceso a Copilot

## 🚀 Instalación

```bash
# Clonar e instalar
git clone https://github.com/0GiS0/github-copilot-chat-extension-ado.git
cd github-copilot-chat-extension-ado
npm install && npm run server:install

# Configurar variables de entorno en server/.env
GITHUB_CLIENT_ID=tu_client_id
GITHUB_CLIENT_SECRET=tu_client_secret
ADO_ORG=tu_organizacion_ado
```

## 💻 Uso

```bash
# Desarrollo (API + extensión con hot reload)
npm run dev

# Producción (genera .vsix)
npm run build
```

## 📦 Scripts Principales

| Script | Descripción |
| ------ | ----------- |
| `npm run dev` | API + extensión simultáneamente |
| `npm run build` | Compila para producción |
| `npm run start:dev` | Solo webpack-dev-server |
| `npm run server:dev` | Solo API |

## 🛠️ Desarrollo con Hot Reload

1. Configura `baseUri: "https://localhost:3000"` en `azure-devops-extension-dev.json`
2. Crea un PAT en Azure DevOps con scope **Marketplace → Manage**
3. Publica la extensión de desarrollo:
   ```bash
   source .env && npm run publish-extension:dev -- --token $AZURE_DEVOPS_PAT
   ```
4. Ejecuta `npm run dev` y acepta el certificado SSL en `https://localhost:3000`

## 📖 Documentación

- [Extensiones de Azure DevOps](https://docs.microsoft.com/en-us/azure/devops/extend/)
- [Guía de publicación](https://docs.microsoft.com/en-us/azure/devops/extend/publish/overview)

## 📄 Licencia

MIT - Ver [LICENSE](LICENSE)

---

## 🌐 Sígueme en Mis Redes Sociales

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1) [![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0) [![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Sígueme-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/) [![X Follow](https://img.shields.io/badge/X-Sígueme-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>
