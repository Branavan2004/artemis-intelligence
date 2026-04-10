# WSO2 Streaming Integrator — Artemis Intelligence

This directory contains the WSO2 Streaming Integrator (SI) configuration for Artemis Intelligence. It models the real-time telemetry pipeline as a formal event-driven architecture, enabling complex event processing (CEP) and stream analytics.

## 🚀 Overview
WSO2 Streaming Integrator is an open-source, cloud-native streaming data integration server. It allows us to:
- **Filter and Transform**: Process raw telemetry frames before they reach the dashboard.
- **Complex Event Processing**: Detect critical state changes (faults) by correlating events over time.
- **Analytics**: Calculate sliding-window aggregates (e.g., 5-minute averages) for mission-critical metrics.

## 📡 Mapping to Existing Architecture

### TelemetryStream
Maps to the real-time telemetry feed currently handled by Socket.IO. By integrating SI, the backend can delegate the heavy lifting of windowing and anomaly detection to the Siddhi engine.

### DSNStatusStream
Captures Deep Space Network station status updates, which are traditionally cached in Redis. SI can react to sudden drops in signal strength to trigger automated mission alerts.

### AnomalyAlertStream
A new dedicated stream for high-severity issues. When a `FAULT` is detected in any system, SI pushes a JSON alert to the backend's ingestion endpoint:
`http://localhost:4000/api/anomalies/ingest`

## 🛠 Running SI Locally
1. Install [WSO2 Streaming Integrator](https://wso2.com/integration/streaming-integrator/).
2. Copy `telemetry-stream.siddhi` to the `/deployment/siddhi-files/` directory.
3. Start the SI runner:
   ```bash
   bash bin/server.sh
   ```
4. Access the SI Dashboard at `http://localhost:9090`.

## ☁️ Production Deployment (Choreo)
In a production environment on **Choreo**, this Siddhi application would be deployed as an **Event-Driven Service**. 
- Choreo provides native support for Siddhi, allowing you to connect GitHub repositories directly to SI components.
- The PostgreSQL datasource in `deployment.yaml` should be updated to point to the Choreo-managed database service.
