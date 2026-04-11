import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const response = await ai.models.list();
    for (const model of response) {
      if (model.supportedGenerationMethods?.includes('bidiGenerateContent')) {
        console.log(model.name, model.supportedGenerationMethods);
      }
    }
  } catch (e) {
    console.error(e);
  }
}
run();
