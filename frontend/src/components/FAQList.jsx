const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Database,
  ChevronDown,
  ChevronUp,
  Search,
  AlertCircle,
} from "lucide-react";

const FAQList = ({ onBackToUpload }) => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedFaq, setExpandedFaq] = useState(null);

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/debug`);
      if (response.data.faqs && response.data.faqCount > 0) {
        // For now, we only have question titles from debug endpoint
        // You might want to create a new endpoint to get full FAQ data
        const faqData = response.data.faqs.map((question, index) => ({
          id: index,
          question: question,
          answer:
            "Full answer not available in debug endpoint. Please use chat interface.",
          category: "General",
        }));
        setFaqs(faqData);
      } else {
        setFaqs([]);
      }
    } catch (err) {
      setError("Failed to fetch FAQs");
      console.error("Error fetching FAQs:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFaq = (id) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="spinner mx-auto mb-4"></div>
        <p className="text-gray-600">Loading FAQs...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database size={24} />
            <div>
              <h2 className="text-xl font-bold">Extracted FAQs</h2>
              <p className="text-green-100 text-sm">
                {faqs.length} questions extracted from your PDF
              </p>
            </div>
          </div>
          <button
            onClick={onBackToUpload}
            className="bg-white text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors"
          >
            Upload New PDF
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search FAQs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-lg mb-6">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {filteredFaqs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Database size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No FAQs Found</p>
            <p className="mt-2">
              {searchTerm
                ? "Try adjusting your search terms"
                : "Upload a PDF to extract FAQs"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800 pr-4">
                      {faq.question}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {faq.category}
                      </span>
                    </div>
                  </div>
                  {expandedFaq === faq.id ? (
                    <ChevronUp
                      size={20}
                      className="text-gray-400 flex-shrink-0"
                    />
                  ) : (
                    <ChevronDown
                      size={20}
                      className="text-gray-400 flex-shrink-0"
                    />
                  )}
                </button>
                {expandedFaq === faq.id && (
                  <div className="px-4 pb-4">
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-gray-600 whitespace-pre-wrap">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FAQList;
