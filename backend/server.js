import weaviate from "weaviate-ts-client";
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import os from "os";
import {
  upload,
  extractTextFromPDF,
  parsePDFToFAQs,
  parsePDFWithAI,
  cleanupFile,
} from "./pdfProcessor.js";

dotenv.config();

const app = express();

// Add CORS middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000", // for local dev
      "https://hks88wwswgso00wwg0o88wog.prod.sanctumcloud.com", // your deployed frontend
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json());

// Weaviate connection
async function connectWeaviate() {
  try {
    const client = weaviate.client({
      scheme: process.env.WEAVIATE_SCHEME || "https",
      host: process.env.WEAVIATE_HOST,
      apiKey: process.env.WEAVIATE_API_KEY
        ? new weaviate.ApiKey(process.env.WEAVIATE_API_KEY)
        : undefined,
      headers: {
        "X-Openai-Api-Key": process.env.OPENAI_API_KEY,
      },
    });

    console.log("✅ Connected to Weaviate:", process.env.WEAVIATE_HOST);
    return client;
  } catch (err) {
    console.error("❌ Error connecting to Weaviate:", err);
    throw err;
  }
}

let weaviateClient;

(async () => {
  weaviateClient = await connectWeaviate();
})();

// Schema creation (same as before)
async function createFAQSchema(client) {
  const classObj = {
    class: "FAQ",
    description: "Frequently Asked Questions",
    vectorizer: "text2vec-openai",
    moduleConfig: {
      "text2vec-openai": {
        model: "text-embedding-3-small",
        type: "text",
      },
    },
    properties: [
      {
        name: "question",
        dataType: ["text"],
        description: "The FAQ question",
      },
      {
        name: "answer",
        dataType: ["text"],
        description: "The FAQ answer",
      },
      {
        name: "category",
        dataType: ["text"],
        description: "FAQ category",
      },
    ],
  };

  try {
    try {
      await client.schema.classDeleter().withClassName("FAQ").do();
      console.log("🗑️ Deleted existing FAQ class");
    } catch (e) {}

    await client.schema.classCreator().withClass(classObj).do();
    console.log("✅ FAQ schema created successfully");
  } catch (err) {
    console.error("❌ Error creating FAQ schema:", err);
  }
}

