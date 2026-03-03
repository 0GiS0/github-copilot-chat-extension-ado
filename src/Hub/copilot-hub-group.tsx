import "./copilot-hub-group.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";

import { copilotService, CopilotModel } from "../services/copilot-service";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";
import { Button } from "azure-devops-ui/Button";

// Import Copilot & GitHub icons
import copilotIcon from "../../static/copilot-icon.png";

// ═══════════════════════════════════════════════════════════════════════════════
// 🌍 Language Configuration
// ═══════════════════════════════════════════════════════════════════════════════

interface ILanguage {
  code: string;
  name: string;
  flag: string;
  welcomeMessage: (userName: string) => string;
  placeholder: string;
  promptsTitle: string;
}

const LANGUAGES: ILanguage[] = [
  {
    code: "es",
    name: "Español",
    flag: "🇪🇸",
    welcomeMessage: (userName: string) =>
      `¡Hola ${userName} 🔥! 👋 Soy tu asistente de GitHub Copilot para Azure DevOps. ¿En qué puedo ayudarte hoy?`,
    placeholder:
      "Escribe tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)",
    promptsTitle: "💡 Prueba estos prompts",
  },
  {
    code: "en",
    name: "English",
    flag: "🇬🇧",
    welcomeMessage: (userName: string) =>
      `Hello ${userName} 🔥! 👋 I'm your GitHub Copilot assistant for Azure DevOps. How can I help you today?`,
    placeholder:
      "Type your message... (Enter to send, Shift+Enter for new line)",
    promptsTitle: "💡 Try these prompts",
  },
  {
    code: "fr",
    name: "Français",
    flag: "🇫🇷",
    welcomeMessage: (userName: string) =>
      `Bonjour ${userName} 🔥! 👋 Je suis votre assistant GitHub Copilot pour Azure DevOps. Comment puis-je vous aider ?`,
    placeholder:
      "Écrivez votre message... (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)",
    promptsTitle: "💡 Essayez ces prompts",
  },
  {
    code: "de",
    name: "Deutsch",
    flag: "🇩🇪",
    welcomeMessage: (userName: string) =>
      `Hallo ${userName} 🔥! 👋 Ich bin dein GitHub Copilot Assistent für Azure DevOps. Wie kann ich dir helfen?`,
    placeholder:
      "Schreibe deine Nachricht... (Enter zum Senden, Shift+Enter für neue Zeile)",
    promptsTitle: "💡 Probiere diese Prompts",
  },
  {
    code: "pt",
    name: "Português",
    flag: "🇧🇷",
    welcomeMessage: (userName: string) =>
      `Olá ${userName} 🔥! 👋 Sou seu assistente GitHub Copilot para Azure DevOps. Como posso ajudá-lo hoje?`,
    placeholder:
      "Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)",
    promptsTitle: "💡 Experimente estes prompts",
  },
  {
    code: "zh",
    name: "中文",
    flag: "🇨🇳",
    welcomeMessage: (userName: string) =>
      `你好 ${userName} 🔥! 👋 我是你的 Azure DevOps GitHub Copilot 助手。今天我能帮你什么？`,
    placeholder: "输入您的消息... (回车发送, Shift+回车换行)",
    promptsTitle: "💡 试试这些提示",
  },
  {
    code: "ja",
    name: "日本語",
    flag: "🇯🇵",
    welcomeMessage: (userName: string) =>
      `こんにちは ${userName} 🔥! 👋 Azure DevOps 用の GitHub Copilot アシスタントです。今日は何をお手伝いしましょうか？`,
    placeholder: "メッセージを入力... (Enterで送信, Shift+Enterで改行)",
    promptsTitle: "💡 これらのプロンプトを試してください",
  },
  {
    code: "it",
    name: "Italiano",
    flag: "🇮🇹",
    welcomeMessage: (userName: string) =>
      `Ciao ${userName} 🔥! 👋 Sono il tuo assistente GitHub Copilot per Azure DevOps. Come posso aiutarti oggi?`,
    placeholder:
      "Scrivi il tuo messaggio... (Invio per inviare, Shift+Invio per nuova riga)",
    promptsTitle: "💡 Prova questi prompt",
  },
];

