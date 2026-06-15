import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueueProcessDocumentForAi,
  dequeueProcessDocumentForAi,
  clearMemoryQueueForTests,
  peekMemoryQueueForTests,
} from "../queue";

describe("AI index queue", () => {
  beforeEach(() => {
    clearMemoryQueueForTests();
  });

  it("enqueues and dequeues jobs in FIFO order", async () => {
    const job1 = { documentVersionId: "v-1", workspaceId: "ws-1" };
    const job2 = { documentVersionId: "v-2", workspaceId: "ws-1" };

    await enqueueProcessDocumentForAi(job1);
    await enqueueProcessDocumentForAi(job2);

    expect(peekMemoryQueueForTests()).toHaveLength(2);

    const dequeued1 = await dequeueProcessDocumentForAi();
    const dequeued2 = await dequeueProcessDocumentForAi();

    expect(dequeued1).toEqual(job1);
    expect(dequeued2).toEqual(job2);
    expect(await dequeueProcessDocumentForAi()).toBeNull();
  });
});
