import type { ReplayStore } from "@kirkelabs/open-agent-access-hono";

export interface RedisReplayClient {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, modeOrOptions?: "PX" | { PX?: number; px?: number }, ttlMs?: number): Promise<unknown> | unknown;
}

export interface RedisReplayStoreOptions {
  prefix?: string;
}

export function createRedisReplayStore(client: RedisReplayClient, options: RedisReplayStoreOptions = {}): ReplayStore {
  const prefix = options.prefix ?? "oaa:replay:";
  return {
    async has(key: string) {
      return (await client.get(`${prefix}${key}`)) !== null;
    },
    async set(key: string, ttlMs: number) {
      const namespaced = `${prefix}${key}`;
      try {
        await client.set(namespaced, "1", { PX: ttlMs });
      } catch {
        await client.set(namespaced, "1", "PX", ttlMs);
      }
    }
  };
}
