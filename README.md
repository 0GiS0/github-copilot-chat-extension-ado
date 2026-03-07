# GitHub Copilot Chat for Azure DevOps

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1) [![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0) [![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Follow-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/) [![X Follow](https://img.shields.io/badge/X-Follow-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>

---

🌍 *[Leer en español](README.es.md)*

Hey developer 👋🏻! This project is an Azure DevOps extension that integrates GitHub Copilot Chat directly into your development workflow.

<div align="center">
  <img src="static/copilot-icon.png" alt="GitHub Copilot Chat Extension" width="200" />
</div>

---

## 📌 Project Summary

This repository contains an Azure DevOps extension that brings GitHub Copilot Chat directly into the Azure DevOps experience. Its goal is to provide AI-powered assistance inside the tools teams already use every day, including repositories, pipelines, work items, and broader Azure DevOps workflows, without forcing users to leave the platform.


## ✨ Features

- 💬 Chat interface integrated into Azure DevOps
- 🤖 GitHub Copilot integration for code assistance
- 🎨 Native UI that adapts to Azure DevOps theme
- 🔐 OAuth authentication with GitHub Device Flow
- 🔄 Hot Reload for local development

## 📋 Prerequisites

- Azure DevOps organization
- Node.js 18+
- [tfx-cli](https://github.com/microsoft/tfs-cli)
- GitHub account with Copilot access

## 🚀 Installation

```bash
# Clone and install
git clone https://github.com/0GiS0/github-copilot-chat-extension-ado.git
cd github-copilot-chat-extension-ado
npm install && npm run server:install

# Configure environment variables in server/.env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
ADO_ORG=your_ado_organization
```

## 💻 Usage

```bash
# Development (API + extension with hot reload)
npm run dev

# Production (generates .vsix)
npm run build
```

## 📦 Main Scripts

| Script | Description |
| ------ | ----------- |
| `npm run dev` | API + extension simultaneously |
| `npm run build` | Build for production |
| `npm run start:dev` | Only webpack-dev-server |
| `npm run server:dev` | Only API |

## 🛠️ Development with Hot Reload

1. Set `baseUri: "https://localhost:3000"` in `azure-devops-extension-dev.json`
2. Create a PAT in Azure DevOps with scope **Marketplace → Manage**
3. Publish the development extension:
   ```bash
   source .env && npm run publish-extension:dev -- --token $AZURE_DEVOPS_PAT
   ```
4. Run `npm run dev` and accept the SSL certificate at `https://localhost:3000`

## 📖 Documentation

- [Azure DevOps Extensions](https://docs.microsoft.com/en-us/azure/devops/extend/)
- [Publishing Guide](https://docs.microsoft.com/en-us/azure/devops/extend/publish/overview)

## 📄 License

MIT - See [LICENSE](LICENSE)

---

## 🌐 Follow Me on Social Media

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1) [![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0) [![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Follow-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/) [![X Follow](https://img.shields.io/badge/X-Follow-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>
