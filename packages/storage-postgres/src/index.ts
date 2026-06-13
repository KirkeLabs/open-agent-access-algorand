import type { ReplayStore } from "@kirkelabs/open-agent-access-hono";

export interface PostgresReplayClient {
  query(sql: string, params?: unknown[]): Promise<{ rowCount?: number; rows?: unknown[] }>;
}

export interface PostgresReplayStoreOptions {
  tableName?: string;
}

export function createPostgresReplayStore(client: PostgresReplayClient, options: PostgresReplayStoreOptions = {}): ReplayStore {
  const tableName = validateTableName(options.tableName ?? "open_agent_access_replay");
  return {
    async has(key: string) {
      await deleteExpired(client, tableName);
      const result = await client.query(`select 1 from ${tableName} where replay_key = $1 and expires_at > now() limit 1`, [key]);
      return Boolean(result.rowCount ?? result.rows?.length);
    },
    async set(key: string, ttlMs: number) {
      await client.query(
        `insert into ${tableName} (replay_key, expires_at) values ($1, now() + ($2::text || ' milliseconds')::interval)
         on conflict (replay_key) do update set expires_at = excluded.expires_at`,
        [key, ttlMs]
      );
    }
  };
}

export function createPostgresReplayTableSql(tableName = "open_agent_access_replay") {
  const safeTable = validateTableName(tableName);
  return `create table if not exists ${safeTable} (
  replay_key text primary key,
  expires_at timestamptz not null
);
create index if not exists ${safeTable}_expires_at_idx on ${safeTable} (expires_at);`;
}

async function deleteExpired(client: PostgresReplayClient, tableName: string) {
  await client.query(`delete from ${tableName} where expires_at <= now()`);
}

function validateTableName(tableName: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error(`Invalid Postgres replay table name: ${tableName}`);
  }
  return tableName;
}
