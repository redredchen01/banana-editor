import { GoogleGenAI } from "@google/genai";
import { ImageFile, GenerationResult } from "../types";

/**
 * Generates or edits an image based on a text prompt.
 * 
 * @param prompt The text description
 * @param image Optional source image for editing/variations
 * @param usePro If true, uses the high-quality 'gemini-3-pro-image-preview' model (Requires paid API Key)
 */
export const generateWithGemini = async (
  prompt: string,
  image?: ImageFile | null,
  usePro: boolean = false
): Promise<GenerationResult> => {
  try {
    // CRITICAL: Initialize GoogleGenAI INSIDE the function.
    // This ensures that if the user just selected a new API key via window.aistudio.openSelectKey(),
    // we pick up the latest process.env.API_KEY value injected by the environment.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Select model based on Pro flag
    const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

    const parts: any[] = [];

    // Add image if present
    if (image) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64Data,
        },
      });
    }

    // Add text prompt
    parts.push({
      text: prompt,
    });

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: parts,
      },
      // When using Pro model, we can theoretically request higher res, but let's stick to defaults 
      // or let the model decide for now. The key is using the 'pro' model name.
      config: usePro ? {
        imageConfig: {
          imageSize: "1K" // Or "2K" if supported and desired, keeping 1K for safety/speed balance
        }
      } : undefined
    });

    let generatedImageUrl: string | null = null;
    let textOutput: string | null = null;

    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        } else if (part.text) {
          textOutput = part.text;
        }
      }
    }

    if (!generatedImageUrl && !textOutput) {
      throw new Error("No content generated from the model.");
    }

    return {
      imageUrl: generatedImageUrl,
      textResponse: textOutput,
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};