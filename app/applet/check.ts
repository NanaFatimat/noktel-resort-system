import { LiveConnectConfig, Modality } from "@google/genai";
const config: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    generationConfig: {
        thinkingConfig: {
            thinkingLevel: 'minimal'
        }
    }
};
console.log(config);
