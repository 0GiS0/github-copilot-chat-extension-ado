import "./pipeline-sessions.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";

import { getClient } from "azure-devops-extension-api/Common";
import {
  Build,
  BuildDefinitionReference,
  BuildRestClient,
  BuildStatus,
  DefinitionQueryOrder,
} from "azure-devops-extension-api/Build";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";

interface IPipelineDefinitionOption {
  id: number;
  name: string;
  latestBuildNumber: string | null;
}

interface ISessionMetadata {
  sessionId: string | null;
  relayUrl: string | null;
  viewerUrl: string | null;
  metadataSource: string | null;
}

interface IRunViewModel extends ISessionMetadata {
  id: number;
  buildNumber: string;
  definitionId: number;
  definitionName: string;
  requestedBy: string;
  queueTime: string | null;
  sourceBranch: string | null;
  statusLabel: string;
  statusClassName: string;
  resultLabel: string | null;
  webUrl: string | null;
}

interface IPipelineSessionsState {
  projectName: string | null;
  projectId: string | null;
  isLoadingDefinitions: boolean;
  isLoadingRuns: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
  definitions: IPipelineDefinitionOption[];
  selectedDefinitionId: number | null;
  runs: IRunViewModel[];
  lastUpdated: string | null;
  copyFeedback: string | null;
}

const RUNNING_BUILD_STATUSES =
  BuildStatus.InProgress | BuildStatus.NotStarted | BuildStatus.Cancelling;

const SESSION_PROPERTY_KEYS = [
  "copilot.sessionId",
  "copilotSessionId",
];

const RELAY_PROPERTY_KEYS = [
  "copilot.relayUrl",
  "copilotRelayUrl",
];

const VIEWER_PROPERTY_KEYS = [
  "copilot.viewerUrl",
  "copilotViewerUrl",
];

class PipelineSessionsHub extends React.Component<{}, IPipelineSessionsState> {
  private buildClient = getClient(BuildRestClient);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(props: {}) {
    super(props);
    this.state = {
      projectName: null,
      projectId: null,
      isLoadingDefinitions: true,
      isLoadingRuns: false,
      errorMessage: null,
      infoMessage: null,
      definitions: [],
      selectedDefinitionId: null,
      runs: [],
      lastUpdated: null,
      copyFeedback: null,
    };
  }

  public async componentDidMount() {
    try {
      await SDK.init();
      await SDK.ready();

      const webContext = SDK.getWebContext();
      const projectName = webContext.project ? webContext.project.name : null;
      const projectId = webContext.project ? webContext.project.id : null;

      this.setState({
        projectName,
        projectId,
      });

      if (!projectName) {
        this.setState({
          isLoadingDefinitions: false,
          infoMessage:
            "Open this hub from an Azure DevOps project to list pipelines and active session metadata.",
        });
        await SDK.notifyLoadSucceeded();
        return;
      }

      await this.loadDefinitions(projectName);
      this.refreshTimer = setInterval(() => {
        void this.refreshRuns(false);
      }, 15000);

      await SDK.notifyLoadSucceeded();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      this.setState({
        isLoadingDefinitions: false,
        errorMessage: message,
      });
      await SDK.notifyLoadFailed(message);
    }
  }

  public componentWillUnmount() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  private async loadDefinitions(projectName: string) {
    this.setState({
      isLoadingDefinitions: true,
      errorMessage: null,
      infoMessage: null,
    });

    try {
      const definitions = await this.buildClient.getDefinitions(
        projectName,
        undefined,
        undefined,
        undefined,
        DefinitionQueryOrder.DefinitionNameAscending,
        200,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        true,
      );

      const definitionOptions = definitions.map(this.mapDefinition);
      const selectedDefinitionId = definitionOptions.length > 0
        ? definitionOptions[0].id
        : null;

      this.setState({
        definitions: definitionOptions,
        selectedDefinitionId,
        isLoadingDefinitions: false,
      });

      if (selectedDefinitionId !== null) {
        await this.loadRuns(projectName, selectedDefinitionId, true);
        return;
      }

      this.setState({
        infoMessage:
          "No build pipelines were found in this project yet.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      this.setState({
        isLoadingDefinitions: false,
        errorMessage: message,
      });
    }
  }

  private mapDefinition = (
    definition: BuildDefinitionReference,
  ): IPipelineDefinitionOption => ({
    id: definition.id,
    name: definition.name,
    latestBuildNumber: definition.latestBuild
      ? definition.latestBuild.buildNumber
      : null,
  });