interface IChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface IPromptExample {
  id: string;
  icon: string;
  titles: { [lang: string]: string };
  prompts: { [lang: string]: string };
}

const PROMPT_EXAMPLES: IPromptExample[] = [
  {
    id: "new-project",
    icon: "🚀",
    titles: {
      es: "Nuevo proyecto",
      en: "New project",
      fr: "Nouveau projet",
      de: "Neues Projekt",
      pt: "Novo projeto",
      zh: "新项目",
      ja: "新しいプロジェクト",
      it: "Nuovo progetto",
    },
    prompts: {
      es: "Quiero empezar un nuevo proyecto en Azure DevOps",
      en: "I want to start a new project in Azure DevOps",
      fr: "Je veux démarrer un nouveau projet dans Azure DevOps",
      de: "Ich möchte ein neues Projekt in Azure DevOps starten",
      pt: "Quero iniciar um novo projeto no Azure DevOps",
      zh: "我想在 Azure DevOps 中启动一个新项目",
      ja: "Azure DevOps で新しいプロジェクトを始めたい",
      it: "Voglio iniziare un nuovo progetto in Azure DevOps",
    },
  },
  {
    id: "create-pipeline",
    icon: "⚙️",
    titles: {
      es: "Crear pipeline",
      en: "Create pipeline",
      fr: "Créer un pipeline",
      de: "Pipeline erstellen",
      pt: "Criar pipeline",
      zh: "创建管道",
      ja: "パイプラインを作成",
      it: "Creare pipeline",
    },
    prompts: {
      es: "Ayúdame a crear un pipeline de CI/CD para mi aplicación",
      en: "Help me create a CI/CD pipeline for my application",
      fr: "Aide-moi à créer un pipeline CI/CD pour mon application",
      de: "Hilf mir, eine CI/CD-Pipeline für meine Anwendung zu erstellen",
      pt: "Ajude-me a criar um pipeline de CI/CD para minha aplicação",
      zh: "帮我为我的应用程序创建 CI/CD 管道",
      ja: "アプリケーション用の CI/CD パイプラインの作成を手伝ってください",
      it: "Aiutami a creare una pipeline CI/CD per la mia applicazione",
    },
  },
  {
    id: "work-items",
    icon: "📋",
    titles: {
      es: "Gestionar work items",
      en: "Manage work items",
      fr: "Gérer les éléments",
      de: "Work Items verwalten",
      pt: "Gerenciar work items",
      zh: "管理工作项",
      ja: "作業項目を管理",
      it: "Gestire work items",
    },
    prompts: {
      es: "¿Cómo puedo organizar mis work items y sprints?",
      en: "How can I organize my work items and sprints?",
      fr: "Comment puis-je organiser mes éléments de travail et sprints ?",
      de: "Wie kann ich meine Work Items und Sprints organisieren?",
      pt: "Como posso organizar meus work items e sprints?",
      zh: "如何组织我的工作项和冲刺？",
      ja: "作業項目とスプリントをどのように整理できますか？",
      it: "Come posso organizzare i miei work items e sprint?",
    },
  },
  {
    id: "code-review",
    icon: "🔍",
    titles: {
      es: "Code review",
      en: "Code review",
      fr: "Revue de code",
      de: "Code-Review",
      pt: "Revisão de código",
      zh: "代码审查",
      ja: "コードレビュー",
      it: "Code review",
    },
    prompts: {
      es: "Dame buenas prácticas para hacer code reviews en Azure Repos",
      en: "Give me best practices for code reviews in Azure Repos",
      fr: "Donne-moi les meilleures pratiques pour les revues de code dans Azure Repos",
      de: "Gib mir Best Practices für Code-Reviews in Azure Repos",
      pt: "Me dê boas práticas para revisões de código no Azure Repos",
      zh: "给我在 Azure Repos 中进行代码审查的最佳实践",
      ja: "Azure Repos でのコードレビューのベストプラクティスを教えてください",
      it: "Dammi le best practice per le code review in Azure Repos",
    },
  },
  {
    id: "security",
    icon: "🔒",
    titles: {
      es: "Seguridad",
      en: "Security",
      fr: "Sécurité",
      de: "Sicherheit",
      pt: "Segurança",
      zh: "安全",
      ja: "セキュリティ",
      it: "Sicurezza",
    },
    prompts: {
      es: "¿Cómo puedo mejorar la seguridad de mi repositorio?",
      en: "How can I improve my repository's security?",
      fr: "Comment puis-je améliorer la sécurité de mon dépôt ?",
      de: "Wie kann ich die Sicherheit meines Repositories verbessern?",
      pt: "Como posso melhorar a segurança do meu repositório?",
      zh: "如何提高我仓库的安全性？",
      ja: "リポジトリのセキュリティを改善するにはどうすればよいですか？",
      it: "Come posso migliorare la sicurezza del mio repository?",
    },
  },
  {
    id: "automation",
    icon: "🤖",
    titles: {
      es: "Automatización",
      en: "Automation",
      fr: "Automatisation",
      de: "Automatisierung",
      pt: "Automação",
      zh: "自动化",
      ja: "自動化",
      it: "Automazione",
    },
    prompts: {
      es: "Quiero automatizar tareas repetitivas en mi proyecto",
      en: "I want to automate repetitive tasks in my project",
      fr: "Je veux automatiser les tâches répétitives dans mon projet",
      de: "Ich möchte wiederkehrende Aufgaben in meinem Projekt automatisieren",
      pt: "Quero automatizar tarefas repetitivas no meu projeto",
      zh: "我想在项目中自动化重复性任务",
      ja: "プロジェクト内の繰り返し作業を自動化したい",
      it: "Voglio automatizzare le attività ripetitive nel mio progetto",
    },
  },
  {
    id: "list-projects",
    icon: "📁",
    titles: {
      es: "Mis proyectos",
      en: "My projects",
      fr: "Mes projets",
      de: "Meine Projekte",
      pt: "Meus projetos",
      zh: "我的项目",
      ja: "マイプロジェクト",
      it: "I miei progetti",
    },
    prompts: {
      es: "¿Qué proyectos tengo en mi organización de Azure DevOps?",
      en: "What projects do I have in my Azure DevOps organization?",
      fr: "Quels projets ai-je dans mon organisation Azure DevOps ?",
      de: "Welche Projekte habe ich in meiner Azure DevOps-Organisation?",
      pt: "Quais projetos eu tenho na minha organização do Azure DevOps?",
      zh: "我的 Azure DevOps 组织中有哪些项目？",
      ja: "Azure DevOps 組織にはどのようなプロジェクトがありますか？",
      it: "Quali progetti ho nella mia organizzazione Azure DevOps?",
    },
  },
];

