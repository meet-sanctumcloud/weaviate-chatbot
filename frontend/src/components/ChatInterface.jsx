const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const ChatInterface = ({ onBackToUpload }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/chat`, {
        message: inputMessage,
      });

      const botMessage = {
        id: Date.now() + 1,
        text: response.data.message,
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error. Please try again.",
        sender: "bot",
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "4px" }}>
            💬 PDF Chat
          </h2>
          <p style={{ opacity: 0.8 }}>
            Ask questions about your uploaded document
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={clearChat}
            className="btn"
            style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
          >
            Clear
          </button>
          <button
            onClick={onBackToUpload}
            className="btn"
            style={{ background: "white", color: "#667eea" }}
          >
            New PDF
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          height: "400px",
          overflowY: "auto",
          padding: "24px",
          background: "#f8fafc",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#6b7280",
              marginTop: "80px",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🤖</div>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "8px" }}>
              Welcome to PDF Chat!
            </h3>
            <p>Start a conversation by typing a question below.</p>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent:
                    message.sender === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    background: message.sender === "user" ? "#3b82f6" : "white",
                    color: message.sender === "user" ? "white" : "#374151",
                    padding: "12px 16px",
                    borderRadius: "18px",
                    maxWidth: "70%",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    border:
                      message.sender === "bot" ? "1px solid #e5e7eb" : "none",
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    background: "white",
                    padding: "12px 16px",
                    borderRadius: "18px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div className="loading-spinner"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "24px", borderTop: "1px solid #e5e7eb" }}>
        <form onSubmit={sendMessage} style={{ display: "flex", gap: "12px" }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your question about the PDF..."
            className="input"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="btn btn-primary"
            style={{ minWidth: "80px" }}
          >
            {isLoading ? <div className="loading-spinner"></div> : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
