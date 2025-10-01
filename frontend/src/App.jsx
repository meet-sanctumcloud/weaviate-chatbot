import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import ChatInterface from "./components/ChatInterface";

function App() {
  const [currentView, setCurrentView] = useState("upload");
  const [uploaded, setUploaded] = useState(false);

  const handleUploadSuccess = () => {
    setUploaded(true);
    setCurrentView("chat");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
        {/* Header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "40px",
            paddingTop: "40px",
          }}
        >
          <h1
            style={{
              fontSize: "2.5rem",
              color: "white",
              marginBottom: "16px",
              fontWeight: "700",
            }}
          >
            PDF Chat Assistant
          </h1>
          <p style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.8)" }}>
            Upload your PDF and chat with AI about its content
          </p>
        </div>

        {/* Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <button
            onClick={() => setCurrentView("upload")}
            className="btn"
            style={{
              background:
                currentView === "upload" ? "white" : "rgba(255,255,255,0.2)",
              color: currentView === "upload" ? "#3b82f6" : "white",
            }}
          >
            📁 Upload PDF
          </button>
          <button
            onClick={() => uploaded && setCurrentView("chat")}
            className="btn"
            style={{
              background:
                currentView === "chat" ? "white" : "rgba(255,255,255,0.2)",
              color: currentView === "chat" ? "#3b82f6" : "white",
              opacity: uploaded ? 1 : 0.5,
            }}
            disabled={!uploaded}
          >
            💬 Chat
          </button>
        </div>

        {/* Main Content */}
        <div>
          {currentView === "upload" && (
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          )}
          {currentView === "chat" && (
            <ChatInterface onBackToUpload={() => setCurrentView("upload")} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
