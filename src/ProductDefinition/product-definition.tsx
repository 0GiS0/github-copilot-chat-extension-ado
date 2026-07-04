import "./product-definition.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { copilotService, AdoContext, CopilotModel } from "../services/copilot-service";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";
import { Button } from "azure-devops-ui/Button";
import copilotIcon from "../../static/copilot-icon.png";

const PROXY_BASE_URL = "http://localhost:3001";

interface ILanguageOption {
  code: string;
  name: string;
  flag: string;
}

type SupportedLanguage = "en" | "es" | "fr" | "de" | "pt";

type KnowledgeBaseOption = "sharepoint" | "confluence" | "azure-devops-wiki";

const LANGUAGE_OPTIONS: ILanguageOption[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
];

const KNOWLEDGE_BASE_OPTIONS: Array<{
  value: KnowledgeBaseOption;
  label: string;
  logoText: string;
  className: string;
}> = [
  { value: "azure-devops-wiki", label: "Azure DevOps Wiki", logoText: "W", className: "azure-devops-wiki" },
  { value: "sharepoint", label: "SharePoint", logoText: "SP", className: "sharepoint" },
  { value: "confluence", label: "Confluence", logoText: "C", className: "confluence" },
];

interface IChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: IImageAttachment[];
}

interface IImageAttachment {
  name: string;
  mimeType: string;
  dataUrl: string;
}

interface IQuickActionDefinition {
  id: string;
  icon: string;
  requiresWorkItem: boolean;
}

interface IQuickAction extends IQuickActionDefinition {
  id: string;
  icon: string;
  label: string;
  requiresWorkItem: boolean;
  buildPrompt: (workItemId: string, context: AdoContext | null) => string;
}

interface IQuickActionCopy {
  quickActions: {
    validate: string;
    acceptanceCriteria: string;
    decompose: string;
    newStory: string;
  };
  prompts: {
    validateWorkItem: (workItemId: string) => string;
    generateAcceptanceCriteria: (workItemId: string) => string;
    decomposeWorkItem: (workItemId: string) => string;
    newStory: (projectName?: string | null) => string;
  };
  missingWorkItem: string;
}

