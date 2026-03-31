// ─────────────────────────────────────────────
// Google Gemini 2.0 Flash — AI client
// ─────────────────────────────────────────────
// Think of Gemini like a very knowledgeable chef consultant.
// You send it a detailed brief about your family's needs,
// and it sends back a structured meal plan in JSON format.

import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!)

// Generation config — forces clean JSON output
const JSON_CONFIG: GenerationConfig = {
  responseMimeType: 'application/json',
  temperature: 0.7,        // Some creativity, but not random
  topP: 0.9,
  maxOutputTokens: 8192,   // Enough for a full week plan
}

// Standard config for text responses
const TEXT_CONFIG: GenerationConfig = {
  temperature: 0.5,
  topP: 0.9,
  maxOutputTokens: 2048,
}

/**
 * Get the Gemini 2.0 Flash model configured for JSON output.
 * Use this for meal plan generation.
 */
export function getJsonModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: JSON_CONFIG,
  })
}

/**
 * Get the Gemini 2.0 Flash model for text responses.
 * Use this for explanations, dosha quiz scoring, etc.
 */
export function getTextModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: TEXT_CONFIG,
  })
}

/**
 * Safely call Gemini with a timeout.
 * Returns null and throws a friendly error if it times out.
 * Default is 55s to stay safely under Railway's 60s request limit.
 */
export async function callGeminiWithTimeout<T>(
  promptFn: () => Promise<T>,
  timeoutMs = 55_000
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs)
  )
  return Promise.race([promptFn(), timeout])
}
