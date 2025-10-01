import pdfParse from "pdf-parse/lib/pdf-parse.js"; // Import the specific module
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Clean filename and add timestamp
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, "_");
    cb(null, `pdf-${Date.now()}-${cleanName}`);
  },
});

export const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Function to extract text from PDF
export async function extractTextFromPDF(filePath) {
  try {
    console.log(`Reading PDF from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found at path: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    console.log(`PDF file size: ${dataBuffer.length} bytes`);

    const data = await pdfParse(dataBuffer);

    console.log(`Extracted text length: ${data.text.length} characters`);
    console.log(
      `PDF info: ${data.info?.Title || "No title"} - ${data.numpages} pages`
    );

    return data.text;
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Error extracting text from PDF: ${error.message}`);
  }
}

// Function to parse PDF text into FAQ format
export function parsePDFToFAQs(pdfText) {
  const faqs = [];

  if (!pdfText || pdfText.trim().length === 0) {
    console.log("No text extracted from PDF");
    return faqs;
  }

  console.log("Parsing PDF text into FAQs...");

  // Split text by lines and process
  const lines = pdfText.split("\n").filter((line) => line.trim().length > 5); // Filter very short lines

  let currentQuestion = "";
  let currentAnswer = "";
  let currentCategory = "General";

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip very short lines that are likely not content
    if (trimmedLine.length < 3) continue;

    // Detect question patterns
    const isQuestion =
      trimmedLine.endsWith("?") ||
      /^Q[\d\.\s:-]+\?/.test(trimmedLine) ||
      /^Question[\d\.\s:-]+\?/.test(trimmedLine) ||
      /^[A-Z][^.?]*\?$/.test(trimmedLine); // Line ending with ? and starting with capital

    if (isQuestion) {
      // Save previous FAQ if exists
      if (currentQuestion && currentAnswer.trim().length > 10) {
        faqs.push({
          question: currentQuestion,
          answer: currentAnswer.trim(),
          category: currentCategory,
        });
      }

      // Start new FAQ
      currentQuestion = trimmedLine;
      currentAnswer = "";
    }
    // Detect category/section headers
    else if (
      /^(Category|Section|Chapter|Topic|Department)[:\s]/i.test(trimmedLine)
    ) {
      currentCategory = trimmedLine
        .replace(/^(Category|Section|Chapter|Topic|Department)[:\s]+/i, "")
        .trim();
    }
    // Otherwise, treat as answer content (if we have an active question)
    else if (currentQuestion && trimmedLine.length > 0) {
      currentAnswer += trimmedLine + " ";
    }
  }

  // Don't forget the last FAQ
  if (currentQuestion && currentAnswer.trim().length > 10) {
    faqs.push({
      question: currentQuestion,
      answer: currentAnswer.trim(),
      category: currentCategory,
    });
  }

  console.log(`Basic parser found ${faqs.length} FAQs`);

  // If no FAQs found with basic parser, try alternative approach
  if (faqs.length === 0) {
    return parsePDFAlternative(pdfText);
  }

  return faqs;
}

// Alternative parsing method
function parsePDFAlternative(pdfText) {
  const faqs = [];
  const sentences = pdfText.split(/[.!?]+/).filter((s) => s.trim().length > 10);

  // Simple approach: look for question-answer patterns
  for (let i = 0; i < sentences.length - 1; i++) {
    const current = sentences[i].trim();
    const next = sentences[i + 1].trim();

    if (current.endsWith("?") || current.includes("?")) {
      faqs.push({
        question: current,
        answer: next,
        category: "General",
      });
    }
  }

  console.log(`Alternative parser found ${faqs.length} FAQs`);
  return faqs;
}

// AI-powered parsing
export async function parsePDFWithAI(pdfText) {
  try {
    // Limit text length to avoid token limits
    const limitedText = pdfText.substring(0, 6000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting FAQs from text. Extract all questions and their corresponding answers from the provided text. 
            Format the response as a JSON array of objects with exactly these fields: question, answer, category.
            Category should be one of: Admissions, Academics, Campus Life, Scholarships, Placements, General.
            If you can't determine the category, use "General".
            Return ONLY the JSON array, no other text.`,
          },
          {
            role: "user",
            content: `Extract FAQs from this text:\n\n${limitedText}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0]) {
      const content = data.choices[0].message.content.trim();
      console.log("AI response:", content);

      try {
        // Clean the response - sometimes GPT adds backticks or extra text
        const cleanContent = content.replace(/```json\n?|\n?```/g, "");
        const faqs = JSON.parse(cleanContent);
        console.log(`AI parser found ${faqs.length} FAQs`);
        return faqs;
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        return [];
      }
    }

    return [];
  } catch (error) {
    console.error("Error with AI parsing:", error);
    return [];
  }
}

// Clean up uploaded files
export function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    console.error("Error cleaning up file:", error);
  }
}
