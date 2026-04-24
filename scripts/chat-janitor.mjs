import { clearExpiredChatMessages } from "../apps/backend/src/modules/chat/repository.mjs";

async function main() {
  const startedAt = new Date().toISOString();
  const result = await clearExpiredChatMessages();

  console.log(
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        deletedCount: result.deletedCount,
        storageDeletedCount: result.storageDeletedCount,
        affectedConversationIds: result.affectedConversationIds
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[chat-janitor] failed", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