// Import FAQs from extracted data
async function importFAQs(client, faqs) {
  try {
    let batcher = client.batch.objectsBatcher();
    let counter = 0;
    let batchSize = 3;

    console.log(`Starting FAQ import for ${faqs.length} FAQs...`);

    for (const faq of faqs) {
      const obj = {
        class: "FAQ",
        properties: {
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
        },
      };

      batcher = batcher.withObject(obj);
      counter++;

      if (counter % batchSize === 0) {
        console.log(`Importing batch...`);
        await batcher.do();
        batcher = client.batch.objectsBatcher();
        console.log(`✅ Imported ${counter} FAQs...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (counter % batchSize !== 0) {
      console.log(`Importing final batch...`);
      await batcher.do();
    }

    console.log(`🎉 Successfully imported all ${counter} FAQs`);
    return counter;
  } catch (err) {
    console.error("❌ Error importing FAQs:", err);
    throw err;
  }
}

async function expandQuery(query) {
  if (query.length < 15) {
    // you can tweak threshold
    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
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
                content:
                  "Expand short or vague user queries into complete university FAQ-style questions. Example: 'courses?' → 'What programs or courses does the university offer?'",
              },
              { role: "user", content: query },
            ],
            max_tokens: 50,
            temperature: 0.3,
          }),
        }
      );

      const completion = await response.json();
      if (completion.error) throw new Error(completion.error.message);

      const expanded = completion.choices[0].message.content.trim();
      console.log("🔄 Expanded query:", expanded);
      return expanded;
    } catch (err) {
      console.error("❌ Error expanding query:", err);
      return query; // fallback to original query
    }
  }
  return query;
}

async function classifyConfirmation(userInput) {
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
          content:
            "You are a classifier. Decide if the user reply is CONFIRMATION (they mean yes/agree/correct), REJECTION (they mean no), or OTHER. Respond with only CONFIRMATION, REJECTION, or OTHER.",
        },
        { role: "user", content: userInput },
      ],
      max_tokens: 5,
      temperature: 0,
    }),
  });

  const completion = await response.json();
  const label = completion.choices[0].message.content.trim().toUpperCase();
  return label === "CONFIRMATION";
}

// PDF Upload and Processing endpoint
app.post("/api/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    if (!weaviateClient) {
      return res.status(500).json({ error: "Weaviate client not connected" });
    }

    console.log("Processing PDF:", req.file.filename);

    // Extract text from PDF
    const pdfText = await extractTextFromPDF(req.file.path);
    console.log(`Extracted ${pdfText.length} characters from PDF`);

    // Parse text into FAQs
    let faqs = parsePDFToFAQs(pdfText);
    console.log(`Extracted ${faqs.length} FAQs using basic parser`);

    // If basic parser doesn't find enough FAQs, try AI parsing
    if (faqs.length < 3) {
      console.log("Trying AI parsing...");
      const aiFAQs = await parsePDFWithAI(pdfText);
      if (aiFAQs.length > 0) {
        faqs = aiFAQs;
        console.log(`AI parser found ${faqs.length} FAQs`);
      }
    }

    if (faqs.length === 0) {
      cleanupFile(req.file.path);
      return res.status(400).json({
        error:
          "Could not extract any FAQs from the PDF. Please ensure the PDF contains question-answer pairs.",
      });
    }

    // Create schema and import FAQs
    await createFAQSchema(weaviateClient);
    const count = await importFAQs(weaviateClient, faqs);

    // Clean up uploaded file
    cleanupFile(req.file.path);

    res.json({
      success: true,
      message: `PDF processed successfully. Imported ${count} FAQs into the database.`,
      extractedFAQs: faqs.length,
      sampleFAQs: faqs.slice(0, 3), // Return first 3 FAQs as sample
    });
  } catch (error) {
    // Clean up file in case of error
    if (req.file && req.file.path) {
      cleanupFile(req.file.path);
    }

    console.error("PDF processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process PDF: " + error.message,
    });
  }
});

// Keep your existing endpoints (debug, search, chat) the same as in your original code
app.get("/api/debug", async (req, res) => {
  try {
    const result = await weaviateClient.graphql
      .get()
      .withClassName("FAQ")
      .withFields("question _additional { id }")
      .withLimit(100)
      .do();

    const faqs = result.data.Get?.FAQ || [];

    res.json({
      weaviateConnected: true,
      faqCount: faqs.length,
      faqs: faqs.map((f) => f.question),
    });
  } catch (error) {
    res.status(500).json({
      weaviateConnected: false,
      error: error.message,
    });
  }
});

// Search endpoint (same as before)
app.post("/api/search", async (req, res) => {
  try {
    const { query, limit = 3 } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    if (!weaviateClient) {
      return res.status(500).json({ error: "Weaviate client not connected" });
    }

    console.log("Searching with nearText:", query);

    const result = await weaviateClient.graphql
      .get()
      .withClassName("FAQ")
      .withFields("question answer category _additional { distance }")
      .withNearText({ concepts: [query] })
      .withLimit(parseInt(limit))
      .do();

    const faqs = (result.data.Get?.FAQ || []).map((item) => ({
      question: item.question,
      answer: item.answer,
      category: item.category,
      similarity:
        item._additional.distance !== undefined
          ? 1 - item._additional.distance
          : 1,
    }));

    res.json({
      success: true,
      query,
      results: faqs,
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during search",
      details: error.message,
    });
  }
});

// Store last suggestion in memory (per session/user ideally)
let lastSuggestion = null;

// Chat endpoint (same as before)
app.post("/api/chat", async (req, res) => {
  try {
    let { message } = req.body;
    message = message.trim().toLowerCase();

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log("Chat query with nearText:", message);

    // ✅ If user says "yes" and we have a pending suggestion
    if (lastSuggestion && (await classifyConfirmation(message))) {
      const suggestedFAQ = lastSuggestion;
      lastSuggestion = null;
      return res.json({
        message: suggestedFAQ.answer,
        sources: [suggestedFAQ],
        confidence: "medium",
      });
    }

    // Step 1: Expand query if short
    const expandedMessage = await expandQuery(message);

    // Step 2: Normal Weaviate search
    const searchResult = await weaviateClient.graphql
      .get()
      .withClassName("FAQ")
      .withFields("question answer category _additional { distance }")
      .withNearText({ concepts: [expandedMessage] })
      .withLimit(3)
      .do();

    const relevantFAQs = searchResult.data.Get?.FAQ || [];
    if (relevantFAQs.length === 0) {
      return res.json({
        message:
          "I'm sorry, I couldn't find any relevant information in our FAQ to answer your question. Please contact our support team for further assistance.",
        sources: [],
        confidence: 0,
      });
    }

    const bestMatch = relevantFAQs[0];
    const similarity =
      bestMatch._additional?.distance !== undefined
        ? 1 - bestMatch._additional.distance
        : 0;

    const MIN_SIMILARITY_FOR_SUGGESTION = 0.6; // tweak between 0.5–0.7

    // Step 3: Suggest clarification only if similarity is reasonably high
    if (similarity < 0.75) {
      if (similarity >= MIN_SIMILARITY_FOR_SUGGESTION) {
        lastSuggestion = bestMatch; // save suggestion
        return res.json({
          message: `Did you mean: "${bestMatch.question}"?`,
          suggestion: bestMatch.question,
          confidence: "low",
        });
      } else {
        // similarity too low → don't suggest unrelated FAQ
        lastSuggestion = null;
        return res.json({
          message:
            "I'm sorry, I couldn't find any relevant information in our FAQ to answer your question. Please contact our support team for further assistance.",
          sources: [],
          confidence: 0,
        });
      }
    }

    // Step 4: Use normal OpenAI answering with relevantFAQs
    const prompt = createPrompt(message, relevantFAQs);
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            // { role: "system", content: "Answer only using FAQ context." },
            {
              role: "system",
              content: `You are a helpful FAQ assistant. Answer questions ONLY using the provided FAQ context. If the answer isn't in the FAQs, politely decline to answer. Keep responses concise and helpful.`,
            },
            {
              role: "user",
              content: prompt,
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      }
    );

    const completion = await openaiResponse.json();

    if (completion.error) {
      throw new Error(completion.error.message);
    }

    const aiResponse = completion.choices[0].message.content;

    res.json({
      message: aiResponse,
      sources: relevantFAQs.map((faq) => ({
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
      })),
      confidence: "high",
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: "Failed to process your message",
      details: error.message,
    });
  }
});

function createPrompt(userQuestion, faqs) {
  let context = "FAQ Context:\n\n";

  faqs.forEach((faq, index) => {
    context += `FAQ ${index + 1}:\n`;
    context += `Question: ${faq.question}\n`;
    context += `Answer: ${faq.answer}\n`;
    context += `Category: ${faq.category}\n\n`;
  });

  context += `User Question: ${userQuestion}\n\n`;
  context += `Instructions: Using ONLY the information from the FAQs above, provide a helpful answer to the user's question. If the answer cannot be found in the provided FAQs, say "I'm sorry, I don't have information about that in our FAQs. Please contact our support team for assistance." Do not make up information or use external knowledge.`;

  return context;
}

app.get("/", (req, res) => {
  res.send("Weaviate connection working!");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  let networkAddress = "unknown";

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        networkAddress = net.address;
      }
    }
  }

  console.log("🚀 Server running on:");
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${networkAddress}:${PORT}`);
});
