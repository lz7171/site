
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

// Always initialize the client with the API key from process.env.API_KEY using a named parameter
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateBusinessAdvice = async (history: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analise os dados financeiros e pedidos recentes da nossa hamburgueria: ${history}. Seu objetivo é maximizar o lucro e a eficiência operacional. Forneça 3 recomendações críticas baseadas nesses dados (ex: ajustar preços, remover itens de baixa margem, ou criar combos de alta margem).`,
      config: {
        systemInstruction: "Você é o Diretor de Estratégia (CFO) do MEME LANCHE. Responda em Português, seja incisivo, sofisticado, profissional e focado em alta performance de vendas.",
        temperature: 0.4,
        topP: 0.8,
      }
    });
    return response.text || "Continue monitorando seus KPIs estratégicos.";
  } catch (error) {
    console.error("Erro CFO IA:", error);
    return "Falha ao processar análise estratégica no momento.";
  }
};

export const chatWithGemini = async (messages: ChatMessage[]): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: 'Você é um consultor sênior especializado em franquias de hamburguerias premium como o Meme Lanche. Seu tom é formal, experiente e orientativo.',
      },
    });

    const lastUserMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage({ message: lastUserMessage });
    return result.text || "Estou processando seus dados.";
  } catch (error) {
    console.error("Chat error:", error);
    return "Ocorreu um erro na comunicação.";
  }
};
