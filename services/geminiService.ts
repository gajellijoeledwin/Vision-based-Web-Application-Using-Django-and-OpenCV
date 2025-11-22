import { GoogleGenAI, Type, SchemaType } from "@google/genai";
import { AnalysisResult, DetectedObject } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Using Flash for speed/efficiency in "YOLO-like" tasks
const VISION_MODEL = "gemini-2.5-flash";

// Schema for full analysis (includes summary)
const detectionSchema = {
  type: Type.OBJECT,
  properties: {
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Bounding box [ymin, xmin, ymax, xmax] 0-1000 scale.",
          },
        },
        required: ["label", "confidence", "box_2d"],
      },
    },
    summary: { type: Type.STRING, description: "Brief summary." },
  },
  required: ["objects", "summary"],
};

// LIGHTWEIGHT Schema for Live Video (No summary to save tokens/latency)
const liveDetectionSchema = {
  type: Type.OBJECT,
  properties: {
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Bounding box [ymin, xmin, ymax, xmax] 0-1000 scale.",
          },
        },
        required: ["label", "confidence", "box_2d"],
      },
    },
  },
  required: ["objects"],
};

export const analyzeImageWithGemini = async (base64Image: string): Promise<AnalysisResult> => {
  try {
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            text: "Detect objects. Return JSON with 'objects' array (label, confidence 0-1, box_2d [ymin, xmin, ymax, xmax] 0-1000 scale) and a short 'summary'.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: detectionSchema,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text);
    
    return {
      objects: data.objects || [],
      summary: data.summary || "Analysis completed.",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

// Optimized for Speed: No summary, lower temperature, specific instruction for speed
export const analyzeVideoFrameWithGemini = async (base64Image: string): Promise<{ objects: DetectedObject[] }> => {
  try {
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            // Explicitly limit object count to prevent huge responses that get truncated
            text: "Detect prominent objects (max 20). Return valid JSON 'objects' array only.", 
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: liveDetectionSchema,
        temperature: 0.0, // Deterministic for stability
        // Increased from 1024 to 2048 to prevent "Unterminated fractional number" JSON errors
        maxOutputTokens: 2048, 
      },
    });

    let text = response.text;
    if (!text) return { objects: [] };

    // Sanitize: Remove markdown code blocks if present (rare but possible)
    // This fixes cases where the model wraps output in ```json ... ```
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(text);
    return { objects: data.objects || [] };
  } catch (error) {
    // Silent failure is preferred in live stream to keep the stream alive 
    // rather than crashing the component loop.
    // console.error("Live Stream Inference Error:", error);
    return { objects: [] };
  }
};