import { z } from 'zod';

import { NEWS_CATEGORIES, WEB_TOOL_KINDS } from '../../../shared/web/contracts';
import { IPC_CHANNELS } from '../../../shared/platform/ipc';
import { PERMISSIONS } from '../../../shared/platform/permissions';
import type { IpcRouter } from '../../platform/ipc/ipc-router';
import type { WebIntelligenceService } from '../service/web-intelligence-service';

export type WebController = Pick<
  WebIntelligenceService,
  | 'dashboard'
  | 'ask'
  | 'search'
  | 'weather'
  | 'news'
  | 'convertCurrency'
  | 'time'
  | 'convertTime'
  | 'maps'
  | 'knowledge'
  | 'history'
  | 'bookmarks'
  | 'saveBookmark'
  | 'deleteBookmark'
>;

const emptySchema = z.object({}).strict();
const promptSchema = z.object({ prompt: z.string().trim().min(1).max(2_000) }).strict();
const searchSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();
const weatherSchema = z
  .object({
    location: z.string().trim().min(1).max(200),
    days: z.number().int().min(1).max(10).optional(),
  })
  .strict();
const newsSchema = z
  .object({
    category: z.enum(NEWS_CATEGORIES).optional(),
    country: z.string().trim().min(2).max(3).optional(),
    query: z.string().trim().min(1).max(300).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();
const currencySchema = z
  .object({
    amount: z.number().positive().max(1_000_000_000),
    from: z.string().trim().length(3),
    to: z.string().trim().length(3),
  })
  .strict();
const timeSchema = z.object({ timeZone: z.string().trim().min(1).max(100) }).strict();
const timeConvertSchema = z
  .object({
    fromTimeZone: z.string().trim().min(1).max(100),
    toTimeZone: z.string().trim().min(1).max(100),
    isoDateTime: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
const mapsSchema = z
  .object({
    query: z.string().trim().min(1).max(300),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .strict();
const knowledgeSchema = z.object({ topic: z.string().trim().min(1).max(300) }).strict();
const bookmarkSchema = z
  .object({
    kind: z.enum(WEB_TOOL_KINDS),
    title: z.string().trim().min(1).max(200),
    query: z.string().trim().min(1).max(500).optional(),
    url: z.url().optional(),
  })
  .strict();
const bookmarkIdSchema = z.object({ id: z.string().trim().min(1).max(128) }).strict();

export function registerWebEndpoints(router: IpcRouter, controller: WebController): void {
  router.register({
    channel: IPC_CHANNELS.webDashboard,
    requestSchema: emptySchema,
    handle: () => controller.dashboard(),
  });
  router.register({
    channel: IPC_CHANNELS.webAsk,
    requestSchema: promptSchema,
    requiredPermission: PERMISSIONS.network,
    handle: (request) => controller.ask(request),
  });
  router.register({
    channel: IPC_CHANNELS.webSearch,
    requestSchema: searchSchema,
    requiredPermission: PERMISSIONS.network,
    handle: (request) => controller.search(request),
  });
  router.register({
    channel: IPC_CHANNELS.webWeather,
    requestSchema: weatherSchema,
    requiredPermission: PERMISSIONS.network,
    handle: (request) => controller.weather(request),
  });
  router.register({
    channel: IPC_CHANNELS.webNews,
    requestSchema: newsSchema,
    requiredPermission: PERMISSIONS.network,
    handle: (request) => controller.news(request),
  });
  router.register({
    channel: IPC_CHANNELS.webCurrencyConvert,
    requestSchema: currencySchema,
    requiredPermission: PERMISSIONS.network,
    handle: (request) => controller.convertCurrency(request),
  });
  router.register({
    channel: IPC_CHANNELS.webTime,
    requestSchema: timeSchema,
    handle: (request) => controller.time(request),
  });
  router.register({
    channel: IPC_CHANNELS.webTimeConvert,
    requestSchema: timeConvertSchema,
    handle: (request) => controller.convertTime(request),
  });
  router.register({
    channel: IPC_CHANNELS.webMaps,
    requestSchema: mapsSchema,
    requiredPermission: PERMISSIONS.network,
    handle: (request) => controller.maps(request),
  });
  router.register({
    channel: IPC_CHANNELS.webKnowledge,
    requestSchema: knowledgeSchema,
    requiredPermission: PERMISSIONS.network,
    handle: (request) => controller.knowledge(request),
  });
  router.register({
    channel: IPC_CHANNELS.webHistory,
    requestSchema: emptySchema,
    handle: () => controller.history(),
  });
  router.register({
    channel: IPC_CHANNELS.webBookmarkList,
    requestSchema: emptySchema,
    handle: () => controller.bookmarks(),
  });
  router.register({
    channel: IPC_CHANNELS.webBookmarkSave,
    requestSchema: bookmarkSchema,
    handle: (request) => controller.saveBookmark(request),
  });
  router.register({
    channel: IPC_CHANNELS.webBookmarkDelete,
    requestSchema: bookmarkIdSchema,
    handle: (request) => {
      controller.deleteBookmark(request.id);
      return { deleted: true };
    },
  });
}
