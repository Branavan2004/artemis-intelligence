# WSO2 API Manager Integration — Artemis Intelligence

This directory contains the WSO2 API Manager (APIM) artifacts for Artemis Intelligence. These files define the API governance, security, and throttling model for the mission control dashboard.

## 🚀 Getting Started

### 1. Import OpenAPI Specification
1. Log in to the [WSO2 API Publisher Portal](https://apim.docs.wso2.com/en/latest/design/create-api/create-rest-api/create-a-rest-api-from-an-openapi-definition/).
2. Select **Create API** -> **I Have an OpenAPI Definition**.
3. Upload `openapi.yaml`.
4. Set the **Endpoint** to your backend URL (e.g., `https://artemis-intelligence-backend.railway.app/api`).

### 2. Configure Throttling
1. Go to **API Configurations** -> **Policies**.
2. Upload `throttling-policy.yaml` or manually configure:
   - **AuthPolicy**: 10 req / 15 min.
   - **GlobalPolicy**: 100 req / min.
   - **DSNPolicy**: Custom 8-second refresh window.

### 3. WebSocket Pass-through
For Socket.IO telemetry feeds:
1. Ensure the **Transport** settings in the API include `ws` or `wss`.
2. Map the WebSocket endpoint to your backend's Socket.IO port (default 4000).
3. The APIM Gateway handles the protocol upgrade seamlessly.

## 📡 NASA External API Proxy
The Artemis Intelligence backend proxies 5 NASA external APIs. By using WSO2 APIM, we can add an additional layer of security and caching:
- **JPL Horizons**: Proxied via `/api/telemetry`.
- **NASA DONKI**: Proxied via `/api/telemetry` (Space Weather).
- **images-api.nasa.gov**: Proxied via `/api/mission/images`.
- **DSN Now**: Proxied via `/api/dsn`.
- **APOD**: Proxied via `/api/mission/apod`.

## 🔒 Security Model
- **Authentication**: JWT Bearer Auth is required for all sensitive endpoints.
- **Throttling**: Aligned with existing Express rate limiters to prevent gateway-backend mismatch.
