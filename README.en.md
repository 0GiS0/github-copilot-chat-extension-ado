# GitHub Copilot Chat for Azure DevOps

🌍 *[Leer en español](README.md)*

An Azure DevOps extension that integrates GitHub Copilot Chat directly into your development workflow.

![GitHub Copilot Chat Extension](static/copilot-icon.png)

## ✨ Features

- 💬 Chat interface integrated into Azure DevOps
- 🤖 GitHub Copilot integration for code assistance
- 🎨 Native UI that adapts to Azure DevOps theme

## 📋 Prerequisites

- An Azure DevOps organization
- Node.js 16+
- npm or yarn
- [tfx-cli](https://github.com/microsoft/tfs-cli) to package and publish the extension

## 🚀 Quick Start

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run build:dev
```

### Production

```bash
npm run build
```

This generates a `.vsix` file that can be uploaded to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/azuredevops).

## 📦 Available Scripts

| Script                      | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `npm run clean`             | Cleans the `dist` folder                           |
| `npm run compile`           | Compiles in production mode                        |
| `npm run compile:dev`       | Compiles in development mode                       |
| `npm run build`             | Alias for `compile`                                |
| `npm run build:dev`         | Compiles and packages with version increment       |
| `npm run package-extension` | Packages the extension into a `.vsix` file         |
| `npm run publish-extension` | Publishes the extension to the Marketplace         |
| `npm run start:dev`         | Starts the development server with hot reload      |
| `npm run dev`               | Runs both server and client concurrently           |

## 🏗️ Project Structure

```
├── src/
│   ├── Hub/
│   │   ├── copilot-hub-group.tsx    # Main chat component
│   │   ├── copilot-hub-group.html   # Hub HTML page
│   │   ├── copilot-hub-group.json   # Contribution configuration
│   │   └── copilot-hub-group.scss   # Chat styles
│   ├── Common.tsx                    # Shared components
│   └── Common.scss                   # Shared styles
├── static/                           # Static resources (icons, images)
├── azure-devops-extension.json       # Extension manifest
└── azure-devops-extension-dev.json   # Development manifest
```

## 🔧 Configuration

### Publishing Your Own Extension

1. Create a publisher in the [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
2. Modify the `publisher` field in `azure-devops-extension.json`
3. Run `npm run publish-extension`

## 🛠️ Local Development with Hot Reload

This extension is configured for local development with **hot reload**, allowing you to see changes in real-time without needing to republish the extension for each modification.

### How Does It Work?

The "trick" is to use the `baseUri` property in the development manifest (`azure-devops-extension-dev.json`). This property tells Azure DevOps to load the extension resources from your local server (`https://localhost:3000`) instead of the published package.

### Step-by-Step Configuration

#### 1. Configure the Development Manifest

The `azure-devops-extension-dev.json` file should include:

```json
{
    "baseUri": "https://localhost:3000",
    ...
}
```

#### 2. Create a Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com) → User Settings → Personal Access Tokens
2. Create a new token with scope **Marketplace → Manage**
3. Make sure to select **All accessible organizations**
4. Save the token in a `.env` file:

```bash
AZURE_DEVOPS_PAT=your_token_here
```

#### 3. Publish the Development Extension (First Time Only)

```bash
source .env && npm run publish-extension:dev -- --token $AZURE_DEVOPS_PAT
```

After publishing, go to the [Marketplace](https://marketplace.visualstudio.com/manage) and:

- Share the extension with your Azure DevOps organization
- Install the extension in your organization

#### 4. Start the Development Server

```bash
npm run start:dev
```

This starts webpack-dev-server at `https://localhost:3000` with HTTPS.

#### 5. Accept the SSL Certificate

1. Open `https://localhost:3000` in your browser
2. Accept the self-signed certificate (Advanced → Proceed)

> **Note for Edge**: If Edge blocks the certificate, go to `edge://flags/#allow-insecure-localhost` and enable the option.

#### 6. Use the Extension

1. Go to your project in Azure DevOps
2. The extension will load resources from `localhost:3000`
3. Code changes are reflected automatically 🔥

### Recommended Workflow

```bash
# Terminal 1: Development server (keep it running)
npm run start:dev

# Terminal 2: When you need to republish the manifest
source .env && npm run publish-extension:dev -- --token $AZURE_DEVOPS_PAT
```

> **Important**: You only need to republish when you change the `*.json` files (manifests). TypeScript/SCSS code changes are reloaded automatically.

### Troubleshooting

| Problem                 | Solution                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| SSL certificate rejected | Enable `edge://flags/#allow-insecure-localhost` or use Firefox              |
| 404 on resources        | Verify that `output.publicPath` in webpack is set to `/dist/`                |
| Extension won't load    | Make sure the server is running and port 3000 is available                   |

## 🚀 Publishing to Production

Once you've finished development and everything works correctly, follow these steps to publish the production version:

### 1. Build for Production

```bash
npm run build
```

This generates the optimized bundle and creates the `.vsix` file.

### 2. Publish the Production Extension

```bash
source .env && npm run publish-extension -- --token $AZURE_DEVOPS_PAT
```

> **Note**: The production extension uses `azure-devops-extension.json`, which **does not have** `baseUri`, so it loads resources from the package published in the Marketplace.

### 3. Update in Azure DevOps

If you already had the development extension installed (`github-copilot-chat-dev`), you can:

- **Option A**: Uninstall the development version and install the production one
- **Option B**: Keep both versions (they have different IDs)

### Differences Between Development and Production

| Aspect                  | Development (`-dev`)              | Production                        |
| ----------------------- | --------------------------------- | --------------------------------- |
| Manifest                | `azure-devops-extension-dev.json` | `azure-devops-extension.json`     |
| `baseUri`               | `https://localhost:3000`          | _(not defined - uses Marketplace)_ |
| Extension ID            | `github-copilot-chat-dev`         | `github-copilot-chat`             |
| Requires local server   | ✅ Yes                            | ❌ No                             |
| Hot reload              | ✅ Yes                            | ❌ No                             |

### Complete Development to Production Workflow

```bash
# 1. Develop with hot reload
npm run start:dev

# 2. Make changes and test in Azure DevOps...

# 3. When everything is ready, build for production
npm run build

# 4. Publish production version
source .env && npm run publish-extension -- --token $AZURE_DEVOPS_PAT

# 5. Done! The extension is available in the Marketplace
```

## 📚 Main Dependencies

- [azure-devops-extension-sdk](https://github.com/Microsoft/azure-devops-extension-sdk) - SDK for Azure DevOps extensions
- [azure-devops-extension-api](https://github.com/Microsoft/azure-devops-extension-api) - Azure DevOps REST APIs
- [azure-devops-ui](https://developer.microsoft.com/azure-devops) - Azure DevOps UI components
- React 16.x - UI Framework
- TypeScript - Static typing
- Webpack - Bundler

## 📖 Documentation

- [Azure DevOps Extensions Documentation](https://docs.microsoft.com/en-us/azure/devops/extend/?view=azure-devops)
- [Azure DevOps Contribution Points](https://learn.microsoft.com/en-us/azure/devops/extend/reference/targets/overview?view=azure-devops)
- [Extension Publishing Guide](https://docs.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops)

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