interface IProductDefinitionState {
  messages: IChatMessage[];
  currentInput: string;
  workItemId: string;
  workItemTitle: string | null;
  workItemType: string | null;
  workItemState: string | null;
  workItemUrl: string | null;
  workItemLookupLoading: boolean;
  workItemLookupError: string | null;
  pendingAttachments: IImageAttachment[];
  fullscreenAttachment: IImageAttachment | null;
  isLoading: boolean;
  language: string;
  models: CopilotModel[];
  selectedModel: string;
  selectedKnowledgeBase: KnowledgeBaseOption;
  modelsLoading: boolean;
  isImmersiveMode: boolean;
  userName: string;
  userImageUrl: string;
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

const QUICK_ACTION_COPY: Record<SupportedLanguage, IQuickActionCopy> = {
  en: {
    quickActions: {
      validate: "Validate Work Item",
      acceptanceCriteria: "Generate ACs",
      decompose: "Decompose",
      newStory: "New Story",
    },
    prompts: {
      validateWorkItem: (workItemId: string) => "Validate work item #" + workItemId + " and tell me what's missing",
      generateAcceptanceCriteria: (workItemId: string) => "Generate acceptance criteria for work item #" + workItemId,
      decomposeWorkItem: (workItemId: string) => "Decompose work item #" + workItemId + " into smaller user stories",
      newStory: (projectName?: string | null) => "Help me write a new user story for " + (projectName || "this project"),
    },
    missingWorkItem: "Please enter a work item ID before using that action.",
  },
  es: {
    quickActions: {
      validate: "Validar work item",
      acceptanceCriteria: "Generar CA",
      decompose: "Descomponer",
      newStory: "Nueva historia",
    },
    prompts: {
      validateWorkItem: (workItemId: string) => "Valida el work item #" + workItemId + " y dime que le falta",
      generateAcceptanceCriteria: (workItemId: string) => "Genera criterios de aceptacion para el work item #" + workItemId,
      decomposeWorkItem: (workItemId: string) => "Descompone el work item #" + workItemId + " en historias de usuario mas pequenas",
      newStory: (projectName?: string | null) => "Ayudame a redactar una nueva historia de usuario para " + (projectName || "este proyecto"),
    },
    missingWorkItem: "Introduce un ID de work item antes de usar esa accion.",
  },
  fr: {
    quickActions: {
      validate: "Valider le work item",
      acceptanceCriteria: "Generer AC",
      decompose: "Decouper",
      newStory: "Nouvelle story",
    },
    prompts: {
      validateWorkItem: (workItemId: string) => "Valide le work item #" + workItemId + " et dis-moi ce qui manque",
      generateAcceptanceCriteria: (workItemId: string) => "Genere des criteres d'acceptation pour le work item #" + workItemId,
      decomposeWorkItem: (workItemId: string) => "Decoupe le work item #" + workItemId + " en plus petites user stories",
      newStory: (projectName?: string | null) => "Aide-moi a rediger une nouvelle user story pour " + (projectName || "ce projet"),
    },
    missingWorkItem: "Saisissez un ID de work item avant d'utiliser cette action.",
  },
  de: {
    quickActions: {
      validate: "Work Item validieren",
      acceptanceCriteria: "AK generieren",
      decompose: "Zerlegen",
      newStory: "Neue Story",
    },
    prompts: {
      validateWorkItem: (workItemId: string) => "Validiere Work Item #" + workItemId + " und sage mir, was fehlt",
      generateAcceptanceCriteria: (workItemId: string) => "Erstelle Akzeptanzkriterien fur Work Item #" + workItemId,
      decomposeWorkItem: (workItemId: string) => "Zerlege Work Item #" + workItemId + " in kleinere User Stories",
      newStory: (projectName?: string | null) => "Hilf mir, eine neue User Story fur " + (projectName || "dieses Projekt") + " zu formulieren",
    },
    missingWorkItem: "Gib eine Work-Item-ID ein, bevor du diese Aktion verwendest.",
  },
  pt: {
    quickActions: {
      validate: "Validar work item",
      acceptanceCriteria: "Gerar CA",
      decompose: "Decompor",
      newStory: "Nova historia",
    },
    prompts: {
      validateWorkItem: (workItemId: string) => "Valide o work item #" + workItemId + " e diga o que esta faltando",
      generateAcceptanceCriteria: (workItemId: string) => "Gere criterios de aceitacao para o work item #" + workItemId,
      decomposeWorkItem: (workItemId: string) => "Decomponha o work item #" + workItemId + " em historias de usuario menores",
      newStory: (projectName?: string | null) => "Ajude-me a escrever uma nova historia de usuario para " + (projectName || "este projeto"),
    },
    missingWorkItem: "Informe um ID de work item antes de usar essa acao.",
  },
};

const QUICK_ACTIONS: IQuickActionDefinition[] = [
  {
    id: "validate",
    icon: "🔍",
    requiresWorkItem: true,
  },
  {
    id: "acs",
    icon: "📝",
    requiresWorkItem: true,
  },
  {
    id: "decompose",
    icon: "✂️",
    requiresWorkItem: true,
  },
  {
    id: "new-story",
    icon: "➕",
    requiresWorkItem: false,
  },
];

class ProductDefinitionHub extends React.Component<{}, IProductDefinitionState> {
  private messagesEndRef = React.createRef<HTMLDivElement>();
  private textareaRef = React.createRef<HTMLTextAreaElement>();
  private fileInputRef = React.createRef<HTMLInputElement>();
  private sessionId: string | null = null;
  private adoToken: string | null = null;
  private adoContext: AdoContext | null = null;
  private workItemLookupTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: {}) {
    super(props);
    this.state = {
      messages: [],
      currentInput: "",
      workItemId: "",
      workItemTitle: null,
      workItemType: null,
      workItemState: null,
      workItemUrl: null,
      workItemLookupLoading: false,
      workItemLookupError: null,
      pendingAttachments: [],
      fullscreenAttachment: null,
      isLoading: false,
      language: "en",
      models: [],
      selectedModel: "gpt-5.2",
      selectedKnowledgeBase: "azure-devops-wiki",
      modelsLoading: false,
      isImmersiveMode: false,
      userName: "",
      userImageUrl: "",
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
    let userImageUrl = user.imageUrl || "";
    if (userImageUrl) {
      const url = new URL(userImageUrl);
      url.searchParams.set("size", "large");
      userImageUrl = url.toString();
    }

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

    if (isAuthenticated) {
      await this.loadModels();
    }

    this.setState({
      userName: user.displayName,
      userImageUrl: userImageUrl,
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

  public componentWillUnmount() {
    if (this.workItemLookupTimeout) {
      clearTimeout(this.workItemLookupTimeout);
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

  private getQuickActionCopy(): IQuickActionCopy {
    const language = this.state.language as SupportedLanguage;
    return QUICK_ACTION_COPY[language] || QUICK_ACTION_COPY.en;
  }

  private getQuickActions(): IQuickAction[] {
    const copy = this.getQuickActionCopy();

    return QUICK_ACTIONS.map((action) => {
      if (action.id === "validate") {
        return {
          ...action,
          label: copy.quickActions.validate,
          buildPrompt: (workItemId: string) => copy.prompts.validateWorkItem(workItemId),
        };
      }

      if (action.id === "acs") {
        return {
          ...action,
          label: copy.quickActions.acceptanceCriteria,
          buildPrompt: (workItemId: string) => copy.prompts.generateAcceptanceCriteria(workItemId),
        };
      }

      if (action.id === "decompose") {
        return {
          ...action,
          label: copy.quickActions.decompose,
          buildPrompt: (workItemId: string) => copy.prompts.decomposeWorkItem(workItemId),
        };
      }

      return {
        ...action,
        label: copy.quickActions.newStory,
        buildPrompt: (_workItemId: string, context: AdoContext | null) =>
          copy.prompts.newStory(context && context.projectName ? context.projectName : null),
      };
    });
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

  private openImagePicker = () => {
    this.fileInputRef.current?.click();
  };

  private handleImageSelection = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    if (files.length === 0) {
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const attachments = await Promise.all(imageFiles.map((file) => this.fileToAttachment(file)));
    this.setState((prevState) => ({
      pendingAttachments: prevState.pendingAttachments.concat(attachments),
    }));
    input.value = "";
  };

  private fileToAttachment(file: File): Promise<IImageAttachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Could not read image."));
          return;
        }

        resolve({
          name: file.name,
          mimeType: file.type,
          dataUrl: reader.result,
        });
      };
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
  }

  private removePendingAttachment = (index: number) => {
    this.setState((prevState) => ({
      pendingAttachments: prevState.pendingAttachments.filter((_attachment, attachmentIndex) => attachmentIndex !== index),
    }));
  };

  private openFullscreenAttachment = (attachment: IImageAttachment) => {
    this.setState({ fullscreenAttachment: attachment });
  };

  private closeFullscreenAttachment = () => {
    this.setState({ fullscreenAttachment: null });
  };

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

  private handleModelChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const modelId = event.target.value;
    this.sessionId = null;
    copilotService.resetSession();
    this.setState({ selectedModel: modelId });
  };

  private async loadModels() {
    this.setState({ modelsLoading: true });
    try {
      const models = await copilotService.fetchModels();
      const defaultModel = models.find((model) => model.id === "gpt-5.2");
      this.setState({
        models,
        selectedModel: defaultModel ? defaultModel.id : models.length > 0 ? models[0].id : "gpt-5.2",
        modelsLoading: false,
      });
    } catch (error) {
      console.error("[ProductDefinitionHub] Failed to load models:", error);
      this.setState({ modelsLoading: false });
    }
  }

  private toggleImmersiveMode = () => {
    this.setState((prevState) => ({
      isImmersiveMode: !prevState.isImmersiveMode,
    }));
  };

  private handleInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    this.setState({ currentInput: event.target.value }, this.adjustTextareaHeight);
  };

  private handleWorkItemChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const workItemId = event.target.value.replace(/[^\d]/g, "");

    if (this.workItemLookupTimeout) {
      clearTimeout(this.workItemLookupTimeout);
      this.workItemLookupTimeout = null;
    }

    if (!workItemId) {
      this.setState({
        workItemId,
        workItemTitle: null,
        workItemType: null,
        workItemState: null,
        workItemUrl: null,
        workItemLookupLoading: false,
        workItemLookupError: null,
      });
      return;
    }

    this.setState({
      workItemId,
      workItemLookupLoading: true,
      workItemLookupError: null,
    });

    this.workItemLookupTimeout = setTimeout(() => {
      this.lookupWorkItem(workItemId);
    }, 350);
  };

  private async lookupWorkItem(workItemId: string) {
    if (!this.adoToken || !this.adoContext?.orgName) {
      this.setState({
        workItemLookupLoading: false,
        workItemLookupError: "Azure DevOps session is not available.",
      });
      return;
    }

    const orgName = encodeURIComponent(this.adoContext.orgName);
    const apiUrl =
      "https://dev.azure.com/" +
      orgName +
      "/_apis/wit/workitems/" +
      encodeURIComponent(workItemId) +
      "?fields=System.Id,System.Title,System.WorkItemType,System.State&api-version=7.1";

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: "Bearer " + this.adoToken,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (this.state.workItemId !== workItemId) {
          return;
        }

        this.setState({
          workItemTitle: null,
          workItemType: null,
          workItemState: null,
          workItemUrl: null,
          workItemLookupLoading: false,
          workItemLookupError: response.status === 404 ? "Work item not found." : "Could not load work item.",
        });
        return;
      }

      const workItem = await response.json();
      if (this.state.workItemId !== workItemId) {
        return;
      }

      const fields = workItem.fields || {};
      const workItemWebUrl =
        this.adoContext.projectName && this.adoContext.orgName
          ? "https://dev.azure.com/" +
            encodeURIComponent(this.adoContext.orgName) +
            "/" +
            encodeURIComponent(this.adoContext.projectName) +
            "/_workitems/edit/" +
            encodeURIComponent(workItemId)
          : null;

      this.setState({
        workItemTitle: fields["System.Title"] || null,
        workItemType: fields["System.WorkItemType"] || null,
        workItemState: fields["System.State"] || null,
        workItemUrl: workItemWebUrl,
        workItemLookupLoading: false,
        workItemLookupError: null,
      });
    } catch (_error) {
      if (this.state.workItemId !== workItemId) {
        return;
      }

      this.setState({
        workItemTitle: null,
        workItemType: null,
        workItemState: null,
        workItemUrl: null,
        workItemLookupLoading: false,
        workItemLookupError: "Could not load work item.",
      });
    }
  }

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
    const copy = this.getQuickActionCopy();
    if (action.requiresWorkItem && !this.state.workItemId.trim()) {
      this.appendAssistantNotice(copy.missingWorkItem);
      return;
    }

    const prompt = action.buildPrompt(this.state.workItemId.trim(), this.state.adoContext);
    this.setState({ currentInput: prompt }, () => {
      this.handleSendMessage(prompt);
    });
  };

  private handleSendMessage = async (overridePrompt?: string) => {
    const rawPrompt = (overridePrompt || this.state.currentInput).trim();
    const prompt = rawPrompt || (
      this.state.pendingAttachments.length > 0
        ? "Analyze the attached sketch and propose one or more user stories with acceptance criteria."
        : ""
    );
    if ((!prompt && this.state.pendingAttachments.length === 0) || this.state.isLoading) {
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
    const userMessage = {
      ...this.createUserMessage(prompt),
      attachments: this.state.pendingAttachments,
    };
    const attachmentsToSend = this.state.pendingAttachments;

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
        pendingAttachments: [],
        isLoading: true,
        errorMessage: null,
      };
    }, this.adjustTextareaHeight);

    try {
      await this.sendProductDefinitionMessage(prompt, assistantMessageId, attachmentsToSend);
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
    attachments: IImageAttachment[],
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
        model: this.state.selectedModel,
        knowledgeBase: this.state.selectedKnowledgeBase,
        adoContext: this.adoContext,
        agent: "product-definition",
        attachments,
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
      return (
        <div className="pd-message-avatar assistant">
          <img src={copilotIcon} alt="GitHub Copilot" />
        </div>
      );
    }

    if (this.state.userImageUrl) {
      return (
        <div className="pd-message-avatar user">
          <img src={this.state.userImageUrl} alt={this.state.userName} />
        </div>
      );
    }

    const initials = this.state.userName
      .split(" ")
      .map(function (part) {
        return part.charAt(0);
      })
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return <div className="pd-message-avatar user">{initials || "U"}</div>;
  }

  private renderMessageAttachments(attachments?: IImageAttachment[]) {
    if (!attachments || attachments.length === 0) {
      return null;
    }

    return (
      <div className="pd-message-attachments">
        {attachments.map((attachment) => (
          <button
            key={attachment.name + attachment.dataUrl.slice(0, 32)}
            type="button"
            className="pd-message-attachment"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              this.openFullscreenAttachment(attachment);
            }}
          >
            <img src={attachment.dataUrl} alt={attachment.name} />
            <span>{attachment.name}</span>
          </button>
        ))}
      </div>
    );
  }

  public render(): JSX.Element {
    const quickActions = this.getQuickActions();
    const adoContext = this.state.adoContext;
    const projectName = adoContext && adoContext.projectName ? adoContext.projectName : "No project";
    const teamName = adoContext && adoContext.teamName ? adoContext.teamName : "No team";

    return (
      <Page className={"product-definition-page flex-grow" + (this.state.isImmersiveMode ? " immersive" : "")}>
        <Header
          title="Product Definition"
          titleSize={TitleSize.Large}
          titleIconProps={{ iconName: "WorkItem" }}
        />

        {!this.state.isImmersiveMode && (
          <>
            <div className="pd-header">
              <div className="pd-header-copy">
                <h2>Shape better backlog items</h2>
                <p>Validate stories, generate acceptance criteria, and break work down into deliverable slices.</p>
              </div>

              <div className="pd-header-controls">
                <label className="pd-language-selector">
                  Response language
                  <select value={this.state.language} onChange={this.handleLanguageChange}>
                    {LANGUAGE_OPTIONS.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.flag} {language.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={"pd-immersive-toggle" + (this.state.isImmersiveMode ? " active" : "")}
                  onClick={this.toggleImmersiveMode}
                >
                  {this.state.isImmersiveMode ? "Exit immersive" : "Immersive mode"}
                </button>
              </div>
            </div>

            <div className="pd-quick-actions">
              {quickActions.map((action) => (
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
              <span className="pd-work-item-context-label">🎯 Work item context</span>
              <div className="pd-context-chips">
                <span className="pd-context-chip">Project: {projectName}</span>
                <span className="pd-context-chip">Team: {teamName}</span>
                <span className="pd-context-chip">Org: {adoContext ? adoContext.orgName : "Unknown"}</span>
              </div>
              <input
                type="text"
                value={this.state.workItemId}
                onChange={this.handleWorkItemChange}
                className="pd-work-item-input"
                placeholder="Work item ID"
                inputMode="numeric"
              />
              {this.state.workItemLookupLoading && (
                <span className="pd-work-item-status">Searching…</span>
              )}
              {!this.state.workItemLookupLoading && this.state.workItemTitle && (
                <span className="pd-work-item-status success">
                  {this.state.workItemType ? this.state.workItemType + " · " : ""}
                  {this.state.workItemTitle}
                  {this.state.workItemState ? " · " + this.state.workItemState : ""}
                  {this.state.workItemUrl && (
                    <>
                      {" "}
                      <a href={this.state.workItemUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </>
                  )}
                </span>
              )}
              {!this.state.workItemLookupLoading && this.state.workItemLookupError && (
                <span className="pd-work-item-status error">{this.state.workItemLookupError}</span>
              )}
            </div>
          </>
        )}

        <div className="pd-chat-shell">
          <div className="pd-chat-container">
            {this.state.isImmersiveMode && (
              <div className="pd-immersive-bar">
                <div className="pd-immersive-context">
                  <span className="pd-work-item-context-label">🎯 Work item</span>
                  <input
                    type="text"
                    value={this.state.workItemId}
                    onChange={this.handleWorkItemChange}
                    className="pd-work-item-input immersive"
                    placeholder="Work item ID"
                    inputMode="numeric"
                  />
                  {this.state.workItemLookupLoading && (
                    <span className="pd-work-item-status">Searching…</span>
                  )}
                  {!this.state.workItemLookupLoading && this.state.workItemTitle && (
                    <span className="pd-work-item-status success">
                      {this.state.workItemType ? this.state.workItemType + " · " : ""}
                      {this.state.workItemTitle}
                    </span>
                  )}
                </div>
                <div className="pd-immersive-actions">
                  <label className="pd-language-selector compact">
                    <span>Language</span>
                    <select value={this.state.language} onChange={this.handleLanguageChange}>
                      {LANGUAGE_OPTIONS.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.flag} {language.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="pd-immersive-toggle active"
                    onClick={this.toggleImmersiveMode}
                  >
                    Exit immersive
                  </button>
                </div>
              </div>
            )}
            {this.state.errorMessage && (
              <div className="pd-status-banner error">{this.state.errorMessage}</div>
            )}
            {!this.state.isAuthenticated && (
              <div className="pd-status-banner">
                Sign in from the main GitHub Copilot Chat hub first. This hub reuses that authenticated session.
              </div>
            )}
            {this.state.fullscreenAttachment && (
              <div
                className="pd-attachment-lightbox"
                role="dialog"
                aria-modal="true"
                aria-label={this.state.fullscreenAttachment.name}
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    this.closeFullscreenAttachment();
                  }
                }}
              >
                <button
                  type="button"
                  className="pd-attachment-lightbox-close"
                  onClick={this.closeFullscreenAttachment}
                  aria-label="Close image preview"
                >
                  ×
                </button>
                <div
                  className="pd-attachment-lightbox-content"
                  onClick={(event) => event.stopPropagation()}
                >
                  <img
                    src={this.state.fullscreenAttachment.dataUrl}
                    alt={this.state.fullscreenAttachment.name}
                  />
                  <span>{this.state.fullscreenAttachment.name}</span>
                </div>
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
                      {this.renderMessageAttachments(message.attachments)}
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
              <input
                ref={this.fileInputRef}
                type="file"
                accept="image/*"
                multiple={true}
                className="pd-file-input"
                onChange={this.handleImageSelection}
              />
              {this.state.pendingAttachments.length > 0 && (
                <div className="pd-pending-attachments">
                  {this.state.pendingAttachments.map((attachment, index) => (
                    <div key={attachment.name + index} className="pd-pending-attachment">
                      <img src={attachment.dataUrl} alt={attachment.name} />
                      <div className="pd-pending-attachment-meta">
                        <span>{attachment.name}</span>
                        <button
                          type="button"
                          onClick={() => this.removePendingAttachment(index)}
                          disabled={this.state.isLoading}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                <div className="pd-input-meta">
                  <span className="pd-input-hint">Press Enter to send · Shift+Enter for a new line</span>
                  <button
                    type="button"
                    className="pd-attach-button"
                    onClick={this.openImagePicker}
                    disabled={this.state.isLoading}
                  >
                    🖼️ Attach sketch
                  </button>
                  <label className="pd-model-selector-inline">
                    <span>Model</span>
                    <select
                      value={this.state.selectedModel}
                      onChange={this.handleModelChange}
                      disabled={this.state.modelsLoading || this.state.isLoading || this.state.models.length === 0}
                    >
                      {this.state.modelsLoading && (
                        <option value={this.state.selectedModel}>Loading models...</option>
                      )}
                      {!this.state.modelsLoading && this.state.models.length === 0 && (
                        <option value={this.state.selectedModel}>{this.state.selectedModel}</option>
                      )}
                      {this.state.models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="pd-knowledge-base-group" aria-label="Knowledge base">
                    <div className="pd-knowledge-base-buttons">
                      {KNOWLEDGE_BASE_OPTIONS.map((knowledgeBase) => {
                        const isSelected = this.state.selectedKnowledgeBase === knowledgeBase.value;
                        return (
                          <button
                            key={knowledgeBase.value}
                            type="button"
                            className={
                              "pd-kb-button " +
                              knowledgeBase.className +
                              (isSelected ? " selected" : "")
                            }
                            disabled={!isSelected}
                            aria-pressed={isSelected}
                            title={isSelected ? knowledgeBase.label : knowledgeBase.label + " (coming soon)"}
                          >
                            <span className="pd-kb-logo" aria-hidden="true">
                              {knowledgeBase.logoText}
                            </span>
                            <span className="pd-kb-text">
                              <span>{knowledgeBase.label}</span>
                              {!isSelected && <small>Coming soon</small>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <Button
                  text="Send"
                  primary={true}
                  iconProps={{ iconName: "Send" }}
                  onClick={() => this.handleSendMessage()}
                  disabled={this.state.isLoading || (!this.state.currentInput.trim() && this.state.pendingAttachments.length === 0)}
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
