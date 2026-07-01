import "./product-definition.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { copilotService, AdoContext } from "../services/copilot-service";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";
import { Button } from "azure-devops-ui/Button";

const PROXY_BASE_URL = "http://localhost:3001";

interface IChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface IQuickAction {
  id: string;
  icon: string;
  label: string;
  requiresWorkItem: boolean;
  buildPrompt: (workItemId: string, context: AdoContext | null) => string;
}

interface IProductDefinitionState {
  messages: IChatMessage[];
  currentInput: string;
  workItemId: string;
  isLoading: boolean;
  language: string;
  userName: string;
  adoContext: AdoContext | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  errorMessage: string | null;
}

interface ISSEEvent {
  type: "session" | "delta" | "complete" | "error";
  content?: string;
  error?: string;
  sessionId?: string;
  resetSession?: boolean;
}

const QUICK_ACTIONS: IQuickAction[] = [
  {
    id: "validate",
    icon: "🔍",
    label: "Validate Work Item",
    requiresWorkItem: true,
    buildPrompt: (workItemId: string) =>
      "Validate work item #" + workItemId + " and tell me what's missing",
  },
  {
    id: "acs",
    icon: "📝",
    label: "Generate ACs",
    requiresWorkItem: true,
    buildPrompt: (workItemId: string) =>
      "Generate acceptance criteria for work item #" + workItemId,
  },
  {
    id: "decompose",
    icon: "✂️",
    label: "Decompose",
    requiresWorkItem: true,
    buildPrompt: (workItemId: string) =>
      "Decompose work item #" + workItemId + " into smaller user stories",
  },
  {
    id: "new-story",
    icon: "➕",
    label: "New Story",
    requiresWorkItem: false,
    buildPrompt: (_workItemId: string, context: AdoContext | null) =>
      "Help me write a new user story for " +
      ((context && context.projectName) || "this project"),
  },
];

class ProductDefinitionHub extends React.Component<{}, IProductDefinitionState> {
  private messagesEndRef = React.createRef<HTMLDivElement>();
  private textareaRef = React.createRef<HTMLTextAreaElement>();
  private sessionId: string | null = null;
  private adoToken: string | null = null;
  private adoContext: AdoContext | null = null;

  constructor(props: {}) {
    super(props);
    this.state = {
      messages: [],
      currentInput: "",
      workItemId: "",
      isLoading: false,
      language: "en",
      userName: "",
      adoContext: null,
      isConnected: false,
      isAuthenticated: copilotService.isAuthenticated(),
      errorMessage: null,
    };
  }

  public async componentDidMount() {
    await SDK.init();
    await SDK.ready();

    const user = SDK.getUser();
    const host = SDK.getHost();
    const webContext = SDK.getWebContext();

    this.adoContext = {
      orgName: host.name,
      projectName: webContext.project ? webContext.project.name : null,
      projectId: webContext.project ? webContext.project.id : null,
      teamName: webContext.team ? webContext.team.name : null,
      teamId: webContext.team ? webContext.team.id : null,
    };
    copilotService.setAdoContext(this.adoContext);

    try {
      this.adoToken = await SDK.getAccessToken();
      copilotService.setAdoToken(this.adoToken);
    } catch (error) {
      console.warn("[ProductDefinitionHub] Failed to get ADO token:", error);
    }

    let isConnected = false;
    let errorMessage: string | null = null;

    try {
      await copilotService.initialize();
      isConnected = true;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Could not connect to the proxy server.";
    }

    let isAuthenticated = copilotService.isAuthenticated();
    if (isAuthenticated) {
      const verification = await copilotService.verifyToken();
      isAuthenticated = verification.valid;
    }

    this.setState({
      userName: user.displayName,
      adoContext: this.adoContext,
      isConnected: isConnected,
      isAuthenticated: isAuthenticated,
      errorMessage: errorMessage,
      messages: [this.createAssistantMessage(this.getWelcomeMessage(user.displayName))],
    });
  }

  public componentDidUpdate(prevProps: {}, prevState: IProductDefinitionState) {
    if (
      prevState.messages !== this.state.messages ||
      prevState.isLoading !== this.state.isLoading
    ) {
      this.scrollToBottom();
    }
  }

  private getWelcomeMessage(userName: string): string {
    const projectName =
      this.adoContext && this.adoContext.projectName
        ? " for **" + this.adoContext.projectName + "**"
        : "";

    return (
      "Hello " +
      userName +
      "! 👋 I can help you define product work" +
      projectName +
      ". Use the quick actions above or ask me to review a story, draft acceptance criteria, or decompose a feature."
    );
  }

  private createAssistantMessage(content: string): IChatMessage {
    return {
      id: "assistant-" + Date.now(),
      role: "assistant",
      content: content,
      timestamp: new Date(),
    };
  }

