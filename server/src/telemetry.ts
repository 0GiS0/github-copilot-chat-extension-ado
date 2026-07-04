import appInsights from "applicationinsights";

import { config } from "./config.js";
import { log } from "./logger.js";

let telemetryInitialized = false;

export function initializeTelemetry(): void {
    if (telemetryInitialized || !config.appInsightsConnectionString) {
        return;
    }

    appInsights
        .setup(config.appInsightsConnectionString)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true, true)
        .setUseDiskRetryCaching(true)
        .start();

    telemetryInitialized = true;
    log.info("Application Insights telemetry enabled.");
}
