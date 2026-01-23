# 🐳 Docker Deployment Guide

This guide explains how to deploy and use the GitHub Copilot CLI Server as a Docker container.

## Overview

The Docker image includes:
- GitHub Copilot CLI (`@github/copilot`)
- GitHub Copilot SDK (`@github/copilot-sdk`)
- Express.js server with REST API endpoints
- Health check endpoint
- Support for streaming responses
- Graceful shutdown handling

## Quick Start

### Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later (optional)
- GitHub account with Copilot access
- GitHub token with Copilot permissions

### Using Docker Compose (Recommended)

1. **Create a `.env` file** in the project root:

```bash
cat > .env << EOF
GITHUB_TOKEN=ghp_your_token_here
COPILOT_PORT=3000
LOG_LEVEL=info
EOF
```

2. **Start the server**:

```bash
docker-compose up -d
```

3. **Check the health**:

```bash
curl http://localhost:3000/health
```

4. **View logs**:

```bash
docker-compose logs -f
```

5. **Stop the server**:

```bash
docker-compose down
```

### Using Docker CLI

1. **Build the image**:

```bash
docker build -t copilot-server:latest .
```

2. **Run the container**:

```bash
docker run -d \
  --name copilot-server \
  -p 3000:3000 \
  -e GITHUB_TOKEN=ghp_your_token_here \
  -e COPILOT_PORT=3000 \
  -e LOG_LEVEL=info \
  copilot-server:latest
```

3. **Check the health**:

```bash
curl http://localhost:3000/health
```

4. **Stop the container**:

```bash
docker stop copilot-server
docker rm copilot-server
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_TOKEN` | GitHub personal access token with Copilot access | - | Yes |
| `COPILOT_PORT` | Port for the server to listen on | `3000` | No |
| `LOG_LEVEL` | Logging verbosity: debug, info, warn, error | `info` | No |

## API Endpoints

### GET `/health`

Health check endpoint for monitoring and load balancers.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-23T10:30:00.000Z",
  "uptime": 123.45,
  "version": "1.0.0"
}
```

### GET `/`

Get server information and available endpoints.

**Response:**
```json
{
  "service": "GitHub Copilot CLI Server",
  "version": "1.0.0",
  "endpoints": {
    "health": "GET /health",
    "query": "POST /query",
    "queryStream": "POST /query/stream"
  },
  "documentation": "https://github.com/0GiS0/github-copilot-chat-extension-ado"
}
```

### POST `/query`

Send a query to GitHub Copilot and receive a complete response.

**Request:**
```json
{
  "prompt": "Write a TypeScript function that sorts an array",
  "model": "gpt-4"
}
```

**Response:**
```json
{
  "response": "Here's a TypeScript function that sorts an array...",
  "model": "gpt-4",
  "timestamp": "2024-01-23T10:30:00.000Z"
}
```

### POST `/query/stream`

Send a query to GitHub Copilot and receive a streaming response via Server-Sent Events (SSE).

**Request:**
```json
{
  "prompt": "Explain how Docker works",
  "model": "gpt-4"
}
```

**Response (Server-Sent Events):**
```
data: {"type":"start","timestamp":"2024-01-23T10:30:00.000Z"}

data: {"type":"chunk","content":"Docker is a "}

data: {"type":"chunk","content":"platform for "}

data: {"type":"chunk","content":"containerization..."}

data: {"type":"done","timestamp":"2024-01-23T10:30:05.000Z"}
```

## Usage Examples

### Using cURL

**Non-streaming query:**
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a hello world in Python",
    "model": "gpt-4"
  }'
```

**Streaming query:**
```bash
curl -N -X POST http://localhost:3000/query/stream \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain async/await in JavaScript",
    "model": "gpt-4"
  }'
```

### Using JavaScript

**Non-streaming:**
```javascript
const response = await fetch('http://localhost:3000/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Write a sorting algorithm',
    model: 'gpt-4'
  })
});

const data = await response.json();
console.log(data.response);
```

**Streaming:**
```javascript
const response = await fetch('http://localhost:3000/query/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Explain Docker',
    model: 'gpt-4'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'chunk') {
        console.log(data.content);
      }
    }
  }
}
```

