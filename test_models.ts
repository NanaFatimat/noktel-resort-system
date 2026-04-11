import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  apiVersion: 'v1alpha'
});

async function run() {
  try {
    const response = await ai.models.list();
    for (const model of response) {
      if (model.supportedGenerationMethods?.includes('bidiGenerateContent')) {
        console.log(model.name);
      }
    }
  } catch (e: any) {
    console.error(e.message);
  }
}
run();