interface ICopilotChatState {
  messages: IChatMessage[];
  inputValue: string;
  isLoading: boolean;
  userName: string;
  userImageUrl: string;
  streamingMessageId: string | null;
  isConnected: boolean;
  connectionError: string | null;
  selectedLanguage: ILanguage;
  isLanguageSelectorOpen: boolean;
  // GitHub Auth state
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authUserCode: string | null;
  authVerificationUri: string | null;
  authError: string | null;
  // Model selector state
  models: CopilotModel[];
  selectedModel: string;
  modelsLoading: boolean;
  isModelSelectorOpen: boolean;
  // Tool progress state
  toolAction: string | null;
}

class CopilotChatHub extends React.Component<{}, ICopilotChatState> {
  private messagesEndRef = React.createRef<HTMLDivElement>();
  private textareaRef = React.createRef<HTMLTextAreaElement>();
  private modelSelectorRef = React.createRef<HTMLDivElement>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(props: {}) {
    super(props);
    this.state = {
      messages: [],
      inputValue: "",
      isLoading: false,
      userName: "",
      userImageUrl: "",
      streamingMessageId: null,
      isConnected: false,
      connectionError: null,
      selectedLanguage: LANGUAGES[0], // Default to Spanish
      isLanguageSelectorOpen: false,
      // GitHub Auth
      isAuthenticated: copilotService.isAuthenticated(),
      isAuthenticating: false,
      authUserCode: null,
      authVerificationUri: null,
      authError: null,
      // Models
      models: [],
      selectedModel: "gpt-5.2",
      modelsLoading: false,
      isModelSelectorOpen: false,
      // Tool progress
      toolAction: null,
    };
  }

