import "./copilot-hub-group.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";
import { Button } from "azure-devops-ui/Button";

// Import Copilot icon
import copilotIcon from "../../static/copilot-icon.png";

interface IChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface IPromptExample {
  id: string;
  icon: string;
  title: string;
  prompt: string;
}

const PROMPT_EXAMPLES: IPromptExample[] = [
  {
    id: "new-project",
    icon: "🚀",
    title: "Nuevo proyecto",
    prompt: "Quiero empezar un nuevo proyecto en Azure DevOps",
  },
  {
    id: "create-pipeline",
    icon: "⚙️",
    title: "Crear pipeline",
    prompt: "Ayúdame a crear un pipeline de CI/CD para mi aplicación",
  },
  {
    id: "work-items",
    icon: "📋",
    title: "Gestionar work items",
    prompt: "¿Cómo puedo organizar mis work items y sprints?",
  },
  {
    id: "code-review",
    icon: "🔍",
    title: "Code review",
    prompt: "Dame buenas prácticas para hacer code reviews en Azure Repos",
  },
  {
    id: "security",
    icon: "🔒",
    title: "Seguridad",
    prompt: "¿Cómo puedo mejorar la seguridad de mi repositorio?",
  },
  {
    id: "automation",
    icon: "🤖",
    title: "Automatización",
    prompt: "Quiero automatizar tareas repetitivas en mi proyecto",
  },
];

interface ICopilotChatState {
  messages: IChatMessage[];
  inputValue: string;
  isLoading: boolean;
  userName: string;
  userImageUrl: string;
}

class CopilotChatHub extends React.Component<{}, ICopilotChatState> {
  private messagesEndRef = React.createRef<HTMLDivElement>();
  private textareaRef = React.createRef<HTMLTextAreaElement>();

  constructor(props: {}) {
    super(props);
    this.state = {
      messages: [],
      inputValue: "",
      isLoading: false,
      userName: "",
      userImageUrl: "",
    };
  }

  public async componentDidMount() {
    await SDK.init();
    await SDK.ready();

    const user = SDK.getUser();
    this.setState({
      userName: user.displayName,
      userImageUrl: user.imageUrl || "",
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: `¡Hola ${user.displayName} 🔥! 👋 Soy tu asistente de GitHub Copilot para Azure DevOps. ¿En qué puedo ayudarte hoy?`,
          timestamp: new Date(),
        },
      ],
    });
  }

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
    const { inputValue, messages } = this.state;

    if (!inputValue.trim()) return;

    const userMessage: IChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    this.setState({
      messages: [...messages, userMessage],
      inputValue: "",
      isLoading: true,
    });

    // Reset textarea height
    if (this.textareaRef.current) {
      this.textareaRef.current.style.height = "auto";
    }

    // Simulated response - TODO: Connect to Copilot SDK
    setTimeout(() => {
      const assistantMessage: IChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `🚧 **Modo Demo**: Recibí tu mensaje: "${inputValue}"\n\nEsta es una respuesta simulada. Próximamente conectaremos con GitHub Copilot SDK + Azure DevOps MCP Server para respuestas reales.`,
        timestamp: new Date(),
      };

      this.setState((prevState) => ({
        messages: [...prevState.messages, assistantMessage],
        isLoading: false,
      }));
    }, 1000);
  };

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

  public render(): JSX.Element {
    const { messages, inputValue, isLoading } = this.state;

    return (
      <Page className="copilot-chat-page flex-grow">
        <Header
          title="GitHub Copilot Chat"
          titleSize={TitleSize.Large}
          titleIconProps={{ iconName: "ChatBot" }}
        />

        <div className="page-content flex-grow">
          <div className="main-layout">
            <div className="chat-container">
              <div className="messages-container">
                {messages.map((message) => (
                  <div key={message.id} className={`message ${message.role}`}>
                    {this.renderAvatar(message.role)}
                    <div className="message-content">
                      <div className="message-text">{message.content}</div>
                      <div className="message-time">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    {this.renderAvatar("assistant")}
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={this.messagesEndRef} />
              </div>

              <div className="input-container">
                <textarea
                  ref={this.textareaRef}
                  value={inputValue}
                  onChange={this.handleInputChange}
                  onKeyDown={this.handleKeyDown}
                  placeholder="Escribe tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
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
            </div>

            <div className="prompts-sidebar">
              <div className="prompts-header">
                <span className="prompts-icon">💡</span>
                <h3>Prueba estos prompts</h3>
              </div>
              <div className="prompts-list">
                {PROMPT_EXAMPLES.map((example) => (
                  <button
                    key={example.id}
                    className="prompt-card"
                    onClick={() => this.handlePromptClick(example.prompt)}
                  >
                    <span className="prompt-icon">{example.icon}</span>
                    <div className="prompt-info">
                      <span className="prompt-title">{example.title}</span>
                      <span className="prompt-text">{example.prompt}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Page>
    );
  }
}

ReactDOM.render(<CopilotChatHub />, document.getElementById("root"));
