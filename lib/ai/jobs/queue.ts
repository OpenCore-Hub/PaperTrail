import Redis from "ioredis";

export interface AiIndexJob {
  documentVersionId: string;
  workspaceId: string;
}

const QUEUE_KEY = "ai:index:queue";

let redisClient: Redis | null = null;
let redisChecked = false;

function getRedisClient(): Redis | null {
  if (redisChecked) return redisClient;
  redisChecked = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  try {
    redisClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });

    redisClient.on("error", (err) => {
      console.error("Redis AI queue error:", err.message);
    });
  } catch (err) {
    console.error("Failed to create Redis client for AI queue:", err);
    redisClient = null;
  }

  return redisClient;
}

const memoryQueue: AiIndexJob[] = [];

export async function enqueueProcessDocumentForAi(
  job: AiIndexJob,
): Promise<void> {
  const client = getRedisClient();
  if (client) {
    try {
      await client.lpush(QUEUE_KEY, JSON.stringify(job));
      return;
    } catch (err) {
      console.error("Failed to enqueue AI job to Redis, falling back:", err);
    }
  }

  memoryQueue.push(job);
}

export async function dequeueProcessDocumentForAi(): Promise<AiIndexJob | null> {
  const client = getRedisClient();
  if (client) {
    try {
      const item = await client.rpop(QUEUE_KEY);
      return item ? (JSON.parse(item) as AiIndexJob) : null;
    } catch (err) {
      console.error("Failed to dequeue AI job from Redis, falling back:", err);
    }
  }

  return memoryQueue.shift() ?? null;
}

export function peekMemoryQueueForTests(): readonly AiIndexJob[] {
  return memoryQueue;
}

export function clearMemoryQueueForTests(): void {
  memoryQueue.length = 0;
}