  public async componentDidMount() {
    await SDK.init();
    await SDK.ready();

    const user = SDK.getUser();
    const defaultLang = LANGUAGES[0];
    this.setState({
      userName: user.displayName,
      userImageUrl: user.imageUrl || "",
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: defaultLang.welcomeMessage(user.displayName),
          timestamp: new Date(),
        },
      ],
    });

    // Get the Azure DevOps access token for the current user
    try {
      const adoToken = await SDK.getAccessToken();
      copilotService.setAdoToken(adoToken);
      console.log("[CopilotChatHub] ADO access token obtained");
    } catch (error) {
      console.warn("[CopilotChatHub] Failed to get ADO access token:", error);
    }

    // Close model dropdown on outside click
    document.addEventListener("mousedown", this.handleClickOutside);

    // Initialize proxy connection
    this.initializeCopilot();

    // If already authenticated (token in sessionStorage), verify it still works
    if (copilotService.isAuthenticated()) {
      console.log("[CopilotChatHub] Found existing token, verifying...");
      const verification = await copilotService.verifyToken();
      if (verification.valid) {
        console.log(`[CopilotChatHub] Token is valid for: ${verification.login}`);
        this.setState({ isAuthenticated: true });
        this.loadModels();
      } else {
        console.warn("[CopilotChatHub] Stored token is invalid, clearing...");
        copilotService.clearToken();
        this.setState({ isAuthenticated: false });
      }
    }
  }

  public componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutside);
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private handleClickOutside = (event: MouseEvent) => {
    if (
      this.state.isModelSelectorOpen &&
      this.modelSelectorRef.current &&
      !this.modelSelectorRef.current.contains(event.target as Node)
    ) {
      this.setState({ isModelSelectorOpen: false });
    }
  };

  private async initializeCopilot() {
    try {
      await copilotService.initialize();
      this.setState({ isConnected: true, connectionError: null });
      console.log("[CopilotChatHub] Connected to proxy server");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      this.setState({
        isConnected: false,
        connectionError: `No se pudo conectar con el servidor proxy: ${errorMessage}. Asegúrate de que esté ejecutándose con: cd server && npm run dev`,
      });
      console.error("[CopilotChatHub] Failed to connect:", error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔐 GitHub Authentication
  // ═══════════════════════════════════════════════════════════════════════════

  private handleGitHubLogin = async () => {
    this.setState({
      isAuthenticating: true,
      authError: null,
      authUserCode: null,
      authVerificationUri: null,
    });

    try {
      const deviceCode = await copilotService.initiateDeviceFlow();

      this.setState({
        authUserCode: deviceCode.userCode,
        authVerificationUri: deviceCode.verificationUri,
      });

      // Open GitHub verification page
      window.open(deviceCode.verificationUri, "_blank");

      // Start polling for token
      const interval = (deviceCode.interval || 5) * 1000;
      const pollFn = async () => {
        try {
          console.log("[CopilotChatHub] Polling for token...");
          const result = await copilotService.pollForToken(deviceCode.deviceCode);
          console.log(`[CopilotChatHub] Poll result: ${result.status}`);

          switch (result.status) {
            case "complete":
              // Authentication successful!
              console.log("[CopilotChatHub] Authentication complete! Clearing poll interval...");
              if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
              }
              // Verify token is working
              const verification = await copilotService.verifyToken();
              console.log(`[CopilotChatHub] Token verification:`, verification);

              this.setState({
                isAuthenticated: true,
                isAuthenticating: false,
                authUserCode: null,
                authVerificationUri: null,
                authError: null,
              });
              // Load models now
              this.loadModels();
              break;

            case "expired":
              if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
              }
              this.setState({
                isAuthenticating: false,
                authError: "El código ha expirado. Intenta de nuevo.",
                authUserCode: null,
              });
              break;

            case "error":
              if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
              }
              this.setState({
                isAuthenticating: false,
                authError: result.error || "Error de autenticación",
                authUserCode: null,
              });
              break;

            case "slow_down":
              // GitHub asks us to slow down - restart interval with longer delay
              if (this.pollInterval) {
                clearInterval(this.pollInterval);
              }
              const newInterval = (result.interval || 10) * 1000;
              console.log(`[CopilotChatHub] Slowing down poll interval to ${newInterval}ms`);
              this.pollInterval = setInterval(pollFn, newInterval);
              break;

            // "pending" - keep polling at current rate
          }
        } catch (error) {
          console.error("[CopilotChatHub] Poll error:", error);
        }
      };

      this.pollInterval = setInterval(pollFn, interval);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      this.setState({
        isAuthenticating: false,
        authError: errorMessage,
      });
    }
  };

  private handleGitHubLogout = () => {
    copilotService.clearToken();
    this.setState({
      isAuthenticated: false,
      models: [],
      selectedModel: "gpt-5.2",
    });
  };

  private async loadModels() {
    this.setState({ modelsLoading: true });
    try {
      const models = await copilotService.fetchModels();
      const defaultModel = models.find((m) => m.id === "gpt-5.2");
      this.setState({
        models,
        selectedModel: defaultModel ? defaultModel.id : models.length > 0 ? models[0].id : "gpt-5.2",
        modelsLoading: false,
      });
    } catch (error) {
      console.error("[CopilotChatHub] Failed to load models:", error);
      this.setState({ modelsLoading: false });
    }
  }

  private toggleModelSelector = () => {
    this.setState((prevState) => ({
      isModelSelectorOpen: !prevState.isModelSelectorOpen,
    }));
  };

  private handleModelSelect = (modelId: string) => {
    const { userName, selectedLanguage } = this.state;

    // Reset the conversation session when model changes
    copilotService.resetSession();

    this.setState({
      selectedModel: modelId,
      isModelSelectorOpen: false,
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: selectedLanguage.welcomeMessage(userName),
          timestamp: new Date(),
        },
      ],
    });
  };

  private scrollToBottom = () => {
    this.messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  componentDidUpdate(prevProps: {}, prevState: ICopilotChatState) {
    if (prevState.messages.length !== this.state.messages.length) {
      this.scrollToBottom();
    }
  }

  private handleInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    this.setState({ inputValue: event.target.value });
    this.adjustTextareaHeight();
  };

  private adjustTextareaHeight = () => {
    const textarea = this.textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
    }
  };

  private handleSendMessage = async () => {
    const { inputValue, messages, isConnected, isAuthenticated } = this.state;

    if (!inputValue.trim()) return;

    // Check authentication
    if (!isAuthenticated) {
      this.setState({
        messages: [
          ...messages,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content:
              "⚠️ Necesitas iniciar sesión con GitHub primero. Haz clic en el botón 'Iniciar sesión con GitHub' arriba.",
            timestamp: new Date(),
          },
        ],
      });
      return;
    }

    // Check connection status
    if (!isConnected) {
      this.setState({
        messages: [
          ...messages,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content:
              "⚠️ No hay conexión con el servidor proxy. Asegúrate de ejecutar: `cd server && npm run dev`",
            timestamp: new Date(),
          },
        ],
      });
      return;
    }

    const userMessage: IChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    // Create placeholder message for streaming
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: IChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    this.setState({
      messages: [...messages, userMessage, assistantMessage],
      inputValue: "",
      isLoading: true,
      streamingMessageId: assistantMessageId,
      toolAction: null,
    });

    // Reset textarea height
    if (this.textareaRef.current) {
      this.textareaRef.current.style.height = "auto";
    }

    // Send message to Copilot with streaming
    try {
      await copilotService.sendMessage(
        inputValue,
        // onDelta: update message content progressively
        (deltaContent) => {
          this.setState((prevState) => ({
            messages: prevState.messages.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + deltaContent }
                : msg,
            ),
          }));
        },
        // onComplete: finalize the message
        (_fullContent) => {
          this.setState({
            isLoading: false,
            streamingMessageId: null,
            toolAction: null,
          });
        },
        // onError: handle errors
        (error) => {
          this.setState((prevState) => ({
            messages: prevState.messages.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `❌ Error: ${error.message}` }
                : msg,
            ),
            isLoading: false,
            streamingMessageId: null,
            toolAction: null,
          }));
          // If auth error, reset auth state
          if (error.message.includes("expired") || error.message.includes("re-authenticate")) {
            this.setState({ isAuthenticated: false });
          }
        },
        this.state.selectedModel,
        // onProgress: show tool execution status
        (action, detail) => {
          const label = this.getToolActionLabel(action, detail);
          if (label) {
            this.setState({ toolAction: label });
          }
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      this.setState((prevState) => ({
        messages: prevState.messages.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: `❌ Error al enviar mensaje: ${errorMessage}` }
            : msg,
        ),
        isLoading: false,
        streamingMessageId: null,
        toolAction: null,
      }));
    }
  };

  /**
   * Maps tool/agent progress events to user-friendly labels
   */
  private getToolActionLabel(action: string, detail: string): string | null {
    // Well-known MCP tool names → friendly labels
    const TOOL_LABELS: Record<string, string> = {
      // ADO MCP tools
      "list_repos": "📋 Listando repositorios...",
      "get_repo": "📂 Leyendo repositorio...",
      "list_projects": "🏢 Listando proyectos...",
      "create_project": "🏗️ Creando proyecto...",
      "create_repo": "📦 Creando repositorio...",
      "search_code": "🔍 Buscando código...",
      "get_work_items": "📝 Consultando work items...",
      "create_work_item": "📝 Creando work item...",
      "get_pipelines": "🔄 Consultando pipelines...",
      "create_pipeline": "🔄 Creando pipeline...",
      // Custom ADO project tools
      "create_ado_project": "🏗️ Creando proyecto en Azure DevOps...",
      "create_ado_repo": "📦 Creando repositorio...",
      "import_quickstart_repo": "📥 Importando plantilla Quickstart...",
      "setup_ado_pipeline": "⚙️ Configurando pipeline CI/CD...",
    };

    switch (action) {
      case "tool_start": {
        const label = TOOL_LABELS[detail];
        if (label) return label;
        // Generic fallback with tool name
        return `🔧 ${detail}...`;
      }
      case "tool_end":
        return null; // Clear on completion — let next tool or delta take over
      case "agent_start":
        return `🤖 ${detail} trabajando...`;
      case "agent_end":
        return null;
      default:
        return null;
    }
  }

  private handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSendMessage();
    }
  };

  private handlePromptClick = (prompt: string) => {
    this.setState({ inputValue: prompt }, () => {
      this.handleSendMessage();
    });
  };

  private renderAvatar(role: "user" | "assistant"): JSX.Element {
    const { userImageUrl, userName } = this.state;

    if (role === "assistant") {
      return (
        <div className="message-avatar">
          <img src={copilotIcon} alt="Copilot" />
        </div>
      );
    }

    if (userImageUrl) {
      return (
        <div className="message-avatar">
          <img src={userImageUrl} alt={userName} />
        </div>
      );
    }

    // Fallback to initials
    const initials = userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    return <div className="message-avatar initials">{initials}</div>;
  }

  private handleLanguageChange = (language: ILanguage) => {
    const { userName, messages } = this.state;

    // Update welcome message with new language
    const updatedMessages = messages.map((msg) =>
      msg.id === "welcome"
        ? { ...msg, content: language.welcomeMessage(userName) }
        : msg,
    );

    this.setState({
      selectedLanguage: language,
      isLanguageSelectorOpen: false,
      messages: updatedMessages,
    });

    // Update the service with the new language
    copilotService.setLanguage(language.code);
  };

  private toggleLanguageSelector = () => {
    this.setState((prevState) => ({
      isLanguageSelectorOpen: !prevState.isLanguageSelectorOpen,
    }));
  };

  public render(): JSX.Element {
    const {
      messages,
      inputValue,
      isLoading,
      selectedLanguage,
      isLanguageSelectorOpen,
      isAuthenticated,
      isAuthenticating,
      authUserCode,
      authVerificationUri,
      authError,
      models,
      selectedModel,
      modelsLoading,
      isModelSelectorOpen,
      streamingMessageId,
      toolAction,
    } = this.state;
    const langCode = selectedLanguage.code;

    return (
      <Page className="copilot-chat-page flex-grow">
        <Header
          title="GitHub Copilot Chat"
          titleSize={TitleSize.Large}
          titleIconProps={{ iconName: "ChatBot" }}
        />

        <div className="page-content flex-grow">
          {/* Top bar: Language Selector + Auth + Model Selector */}
          <div className="top-bar-container">
            {/* Language Selector */}
            <div className="language-selector-container">
              <button
                className="language-selector-button"
                onClick={this.toggleLanguageSelector}
                aria-label="Select language"
              >
                <span className="language-flag">{selectedLanguage.flag}</span>
                <span className="language-name">{selectedLanguage.name}</span>
                <span className="language-arrow">
                  {isLanguageSelectorOpen ? "▲" : "▼"}
                </span>
              </button>

              {isLanguageSelectorOpen && (
                <div className="language-dropdown">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      className={`language-option ${lang.code === selectedLanguage.code ? "selected" : ""}`}
                      onClick={() => this.handleLanguageChange(lang)}
                    >
                      <span className="language-flag">{lang.flag}</span>
                      <span className="language-name">{lang.name}</span>
                      {lang.code === selectedLanguage.code && (
                        <span className="language-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* GitHub Auth */}
            <div className="github-auth-container">
              {isAuthenticated ? (
                <button
                  className="github-auth-button authenticated"
                  onClick={this.handleGitHubLogout}
                  title="Cerrar sesión de GitHub"
                >
                  <span className="github-icon">🔓</span>
                  <span className="github-auth-text">GitHub ✓</span>
                </button>
              ) : (
                <button
                  className="github-auth-button"
                  onClick={this.handleGitHubLogin}
                  disabled={isAuthenticating}
                >
                  <span className="github-icon">🔐</span>
                  <span className="github-auth-text">
                    {isAuthenticating ? "Autenticando..." : "Iniciar sesión con GitHub"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Device Flow Auth Dialog */}
          {isAuthenticating && authUserCode && (
            <div className="auth-dialog">
              <div className="auth-dialog-content">
                <h3>🔐 Autenticación con GitHub</h3>
                <p>Introduce este código en GitHub:</p>
                <div className="auth-code">{authUserCode}</div>
                <p>
                  Se ha abierto una ventana con{" "}
                  <a href={authVerificationUri || "#"} target="_blank" rel="noopener noreferrer">
                    {authVerificationUri}
                  </a>
                </p>
                <p className="auth-waiting">⏳ Esperando autenticación...</p>
                <button
                  className="auth-cancel-button"
                  onClick={() => {
                    if (this.pollInterval) {
                      clearInterval(this.pollInterval);
                      this.pollInterval = null;
                    }
                    this.setState({
                      isAuthenticating: false,
                      authUserCode: null,
                      authVerificationUri: null,
                    });
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Auth Error */}
          {authError && (
            <div className="auth-error">
              ⚠️ {authError}
              <button onClick={() => this.setState({ authError: null })} className="auth-error-dismiss">✕</button>
            </div>
          )}

          {/* Not authenticated overlay */}
          {!isAuthenticated && !isAuthenticating && (
            <div className="auth-required-overlay">
              <div className="auth-required-content">
                <img src={copilotIcon} alt="Copilot" className="auth-copilot-icon" />
                <h2>GitHub Copilot Chat</h2>
                <p>Para usar el chat, primero necesitas iniciar sesión con tu cuenta de GitHub.</p>
                <p className="auth-subtitle">Cada usuario interactúa con Copilot usando su propia cuenta.</p>
                <button
                  className="github-login-button-large"
                  onClick={this.handleGitHubLogin}
                >
                  <span>🔐</span> Iniciar sesión con GitHub
                </button>
              </div>
            </div>
          )}

          {/* Main chat (only visible when authenticated) */}
          {isAuthenticated && (
            <div className="main-layout">
              <div className="chat-container">
                <div className="messages-container">
                {messages.map((message) => {
                  // Hide the streaming placeholder while it has no content yet
                  // (the typing indicator below already shows the "thinking" state)
                  if (message.id === streamingMessageId && !message.content) {
                    return null;
                  }
                  return (
                  <div key={message.id} className={`message ${message.role}`}>
                    {this.renderAvatar(message.role)}
                    <div className="message-content">
                      <div className="message-text">{message.content}</div>
                      <div className="message-time">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  );
                })}
                {isLoading && (
                  <div className="message assistant">
                    {this.renderAvatar("assistant")}
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      {toolAction && (
                        <div className="tool-action-label">{toolAction}</div>
                      )}
                    </div>
                  </div>
                )}
                <div ref={this.messagesEndRef} />
              </div>

              <div className="input-container">
                <div className="input-row">
                  <textarea
                    ref={this.textareaRef}
                    value={inputValue}
                    onChange={this.handleInputChange}
                    onKeyDown={this.handleKeyDown}
                    placeholder={selectedLanguage.placeholder}
                    className="chat-input"
                    rows={1}
                  />
                  <Button
                    className="send-button"
                    primary={true}
                    onClick={this.handleSendMessage}
                    disabled={isLoading || !inputValue.trim()}
                  iconProps={{ iconName: "Send" }}
                  ariaLabel="Enviar"
                />
                </div>
                {isAuthenticated && (models.length > 0 || modelsLoading) && (
                  <div className="input-bottom-bar">
                    <div className="model-selector-container" ref={this.modelSelectorRef}>
                      {modelsLoading ? (
                        <span className="model-loading">⏳</span>
                      ) : (
                        <>
                          <button
                            className="model-selector-button"
                            onClick={this.toggleModelSelector}
                            disabled={isLoading}
                            aria-label="Select model"
                          >
                            <span className="model-selector-icon">🤖</span>
                            <span className="model-selector-name">
                              {models.find((m) => m.id === selectedModel)?.name || selectedModel}
                            </span>
                            <span className="model-selector-arrow">
                              {isModelSelectorOpen ? "▲" : "▼"}
                            </span>
                          </button>
                          {isModelSelectorOpen && (
                            <div className="model-dropdown">
                              {models.map((model) => (
                                <button
                                  key={model.id}
                                  className={`model-option ${model.id === selectedModel ? "selected" : ""}`}
                                  onClick={() => this.handleModelSelect(model.id)}
                                >
                                  <span className="model-option-name">{model.name}</span>
                                  {model.premiumRequests > 1 && (
                                    <span className="model-option-badge">{model.premiumRequests}x</span>
                                  )}
                                  {model.id === selectedModel && (
                                    <span className="model-option-check">✓</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="prompts-sidebar">
              <div className="prompts-header">
                <span className="prompts-icon">💡</span>
                <h3>{selectedLanguage.promptsTitle.replace("💡 ", "")}</h3>
              </div>
              <div className="prompts-list">
                {PROMPT_EXAMPLES.map((example) => (
                  <button
                    key={example.id}
                    className="prompt-card"
                    onClick={() =>
                      this.handlePromptClick(
                        example.prompts[langCode] || example.prompts["en"],
                      )
                    }
                  >
                    <span className="prompt-icon">{example.icon}</span>
                    <div className="prompt-info">
                      <span className="prompt-title">
                        {example.titles[langCode] || example.titles["en"]}
                      </span>
                      <span className="prompt-text">
                        {example.prompts[langCode] || example.prompts["en"]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            </div>
          )}
        </div>
      </Page>
    );
  }
}

ReactDOM.render(<CopilotChatHub />, document.getElementById("root"));
