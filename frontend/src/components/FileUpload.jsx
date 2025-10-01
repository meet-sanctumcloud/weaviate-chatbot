const API_URL = import.meta.env.VITE_API_URL;
import React, { useState } from "react";
import axios from "axios";

const FileUpload = ({ onUploadSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please select a PDF file");
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    setIsUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await axios.post(`${API_URL}/api/upload-pdf`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onUploadSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to upload PDF");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="card">
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "4rem", marginBottom: "16px" }}>📄</div>
        <h2
          style={{ fontSize: "1.5rem", marginBottom: "16px", color: "#1f2937" }}
        >
          Upload Your PDF
        </h2>
        <p style={{ color: "#6b7280", marginBottom: "32px" }}>
          Select a PDF file to extract FAQs and start chatting
        </p>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            border: "2px dashed #d1d5db",
            borderRadius: "12px",
            padding: "60px 40px",
            textAlign: "center",
            marginBottom: "24px",
            background: "#f9fafb",
            cursor: isUploading ? "not-allowed" : "pointer",
            opacity: isUploading ? 0.6 : 1,
          }}
          onClick={() =>
            !isUploading && document.getElementById("file-input").click()
          }
        >
          {isUploading ? (
            <div>
              <div
                className="loading-spinner"
                style={{ margin: "0 auto 16px" }}
              ></div>
              <p style={{ color: "#6b7280" }}>
                Uploading and processing PDF...
              </p>
            </div>
          ) : (
            <div>
              <p
                style={{
                  fontSize: "1.1rem",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Drop your PDF here or click to browse
              </p>
              <p style={{ color: "#9ca3af" }}>Only PDF files are supported</p>
            </div>
          )}
        </div>

        <input
          id="file-input"
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ display: "none" }}
          disabled={isUploading}
        />

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "16px",
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            background: "#f0f9ff",
            padding: "20px",
            borderRadius: "8px",
            textAlign: "left",
          }}
        >
          <h3 style={{ color: "#0369a1", marginBottom: "12px" }}>
            How it works:
          </h3>
          <ul style={{ color: "#0c4a6e", listStyle: "none", padding: 0 }}>
            <li style={{ marginBottom: "8px" }}>• Upload a PDF document</li>
            <li style={{ marginBottom: "8px" }}>
              • AI extracts questions and answers automatically
            </li>
            <li style={{ marginBottom: "8px" }}>
              • Chat with AI about the document content
            </li>
            <li>• Get instant answers based on your PDF</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
