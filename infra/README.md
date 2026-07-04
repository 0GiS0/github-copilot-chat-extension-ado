# Azure deployment infrastructure

This directory contains the Bicep needed to provision the Azure resources that host the backend proxy for the Azure DevOps extension.

## Resources

- Linux App Service plan
- Linux Web App for the `server/` backend
- Log Analytics workspace
- Application Insights connected to that workspace
- Key Vault for the backend secrets consumed by App Service

## Deploy

1. Create or choose a resource group.
2. Update `infra/main.parameters.json` with your non-secret values.
3. Run the deployment and provide the secret parameters inline:

```bash
az deployment group create \
  --resource-group <resource-group-name> \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --parameters githubClientId="<github-oauth-client-id>" adoMcpAuthToken="<azure-devops-pat>"
```

The deployment returns a `proxyBaseUrl` output. Use that URL when building the extension package for Azure:

```bash
COPILOT_PROXY_BASE_URL="https://<your-web-app>.azurewebsites.net" npm run build
```

Deploy the contents of `server/` to the created Web App so the `npm start` command can run the compiled backend.
