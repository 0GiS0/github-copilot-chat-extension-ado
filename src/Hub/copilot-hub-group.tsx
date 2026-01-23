import "./copilot-hub-group.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";
import { TextField } from "azure-devops-ui/TextField";
import { Button } from "azure-devops-ui/Button";

interface IChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface ICopilotChatState {
    messages: IChatMessage[];
    inputValue: string;
    isLoading: boolean;
    userName: string;
}

class CopilotChatHub extends React.Component<{}, ICopilotChatState> {
    constructor(props: {}) {
        super(props);
        this.state = {
            messages: [],
            inputValue: "",
            isLoading: false,
            userName: ""
        };
    }

    public async componentDidMount() {
        await SDK.init();
        await SDK.ready();
        
        const user = SDK.getUser();
        this.setState({ 
            userName: user.displayName,
            messages: [
                {
                    id: "welcome",
                    role: "assistant",
                    content: `¡Hola ${user.displayName}! 👋 Soy tu asistente de GitHub Copilot para Azure DevOps. ¿En qué puedo ayudarte hoy?`,
                    timestamp: new Date()
                }
            ]
        });
    }

    private handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, newValue: string) => {
        this.setState({ inputValue: newValue });
    };

    private handleSendMessage = async () => {
        const { inputValue, messages } = this.state;
        
        if (!inputValue.trim()) return;

        const userMessage: IChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: inputValue,
            timestamp: new Date()
        };

        this.setState({ 
            messages: [...messages, userMessage],
            inputValue: "",
            isLoading: true 
        });

        // Simulated response - TODO: Connect to Copilot SDK
        setTimeout(() => {
            const assistantMessage: IChatMessage = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: `🚧 **Modo Demo**: Recibí tu mensaje: "${inputValue}"\n\nEsta es una respuesta simulada. Próximamente conectaremos con GitHub Copilot SDK + Azure DevOps MCP Server para respuestas reales.`,
                timestamp: new Date()
            };

            this.setState(prevState => ({
                messages: [...prevState.messages, assistantMessage],
                isLoading: false
            }));
        }, 1000);
    };

    private handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            this.handleSendMessage();
        }
    };

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
                    <div className="chat-container">
                        <div className="messages-container">
                            {messages.map((message) => (
                                <div 
                                    key={message.id} 
                                    className={`message ${message.role}`}
                                >
                                    <div className="message-avatar">
                                        {message.role === "user" ? "👤" : "🤖"}
                                    </div>
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
                                    <div className="message-avatar">🤖</div>
                                    <div className="message-content">
                                        <div className="typing-indicator">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="input-container">
                            <TextField
                                value={inputValue}
                                onChange={this.handleInputChange}
                                onKeyPress={this.handleKeyPress}
                                placeholder="Escribe tu mensaje... (Ej: Lista mis work items asignados)"
                                className="chat-input"
                                multiline={false}
                            />
                            <Button
                                text="Enviar"
                                primary={true}
                                onClick={this.handleSendMessage}
                                disabled={isLoading || !inputValue.trim()}
                                iconProps={{ iconName: "Send" }}
                            />
                        </div>
                    </div>
                </div>
            </Page>
        );
    }
}

ReactDOM.render(<CopilotChatHub />, document.getElementById("root"));