  private async refreshRuns(showLoader: boolean) {
    const { projectName, selectedDefinitionId } = this.state;
    if (!projectName || selectedDefinitionId === null) {
      return;
    }

    await this.loadRuns(projectName, selectedDefinitionId, showLoader);
  }

  private async loadRuns(
    projectName: string,
    definitionId: number,
    showLoader: boolean,
  ) {
    this.setState((prevState) => ({
      isLoadingRuns: showLoader,
      errorMessage: null,
      copyFeedback: showLoader ? null : prevState.copyFeedback,
    }));

    try {
      const builds = await this.buildClient.getBuilds(
        projectName,
        [definitionId],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        RUNNING_BUILD_STATUSES,
        undefined,
        undefined,
        [
          "copilot.sessionId",
          "copilot.relayUrl",
          "copilot.viewerUrl",
          "copilotSessionId",
          "copilotRelayUrl",
          "copilotViewerUrl",
        ],
        50,
      );

      const runs = builds
        .slice()
        .sort((left, right) => {
          const leftQueueTime = this.getTimestamp(left.queueTime);
          const rightQueueTime = this.getTimestamp(right.queueTime);
          return rightQueueTime - leftQueueTime;
        })
        .map(this.mapBuild);

      this.setState({
        runs,
        isLoadingRuns: false,
        infoMessage: runs.length === 0
          ? "No running or queued runs were found for the selected pipeline."
          : "This hub currently looks for session metadata in build properties first and then in tags.",
        lastUpdated: new Date().toLocaleTimeString(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      this.setState({
        isLoadingRuns: false,
        errorMessage: message,
      });
    }
  }

  private mapBuild = (build: Build): IRunViewModel => {
    const metadata = this.extractSessionMetadata(build);
    const statusInfo = this.getStatusInfo(build.status);

    return {
      id: build.id,
      buildNumber: build.buildNumber,
      definitionId: build.definition.id,
      definitionName: build.definition.name,
      requestedBy: build.requestedFor
        ? build.requestedFor.displayName
        : "Unknown",
      queueTime: build.queueTime
        ? new Date(build.queueTime).toLocaleString()
        : null,
      sourceBranch: build.sourceBranch || null,
      statusLabel: statusInfo.label,
      statusClassName: statusInfo.className,
      resultLabel: build.result !== undefined && build.result !== null
        ? String(build.result)
        : null,
      webUrl: this.getBuildWebUrl(build),
      sessionId: metadata.sessionId,
      relayUrl: metadata.relayUrl,
      viewerUrl: metadata.viewerUrl,
      metadataSource: metadata.metadataSource,
    };
  };

  private getStatusInfo(status: BuildStatus): {
    label: string;
    className: string;
  } {
    switch (status) {
      case BuildStatus.InProgress:
        return { label: "Running", className: "running" };
      case BuildStatus.NotStarted:
      case BuildStatus.Postponed:
        return { label: "Queued", className: "queued" };
      case BuildStatus.Cancelling:
        return { label: "Canceling", className: "canceling" };
      default:
        return { label: "Unknown", className: "pending" };
    }
  }

  private getBuildWebUrl(build: Build): string | null {
    const webLink = (build._links as {
      web?: { href?: string };
    } | undefined);
    return webLink && webLink.web && webLink.web.href
      ? webLink.web.href
      : null;
  }

  private extractSessionMetadata(build: Build): ISessionMetadata {
    const properties = build.properties;
    const propertySessionId = this.findFirstPropertyValue(
      properties,
      SESSION_PROPERTY_KEYS,
    );
    const propertyRelayUrl = this.findFirstPropertyValue(
      properties,
      RELAY_PROPERTY_KEYS,
    );
    const propertyViewerUrl = this.findFirstPropertyValue(
      properties,
      VIEWER_PROPERTY_KEYS,
    );

    if (propertySessionId || propertyRelayUrl || propertyViewerUrl) {
      return {
        sessionId: propertySessionId,
        relayUrl: propertyRelayUrl,
        viewerUrl: propertyViewerUrl,
        metadataSource: "build properties",
      };
    }

    const tagSessionId = this.findTagValue(build.tags, "copilot-session:");
    const tagRelayUrl = this.findTagValue(build.tags, "copilot-relay:");
    const tagViewerUrl = this.findTagValue(build.tags, "copilot-viewer:");

    return {
      sessionId: tagSessionId,
      relayUrl: tagRelayUrl,
      viewerUrl: tagViewerUrl,
      metadataSource: tagSessionId || tagRelayUrl || tagViewerUrl
        ? "build tags"
        : null,
    };
  }

  private findFirstPropertyValue(
    properties: any,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const propertyValue = this.normalizePropertyValue(properties, key);
      if (propertyValue) {
        return propertyValue;
      }
    }

    return null;
  }

  private normalizePropertyValue(properties: any, key: string): string | null {
    if (!properties || typeof properties !== "object" || !(key in properties)) {
      return null;
    }

    const rawValue = properties[key];
    if (typeof rawValue === "string" && rawValue.trim()) {
      return rawValue.trim();
    }

    if (rawValue && typeof rawValue === "object") {
      if (typeof rawValue.$value === "string" && rawValue.$value.trim()) {
        return rawValue.$value.trim();
      }

      if (typeof rawValue.value === "string" && rawValue.value.trim()) {
        return rawValue.value.trim();
      }
    }

    return null;
  }

  private findTagValue(tags: string[] | undefined, prefix: string): string | null {
    if (!tags || tags.length === 0) {
      return null;
    }

    const normalizedPrefix = prefix.toLowerCase();
    const tag = tags.find((candidate) =>
      candidate.toLowerCase().indexOf(normalizedPrefix) === 0,
    );

    if (!tag) {
      return null;
    }

    const value = tag.slice(prefix.length).trim();
    return value || null;
  }

  private getTimestamp(value: Date | string | undefined): number {
    if (!value) {
      return 0;
    }

    return new Date(value).getTime();
  }

  private handleDefinitionChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const definitionId = Number(event.target.value);
    if (!definitionId || !this.state.projectName) {
      return;
    }

    this.setState({
      selectedDefinitionId: definitionId,
      copyFeedback: null,
    });

    await this.loadRuns(this.state.projectName, definitionId, true);
  };

  private handleRefreshClick = async () => {
    await this.refreshRuns(true);
  };

  private handleCopy = async (label: string, value: string) => {
    try {
      const clipboard = (navigator as {
        clipboard?: {
          writeText: (text: string) => Promise<void>;
        };
      }).clipboard;

      if (!clipboard) {
        throw new Error("Clipboard API unavailable");
      }

      await clipboard.writeText(value);
      this.setState({
        copyFeedback: label + " copied to clipboard.",
      });
    } catch (_error) {
      this.setState({
        copyFeedback: "Clipboard access is unavailable in this browser context.",
      });
    }
  };

  public render(): JSX.Element {
    const {
      projectName,
      isLoadingDefinitions,
      isLoadingRuns,
      errorMessage,
      infoMessage,
      definitions,
      selectedDefinitionId,
      runs,
      lastUpdated,
      copyFeedback,
    } = this.state;

    const runsWithSessions = runs.filter((run) => !!run.sessionId).length;

    return (
      <Page className="pipeline-sessions-page flex-grow">
        <Header
          title="Pipeline Sessions"
          titleSize={TitleSize.Large}
          titleIconProps={{ iconName: "Pipeline" }}
        />

        <div className="pipeline-sessions-content">
          <div className="pipeline-sessions-card">
            <div className="pipeline-sessions-toolbar">
              <div className="pipeline-sessions-toolbar-copy">
                <h2>Active pipeline runs and Copilot session metadata</h2>
                <p>
                  Select a pipeline from the current project to inspect its running
                  builds. This hub looks for session metadata in build properties
                  such as <code>copilot.sessionId</code> and falls back to tags like
                  <code>copilot-session:&lt;id&gt;</code>.
                </p>
              </div>

              <div className="pipeline-sessions-toolbar-actions">
                <div className="pipeline-sessions-field">
                  <label htmlFor="pipeline-definition-select">Pipeline</label>
                  <select
                    id="pipeline-definition-select"
                    value={selectedDefinitionId === null ? "" : String(selectedDefinitionId)}
                    onChange={this.handleDefinitionChange}
                    disabled={isLoadingDefinitions || definitions.length === 0}
                  >
                    {definitions.length === 0 && (
                      <option value="">No pipelines found</option>
                    )}
                    {definitions.map((definition) => (
                      <option key={definition.id} value={definition.id}>
                        {definition.name}
                        {definition.latestBuildNumber
                          ? " - latest " + definition.latestBuildNumber
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="pipeline-sessions-refresh-button"
                  onClick={this.handleRefreshClick}
                  disabled={isLoadingDefinitions || isLoadingRuns || !projectName}
                >
                  {isLoadingRuns ? "Refreshing..." : "Refresh runs"}
                </button>
              </div>
            </div>

            <div className="pipeline-sessions-summary">
              <div className="pipeline-sessions-summary-tile">
                <span className="tile-label">Project</span>
                <span className="tile-value">{projectName || "-"}</span>
              </div>
              <div className="pipeline-sessions-summary-tile">
                <span className="tile-label">Pipelines</span>
                <span className="tile-value">{definitions.length}</span>
              </div>
              <div className="pipeline-sessions-summary-tile">
                <span className="tile-label">Active runs</span>
                <span className="tile-value">{runs.length}</span>
              </div>
              <div className="pipeline-sessions-summary-tile">
                <span className="tile-label">Runs with session IDs</span>
                <span className="tile-value">{runsWithSessions}</span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="pipeline-sessions-message error">
              {errorMessage}
            </div>
          )}

          {infoMessage && !errorMessage && (
            <div className="pipeline-sessions-message info">
              {infoMessage}
            </div>
          )}

          {copyFeedback && (
            <div className="pipeline-sessions-message info">
              {copyFeedback}
            </div>
          )}

          <div className="pipeline-sessions-runs">
            {isLoadingDefinitions && (
              <div className="pipeline-sessions-card pipeline-sessions-empty">
                Loading pipelines...
              </div>
            )}

            {!isLoadingDefinitions && runs.length === 0 && (
              <div className="pipeline-sessions-card pipeline-sessions-empty">
                {selectedDefinitionId === null
                  ? "Select a project pipeline to inspect its running builds."
                  : "No running or queued builds are available for the selected pipeline right now."}
              </div>
            )}

            {runs.map((run) => (
              <div key={run.id} className="pipeline-sessions-card pipeline-sessions-run">
                <div className="pipeline-sessions-run-header">
                  <div className="pipeline-sessions-run-title">
                    <h3>{run.buildNumber}</h3>
                    <p>
                      {run.definitionName} - run #{run.id}
                    </p>
                  </div>

                  <div className="pipeline-sessions-badges">
                    <span className={`pipeline-sessions-badge ${run.statusClassName}`}>
                      {run.statusLabel}
                    </span>
                    <span className={`pipeline-sessions-badge ${run.sessionId ? "connected" : "pending"}`}>
                      {run.sessionId ? "Session found" : "Session pending"}
                    </span>
                  </div>
                </div>

                <div className="pipeline-sessions-run-grid">
                  <div className="pipeline-sessions-run-field">
                    <span className="field-label">Queued</span>
                    <span className="field-value">{run.queueTime || "-"}</span>
                  </div>
                  <div className="pipeline-sessions-run-field">
                    <span className="field-label">Requested by</span>
                    <span className="field-value">{run.requestedBy}</span>
                  </div>
                  <div className="pipeline-sessions-run-field">
                    <span className="field-label">Source branch</span>
                    <span className="field-value">{run.sourceBranch || "-"}</span>
                  </div>
                  <div className="pipeline-sessions-run-field">
                    <span className="field-label">Metadata source</span>
                    <span className="field-value">{run.metadataSource || "Not published yet"}</span>
                  </div>
                </div>

                <div className="pipeline-sessions-session-box">
                  <div className="pipeline-sessions-session-header">
                    <div>
                      <h4>Session metadata</h4>
                      <p>
                        Publish <code>copilot.sessionId</code> and optionally
                        <code> copilot.relayUrl</code> from the pipeline run to enable live AHP connection.
                      </p>
                    </div>

                    <div className="pipeline-sessions-badges">
                      {run.webUrl && (
                        <a
                          className="pipeline-sessions-link"
                          href={run.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open run
                        </a>
                      )}
                      {run.viewerUrl && (
                        <a
                          className="pipeline-sessions-link"
                          href={run.viewerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open viewer
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="pipeline-sessions-session-grid">
                    <div className="pipeline-sessions-run-field">
                      <span className="field-label">Session ID</span>
                      <span className="field-value">{run.sessionId || "Not found in this run yet"}</span>
                    </div>
                    <div className="pipeline-sessions-run-field">
                      <span className="field-label">Relay URL</span>
                      <span className="field-value">{run.relayUrl || "-"}</span>
                    </div>
                    <div className="pipeline-sessions-run-field">
                      <span className="field-label">Viewer URL</span>
                      <span className="field-value">{run.viewerUrl || "-"}</span>
                    </div>
                    <div className="pipeline-sessions-run-field">
                      <span className="field-label">Actions</span>
                      <span className="field-value">
                        <button
                          className="pipeline-sessions-copy-button"
                          disabled={!run.sessionId}
                          onClick={() =>
                            run.sessionId
                              ? this.handleCopy("Session ID", run.sessionId)
                              : undefined
                          }
                        >
                          Copy session ID
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pipeline-sessions-message info">
            Last refreshed: {lastUpdated || "Not refreshed yet"}.
          </div>
        </div>
      </Page>
    );
  }
}

ReactDOM.render(<PipelineSessionsHub />, document.getElementById("root"));