## GitHub Container Registry

The image is automatically published to GitHub Container Registry (GHCR) on every push to `main` and on releases.

### Pull the Image

```bash
docker pull ghcr.io/0gis0/github-copilot-chat-extension-ado:latest
```

### Run from GHCR

```bash
docker run -d \
  --name copilot-server \
  -p 3000:3000 \
  -e GITHUB_TOKEN=ghp_your_token_here \
  ghcr.io/0gis0/github-copilot-chat-extension-ado:latest
```

## Production Deployment

### Kubernetes

Create a deployment YAML:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: copilot-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: copilot-server
  template:
    metadata:
      labels:
        app: copilot-server
    spec:
      containers:
      - name: copilot-server
        image: ghcr.io/0gis0/github-copilot-chat-extension-ado:latest
        ports:
        - containerPort: 3000
        env:
        - name: GITHUB_TOKEN
          valueFrom:
            secretKeyRef:
              name: github-token
              key: token
        - name: COPILOT_PORT
          value: "3000"
        - name: LOG_LEVEL
          value: "info"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: copilot-server
spec:
  selector:
    app: copilot-server
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Docker Swarm

Create a stack file:

```yaml
version: '3.8'

services:
  copilot-server:
    image: ghcr.io/0gis0/github-copilot-chat-extension-ado:latest
    ports:
      - "3000:3000"
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - COPILOT_PORT=3000
      - LOG_LEVEL=info
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
      update_config:
        parallelism: 1
        delay: 10s
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  default:
    driver: overlay
```

Deploy:

```bash
docker stack deploy -c stack.yml copilot
```

## Monitoring and Logging

### Health Checks

The container includes a built-in health check that runs every 30 seconds:

```bash
docker ps
```

Look for the `STATUS` column to see health status.

### View Logs

```bash
# Using Docker Compose
docker-compose logs -f copilot-server

# Using Docker CLI
docker logs -f copilot-server
```

### Log Levels

Control verbosity with the `LOG_LEVEL` environment variable:

- `debug` - All messages including debug info
- `info` - Informational messages and above (default)
- `warn` - Warnings and errors only
- `error` - Error messages only

## Troubleshooting

### Container won't start

1. Check logs:
```bash
docker logs copilot-server
```

2. Verify GitHub token:
```bash
docker exec copilot-server printenv GITHUB_TOKEN
```

3. Check port availability:
```bash
netstat -tuln | grep 3000
```

### Connection refused

1. Verify container is running:
```bash
docker ps | grep copilot-server
```

2. Check port mapping:
```bash
docker port copilot-server
```

3. Test from inside container:
```bash
docker exec copilot-server curl http://localhost:3000/health
```

### Copilot authentication fails

1. Ensure your GitHub token has Copilot access
2. Check token expiration
3. Verify token permissions include `copilot`

### High memory usage

The Copilot SDK may use significant memory. Consider:
- Setting memory limits in Docker
- Adjusting the number of replicas
- Using a larger instance type

## Security Best Practices

1. **Never commit your GitHub token** - Use environment variables or secrets management
2. **Use non-root user** - The image runs as user `nodejs` (UID 1001)
3. **Scan for vulnerabilities** - Regularly update the base image
4. **Use secrets management** - For production, use Docker secrets, Kubernetes secrets, or a vault
5. **Enable TLS** - Put the container behind a reverse proxy with HTTPS

## Development

### Local Development

```bash
# Build locally
docker build -t copilot-server:dev .

# Run with hot reload (mount source code)
docker run -it \
  -p 3000:3000 \
  -v $(pwd)/src/server:/app \
  -e GITHUB_TOKEN=ghp_your_token_here \
  copilot-server:dev
```

### Testing

Test the endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Info endpoint
curl http://localhost:3000/

# Query endpoint
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello Copilot"}'
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For issues and questions:
- GitHub Issues: https://github.com/0GiS0/github-copilot-chat-extension-ado/issues
- Documentation: https://github.com/0GiS0/github-copilot-chat-extension-ado
