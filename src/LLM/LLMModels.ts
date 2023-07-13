import { Configuration, OpenAIApi } from "openai";
import { PromptTemplate } from "../Prompt/PromptTemplate";
import { ModelPromptWithTools } from "../Prompt/Prompts";
import RedisCacheService from '../Service/redisCacheService';  // Update this with the actual import path

class OpenAIModel {
  private modelConfiguration: Configuration;
  public model: OpenAIApi;
  public readonly modelName: string = "gpt-4-0613";
  private temperature: number;
  private remainingTokens: number = 40000;
  private cacheService: RedisCacheService;

  constructor(temperature = 0) {
    this.modelConfiguration = new Configuration({
      organization: "org-4LbKZFYAeYBUivA5qxcat7n6",
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = new OpenAIApi(this.modelConfiguration);
    this.temperature = temperature;
    this.cacheService = new RedisCacheService();
  }
  
  async getModelResponseWithCache(prompt: ModelPromptWithTools) {
    const key = prompt.toString();
    console.log(key[0])
    let result = await this.cacheService.get(key);
    
    if (result === null) {
      result = await this.getModelResponse(prompt);
      await this.cacheService.set(key, result);
    }

    return result;
  }
  /**
   * This function takes in user input and async return the AIAgent answer
   * @param inputPrompt
   * @returns
   */
  async getModelResponse(promptObject: PromptTemplate): Promise<{ response: string, usage: any }> {
    return new Promise(async (resolve, reject) => {
      // const timeout = setTimeout(() => {
      //   reject("Request Time Out");
      // }, 5000);
      const prompt = await promptObject.getPrompt();
      const preRequestTokens = this.remainingTokens;
      const response = await this.model.createChatCompletion({
        model: this.modelName,
        temperature: this.temperature,
        messages: [
          { role: "system", content: promptObject.getSystemDescription() },
          { role: "user", content: prompt },
        ],
      });
      if (response.data.choices[0].message?.content) {
        // Extract the usage information from the response
        const usageInfo = response.data.usage;
        resolve({response: response.data.choices[0].message?.content, usage: usageInfo});
      } else {
        reject("No response from model");
      }
    });
  }
}

export { OpenAIModel };
