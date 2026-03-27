import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
    ChatCompletionMessageParam,
    ChatCompletionTool,
    ChatCompletionChunk,
} from 'openai/resources/chat/completions';
import { Stream } from 'openai/streaming';

export interface StreamEvent {
    type: 'delta' | 'tool_call' | 'tool_result' | 'done' | 'error';
    content?: string;
    toolCall?: { id: string; name: string; arguments: string };
    toolResult?: { callId: string; result: string };
}

@Injectable()
export class OpenAIService {
    private readonly logger = new Logger(OpenAIService.name);
    private readonly client: OpenAI;
    private readonly textModel: string;
    private readonly visionModel: string;

    constructor(private configService: ConfigService) {
        this.client = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
        this.textModel =
            this.configService.get<string>('OPENAI_TEXT_MODEL') || 'gpt-4o-mini';
        this.visionModel =
            this.configService.get<string>('OPENAI_VISION_MODEL') || 'gpt-4o';
    }

    async chatCompletionStream(
        messages: ChatCompletionMessageParam[],
        tools?: ChatCompletionTool[],
    ): Promise<Stream<ChatCompletionChunk>> {
        return this.client.chat.completions.create({
            model: this.textModel,
            messages,
            tools: tools?.length ? tools : undefined,
            stream: true,
            temperature: 0.7,
            max_tokens: 2048,
        });
    }

    async chatCompletion(
        messages: ChatCompletionMessageParam[],
        tools?: ChatCompletionTool[],
    ) {
        return this.client.chat.completions.create({
            model: this.textModel,
            messages,
            tools: tools?.length ? tools : undefined,
            temperature: 0.7,
            max_tokens: 2048,
        });
    }

    async analyzeImage(
        imageUrls: string[],
        prompt: string,
    ): Promise<string> {
        const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
            { type: 'text', text: prompt },
            ...imageUrls.map(
                (url) =>
                    ({
                        type: 'image_url',
                        image_url: { url, detail: 'high' },
                    }) as OpenAI.Chat.Completions.ChatCompletionContentPart,
            ),
        ];

        const response = await this.client.chat.completions.create({
            model: this.visionModel,
            messages: [{ role: 'user', content }],
            max_tokens: 1024,
            temperature: 0.5,
        });

        return response.choices[0]?.message?.content || '';
    }
}