  private createUserMessage(content: string): IChatMessage {
    return {
      id: "user-" + Date.now(),
      role: "user",
      content: content,
      timestamp: new Date(),
    };
  }

  private scrollToBottom() {
    if (this.messagesEndRef.current) {
      this.messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }

  private appendAssistantNotice = (content: string) => {
    this.setState(function (prevState) {
      return {
        messages: prevState.messages.concat([{
          id: "assistant-" + Date.now(),
          role: "assistant",
          content: content,
          timestamp: new Date(),
        }]),
      };
    });
  };

  private handleLanguageChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const language = event.target.value;
    copilotService.setLanguage(language);
    this.sessionId = null;
    this.setState({ language: language });
  };

  private handleInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    this.setState({ currentInput: event.target.value }, this.adjustTextareaHeight);
  };

  private handleWorkItemChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    this.setState({ workItemId: event.target.value.replace(/[^\d]/g, "") });
  };

  private adjustTextareaHeight = () => {
    const textarea = this.textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
    }
  };

  private handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSendMessage();
    }
  };

  private handleQuickAction = (action: IQuickAction) => {
    if (action.requiresWorkItem && !this.state.workItemId.trim()) {
      this.appendAssistantNotice("Please enter a work item ID before using that action.");
      return;
    }

    const prompt = action.buildPrompt(this.state.workItemId.trim(), this.state.adoContext);
    this.setState({ currentInput: prompt }, () => {
      this.handleSendMessage(prompt);
    });
  };

  private handleSendMessage = async (overridePrompt?: string) => {
    const prompt = (overridePrompt || this.state.currentInput).trim();
    if (!prompt || this.state.isLoading) {
      return;
    }

    if (!this.state.isAuthenticated) {
      this.appendAssistantNotice(
        "Please sign in from the GitHub Copilot Chat hub first so this hub can reuse your session."
      );
      return;
    }

    if (!this.state.isConnected) {
      this.appendAssistantNotice(
        "The proxy server is not available. Start it with `cd server && npm run dev`."
      );
      return;
    }

    const assistantMessageId = "assistant-stream-" + Date.now();
    const userMessage = this.createUserMessage(prompt);

    this.setState(function (prevState) {
      return {
        messages: prevState.messages.concat([
          userMessage,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
          },
        ]),
        currentInput: "",
        isLoading: true,
        errorMessage: null,
      };
    }, this.adjustTextareaHeight);

    try {
      await this.sendProductDefinitionMessage(prompt, assistantMessageId);
      this.setState({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.updateMessageContent(assistantMessageId, "❌ Error: " + message);
      this.setState({
        isLoading: false,
        isAuthenticated: message.indexOf("re-authenticate") === -1 && message.indexOf("sign in") === -1
          ? this.state.isAuthenticated
          : false,
      });
    }
  };

  private async sendProductDefinitionMessage(
    prompt: string,
    assistantMessageId: string,
  ): Promise<void> {
    const githubToken = copilotService.getGitHubToken();
    if (!githubToken) {
      throw new Error("No GitHub session found. Please sign in from the main Copilot hub.");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-GitHub-Token": githubToken,
    };

    if (this.adoToken) {
      headers["X-ADO-Token"] = this.adoToken;
    }

    const response = await fetch(PROXY_BASE_URL + "/chat", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        message: prompt,
        sessionId: this.sessionId,
        language: this.state.language,
        adoContext: this.adoContext,
        agent: "product-definition",
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        copilotService.clearToken();
        throw new Error("GitHub token expired. Please re-authenticate.");
      }
      throw new Error("Server returned " + response.status);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const result = await reader.read();

      if (result.done) {
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.indexOf("data: ") !== 0) {
          continue;
        }

        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          return;
        }

        try {
          const event = JSON.parse(data) as ISSEEvent;
          if (event.type === "session" && event.sessionId) {
            this.sessionId = event.sessionId;
          }

          if (event.type === "delta" && event.content) {
            fullContent += event.content;
            this.updateMessageContent(assistantMessageId, fullContent);
          }

          if (event.type === "complete") {
            this.updateMessageContent(
              assistantMessageId,
              event.content ? event.content : fullContent,
            );
            return;
          }

          if (event.type === "error") {
            if (event.resetSession) {
              this.sessionId = null;
            }
            throw new Error(event.error || "Unknown error");
          }
        } catch (error) {
          console.warn("[ProductDefinitionHub] Failed to parse SSE event:", error);
        }
      }
    }

    if (fullContent) {
      this.updateMessageContent(assistantMessageId, fullContent);
    }
  }

  private updateMessageContent(messageId: string, content: string) {
    this.setState(function (prevState) {
      return {
        messages: prevState.messages.map(function (message) {
          if (message.id === messageId) {
            return {
              id: message.id,
              role: message.role,
              content: content,
              timestamp: message.timestamp,
            };
          }
          return message;
        }),
      };
    });
  }

  private renderAvatar(role: "user" | "assistant"): JSX.Element {
    if (role === "assistant") {
      return <div className="pd-message-avatar">🤖</div>;
    }

    const initials = this.state.userName
      .split(" ")
      .map(function (part) {
        return part.charAt(0);
      })
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return <div className="pd-message-avatar">{initials || "U"}</div>;
  }

  public render(): JSX.Element {
    const adoContext = this.state.adoContext;
    const projectName = adoContext && adoContext.projectName ? adoContext.projectName : "No project";
    const teamName = adoContext && adoContext.teamName ? adoContext.teamName : "No team";

    return (
      <Page className="product-definition-page flex-grow">
        <Header
          title="Product Definition"
          titleSize={TitleSize.Large}
          titleIconProps={{ iconName: "WorkItem" }}
        />

        <div className="pd-header">
          <div className="pd-header-copy">
            <h2>Shape better backlog items</h2>
            <p>Validate stories, generate acceptance criteria, and break work down into deliverable slices.</p>
          </div>

          <label className="pd-language-selector">
            Response language
            <select value={this.state.language} onChange={this.handleLanguageChange}>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="pt">Português</option>
            </select>
          </label>
        </div>

        <div className="pd-quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className="pd-quick-action-btn"
              onClick={() => this.handleQuickAction(action)}
              disabled={this.state.isLoading}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        <div className="pd-work-item-context">
          <span className="pd-context-chip">Project: {projectName}</span>
          <span className="pd-context-chip">Team: {teamName}</span>
          <span className="pd-context-chip">Org: {adoContext ? adoContext.orgName : "Unknown"}</span>
          <input
            type="text"
            value={this.state.workItemId}
            onChange={this.handleWorkItemChange}
            className="pd-work-item-input"
            placeholder="Work item ID"
            inputMode="numeric"
          />
        </div>

        <div className="pd-panels">
          <div className="pd-panel">
            <h3>Validate scope</h3>
            <p>Spot missing persona, value, dependencies, or measurable outcomes before work starts.</p>
          </div>
          <div className="pd-panel">
            <h3>Draft acceptance criteria</h3>
            <p>Turn rough ideas into testable, implementation-ready criteria that delivery teams can estimate.</p>
          </div>
          <div className="pd-panel">
            <h3>Plan decomposition</h3>
            <p>Break large initiatives into smaller, releasable stories while keeping business intent intact.</p>
          </div>
        </div>

        <div className="pd-chat-shell">
          <div className="pd-chat-container">
            {this.state.errorMessage && (
              <div className="pd-status-banner error">{this.state.errorMessage}</div>
            )}
            {!this.state.isAuthenticated && (
              <div className="pd-status-banner">
                Sign in from the main GitHub Copilot Chat hub first. This hub reuses that authenticated session.
              </div>
            )}

            <div className="pd-chat-messages">
              {this.state.messages.map((message) => {
                if (message.id.indexOf("assistant-stream-") === 0 && !message.content) {
                  return null;
                }

                return (
                  <div key={message.id} className={"pd-message " + message.role}>
                    {this.renderAvatar(message.role)}
                    <div className="pd-message-bubble">
                      <div className="pd-message-text">
                        {message.role === "assistant" ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          message.content
                        )}
                      </div>
                      <div className="pd-message-time">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}

              {this.state.isLoading && (
                <div className="pd-message assistant">
                  {this.renderAvatar("assistant")}
                  <div className="pd-message-bubble">
                    <div className="pd-typing">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={this.messagesEndRef}></div>
            </div>

            <div className="pd-input-area">
              <textarea
                ref={this.textareaRef}
                className="pd-input-box"
                value={this.state.currentInput}
                onChange={this.handleInputChange}
                onKeyDown={this.handleKeyDown}
                placeholder="Ask for backlog validation, acceptance criteria, story decomposition, or new story drafting..."
                rows={2}
              />
              <div className="pd-input-actions">
                <span className="pd-input-hint">Press Enter to send · Shift+Enter for a new line</span>
                <Button
                  text="Send"
                  primary={true}
                  iconProps={{ iconName: "Send" }}
                  onClick={() => this.handleSendMessage()}
                  disabled={this.state.isLoading || !this.state.currentInput.trim()}
                />
              </div>
            </div>
          </div>
        </div>
      </Page>
    );
  }
}

ReactDOM.render(<ProductDefinitionHub />, document.getElementById("root"));
