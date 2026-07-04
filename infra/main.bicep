targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Short prefix used to name the Azure resources.')
@maxLength(12)
param namePrefix string = 'copilotado'

@description('Environment label appended to resource names.')
@maxLength(8)
param environmentName string = 'dev'

@description('Azure DevOps organization name consumed by the backend.')
param adoOrg string

@secure()
@description('GitHub OAuth application client ID used by Device Flow.')
param githubClientId string

@secure()
@description('Azure DevOps PAT used as the MCP fallback token for backend tools.')
param adoMcpAuthToken string

@description('App Service plan SKU name.')
param servicePlanSkuName string = 'B1'

@description('App Service plan SKU tier.')
param servicePlanSkuTier string = 'Basic'

@description('Startup command executed by the App Service deployment.')
param startupCommand string = 'npm start'

@description('Keeps the backend warm to reduce cold starts.')
param enableAlwaysOn bool = true

@description('Optional tags applied to every resource.')
param tags object = {}

var suffix = take(uniqueString(resourceGroup().id, namePrefix, environmentName), 6)
var baseName = toLower('${namePrefix}-${environmentName}-${suffix}')
var appServicePlanName = '${baseName}-plan'
var webAppName = '${baseName}-api'
var logAnalyticsName = '${baseName}-logs'
var appInsightsName = '${baseName}-appi'
var keyVaultName = take('${baseName}-kv', 24)

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: servicePlanSkuName
    tier: servicePlanSkuTier
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      appCommandLine: startupCommand
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: enableAlwaysOn
      healthCheckPath: '/health'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
    }
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: webApp.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    enableRbacAuthorization: false
    publicNetworkAccess: 'Enabled'
  }
}

resource githubClientIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'github-client-id'
  properties: {
    value: githubClientId
  }
}

resource adoMcpAuthTokenSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ado-mcp-auth-token'
  properties: {
    value: adoMcpAuthToken
  }
}

resource webAppAppSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'appsettings'
  properties: {
    NODE_ENV: 'production'
    WEBSITE_NODE_DEFAULT_VERSION: '~20'
    GITHUB_CLIENT_ID: '@Microsoft.KeyVault(SecretUri=${githubClientIdSecret.properties.secretUriWithVersion})'
    ADO_ORG: adoOrg
    ADO_MCP_AUTH_TOKEN: '@Microsoft.KeyVault(SecretUri=${adoMcpAuthTokenSecret.properties.secretUriWithVersion})'
    APPLICATIONINSIGHTS_CONNECTION_STRING: applicationInsights.properties.ConnectionString
  }
}

output webAppName string = webApp.name
output proxyBaseUrl string = 'https://${webApp.properties.defaultHostName}'
output healthEndpoint string = 'https://${webApp.properties.defaultHostName}/health'
output applicationInsightsName string = applicationInsights.name
output keyVaultName string = keyVault.name
