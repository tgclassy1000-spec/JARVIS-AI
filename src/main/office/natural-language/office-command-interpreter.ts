import type { AIProvider, StreamChunk } from '../../conversation/provider/contracts';
import type {
  CreateNoteRequest,
  CreateProjectRequest,
  CreateReminderRequest,
  CreateTaskRequest,
  OfficeQuickAddRequest,
} from '../../../shared/office/contracts';

export type ParsedOfficeCommand =
  | {
      readonly kind: 'create-task';
      readonly request: CreateTaskRequest;
      readonly interpretedAs: string;
    }
  | {
      readonly kind: 'create-reminder';
      readonly request: CreateReminderRequest;
      readonly interpretedAs: string;
    }
  | {
      readonly kind: 'create-project';
      readonly request: CreateProjectRequest;
      readonly interpretedAs: string;
    }
  | {
      readonly kind: 'create-note';
      readonly request: CreateNoteRequest;
      readonly interpretedAs: string;
    };

interface GeminiCommandShape {
  readonly kind?: string;
  readonly title?: string;
  readonly name?: string;
  readonly content?: string;
  readonly description?: string;
  readonly remindAt?: string;
  readonly dueAt?: string;
  readonly tags?: readonly string[];
}

function nowFromRequest(request: OfficeQuickAddRequest): Date {
  return request.now ? new Date(request.now) : new Date();
}

function atLocalHour(base: Date, hour24: number): string {
  const next = new Date(base);
  next.setHours(hour24, 0, 0, 0);
  if (next.getTime() <= base.getTime()) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function tomorrow(base: Date): string {
  const next = new Date(base);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
}

function extractFivePm(text: string, base: Date): string | undefined {
  const match = /\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(text);
  if (!match) return undefined;
  const hourText = match[1]!;
  let hour = Number.parseInt(hourText, 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridian = match[3]?.toLowerCase();
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  const candidate = new Date(base);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= base.getTime()) candidate.setDate(candidate.getDate() + 1);
  return candidate.toISOString();
}

function stripCommandNoise(text: string): string {
  return text
    .replace(
      /\b(remind me|create project|create a project|add note|create note|add today's work|add todays work|finish)\b/gi,
      '',
    )
    .replace(/\b(at|by|tomorrow|today)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFallback(request: OfficeQuickAddRequest): ParsedOfficeCommand {
  const text = request.text.trim();
  const lowered = text.toLowerCase();
  const base = nowFromRequest(request);
  if (lowered.includes('remind me')) {
    return {
      kind: 'create-reminder',
      request: {
        title: stripCommandNoise(text) || text,
        remindAt: extractFivePm(text, base) ?? atLocalHour(base, 17),
      },
      interpretedAs: 'Created a reminder from natural language.',
    };
  }
  if (lowered.includes('create project')) {
    return {
      kind: 'create-project',
      request: { name: stripCommandNoise(text) || 'New project', status: 'active' },
      interpretedAs: 'Created a project from natural language.',
    };
  }
  if (lowered.includes("today's work") || lowered.includes('todays work')) {
    return {
      kind: 'create-note',
      request: { title: "Today's work", content: text, tags: ['daily'] },
      interpretedAs: 'Captured today’s work as a note.',
    };
  }
  return {
    kind: 'create-task',
    request: {
      title: stripCommandNoise(text) || text,
      dueAt: lowered.includes('tomorrow') ? tomorrow(base) : undefined,
      priority: lowered.includes('invoice') ? 'high' : 'medium',
    },
    interpretedAs: 'Created a task from natural language.',
  };
}

function tryParseJson(text: string): GeminiCommandShape | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  return JSON.parse(text.slice(start, end + 1)) as GeminiCommandShape;
}

function fromGeminiShape(shape: GeminiCommandShape): ParsedOfficeCommand | undefined {
  if (shape.kind === 'create-reminder' && shape.title && shape.remindAt) {
    return {
      kind: 'create-reminder',
      request: { title: shape.title, note: shape.description, remindAt: shape.remindAt },
      interpretedAs: 'Gemini interpreted the request as a reminder.',
    };
  }
  const projectName = shape.name ?? shape.title;
  if (shape.kind === 'create-project' && projectName) {
    return {
      kind: 'create-project',
      request: { name: projectName, description: shape.description },
      interpretedAs: 'Gemini interpreted the request as a project.',
    };
  }
  if (shape.kind === 'create-note' && shape.title) {
    return {
      kind: 'create-note',
      request: {
        title: shape.title,
        content: shape.content ?? shape.description ?? '',
        tags: shape.tags,
      },
      interpretedAs: 'Gemini interpreted the request as a note.',
    };
  }
  if (shape.kind === 'create-task' && shape.title) {
    return {
      kind: 'create-task',
      request: { title: shape.title, description: shape.description, dueAt: shape.dueAt },
      interpretedAs: 'Gemini interpreted the request as a task.',
    };
  }
  return undefined;
}

export class OfficeCommandInterpreter {
  public constructor(private readonly provider?: () => AIProvider) {}

  public async interpret(request: OfficeQuickAddRequest): Promise<ParsedOfficeCommand> {
    const provider = this.resolveProvider();
    if (!provider) return parseFallback(request);
    try {
      const session = provider.createSession();
      const stream = session.stream({
        systemInstruction:
          'Return only compact JSON for one office action. Supported kind values: create-task, create-reminder, create-project, create-note. Use ISO 8601 for dueAt and remindAt. Do not execute external tools.',
        messages: [
          {
            role: 'user',
            content: `Current time: ${nowFromRequest(request).toISOString()}\nRequest: ${request.text}`,
          },
        ],
      });
      let content = '';
      for await (const chunk of stream as AsyncIterable<StreamChunk>) content += chunk.text;
      const parsed = tryParseJson(content);
      const command = parsed ? fromGeminiShape(parsed) : undefined;
      return command ?? parseFallback(request);
    } catch {
      return parseFallback(request);
    }
  }

  private resolveProvider(): AIProvider | undefined {
    try {
      return this.provider?.();
    } catch {
      return undefined;
    }
  }
}
