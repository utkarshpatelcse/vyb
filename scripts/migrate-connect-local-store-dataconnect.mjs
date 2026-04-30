import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFirebaseDataConnect, loadRootEnv } from "../packages/config/src/index.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultStoreRoot = path.join(workspaceRoot, ".tmp", "vyb-connect");
const storeRoot = path.resolve(process.argv[2] ?? process.env.VYB_CONNECT_STORE_ROOT ?? defaultStoreRoot);

const connectorConfig = {
  connector: "connect",
  serviceId: "vyb",
  location: "asia-south1"
};

const GET_CONNECT_SESSION_BY_KEY_QUERY = `
  query GetConnectSessionByKeyMigration($sessionKey: String!) {
    connectSessions(where: { sessionKey: { eq: $sessionKey }, deletedAt: { isNull: true } }, limit: 1) {
      id
    }
  }
`;

const GET_CONNECT_SCORE_BY_KEY_QUERY = `
  query GetConnectScoreByKeyMigration($scoreKey: String!) {
    connectScores(where: { scoreKey: { eq: $scoreKey }, deletedAt: { isNull: true } }, limit: 1) {
      id
    }
  }
`;

const CREATE_CONNECT_SESSION_MUTATION = `
  mutation CreateConnectSessionMigration(
    $id: String!
    $sessionKey: String!
    $sessionId: String!
    $tenantId: String!
    $userId: String!
    $username: String!
    $displayName: String!
    $levelId: Int!
    $dailyIndex: Int!
    $dailyKey: String!
    $startedAt: Timestamp!
    $lastHintAt: Timestamp
    $hintsUsed: Int!
    $completedAt: Timestamp
    $elapsedCentiseconds: Int
    $adjustedCentiseconds: Int
  ) {
    connectSession_insert(
      data: {
        id: $id
        sessionKey: $sessionKey
        sessionId: $sessionId
        tenantId: $tenantId
        userId: $userId
        username: $username
        displayName: $displayName
        levelId: $levelId
        dailyIndex: $dailyIndex
        dailyKey: $dailyKey
        startedAt: $startedAt
        lastHintAt: $lastHintAt
        hintsUsed: $hintsUsed
        completedAt: $completedAt
        elapsedCentiseconds: $elapsedCentiseconds
        adjustedCentiseconds: $adjustedCentiseconds
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    )
  }
`;

const CREATE_CONNECT_SCORE_MUTATION = `
  mutation CreateConnectScoreMigration(
    $id: String!
    $scoreKey: String!
    $sessionId: String!
    $tenantId: String!
    $userId: String!
    $username: String!
    $displayName: String!
    $levelId: Int!
    $dailyIndex: Int!
    $dailyKey: String!
    $startedAt: Timestamp!
    $completedAt: Timestamp!
    $elapsedCentiseconds: Int!
    $hintsUsed: Int!
    $adjustedCentiseconds: Int!
  ) {
    connectScore_insert(
      data: {
        id: $id
        scoreKey: $scoreKey
        sessionId: $sessionId
        tenantId: $tenantId
        userId: $userId
        username: $username
        displayName: $displayName
        levelId: $levelId
        dailyIndex: $dailyIndex
        dailyKey: $dailyKey
        startedAt: $startedAt
        completedAt: $completedAt
        elapsedCentiseconds: $elapsedCentiseconds
        hintsUsed: $hintsUsed
        adjustedCentiseconds: $adjustedCentiseconds
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    )
  }
`;

function toCentiseconds(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : null;
}

function buildSessionKey(item) {
  return [item.tenantId, item.userId, item.dailyKey, item.levelId].join(":");
}

function buildScoreKey(item) {
  return [item.tenantId, item.userId, item.dailyKey, item.levelId].join(":");
}

async function recordExists(dc, query, operationName, keyName, keyValue, fieldName) {
  const response = await dc.executeGraphqlRead(query, {
    operationName,
    variables: {
      [keyName]: keyValue
    }
  });
  return Boolean(response.data?.[fieldName]?.[0]?.id);
}

async function migrateSession(dc, item) {
  const sessionKey = buildSessionKey(item);
  if (await recordExists(dc, GET_CONNECT_SESSION_BY_KEY_QUERY, "GetConnectSessionByKeyMigration", "sessionKey", sessionKey, "connectSessions")) {
    return false;
  }

  await dc.executeGraphql(CREATE_CONNECT_SESSION_MUTATION, {
    operationName: "CreateConnectSessionMigration",
    variables: {
      id: randomUUID(),
      sessionKey,
      sessionId: item.sessionId,
      tenantId: item.tenantId,
      userId: item.userId,
      username: item.username,
      displayName: item.displayName,
      levelId: item.levelId,
      dailyIndex: item.dailyIndex,
      dailyKey: item.dailyKey,
      startedAt: item.startedAt,
      lastHintAt: item.lastHintAt ?? null,
      hintsUsed: item.hintsUsed ?? 0,
      completedAt: item.completedAt ?? null,
      elapsedCentiseconds: toCentiseconds(item.elapsedSeconds),
      adjustedCentiseconds: toCentiseconds(item.adjustedTimeSeconds)
    }
  });
  return true;
}

async function migrateScore(dc, item) {
  const scoreKey = buildScoreKey(item);
  if (await recordExists(dc, GET_CONNECT_SCORE_BY_KEY_QUERY, "GetConnectScoreByKeyMigration", "scoreKey", scoreKey, "connectScores")) {
    return false;
  }

  await dc.executeGraphql(CREATE_CONNECT_SCORE_MUTATION, {
    operationName: "CreateConnectScoreMigration",
    variables: {
      id: item.scoreId || randomUUID(),
      scoreKey,
      sessionId: item.sessionId,
      tenantId: item.tenantId,
      userId: item.userId,
      username: item.username,
      displayName: item.displayName,
      levelId: item.levelId,
      dailyIndex: item.dailyIndex,
      dailyKey: item.dailyKey,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      elapsedCentiseconds: toCentiseconds(item.elapsedSeconds) ?? 0,
      hintsUsed: item.hintsUsed ?? 0,
      adjustedCentiseconds: toCentiseconds(item.adjustedTimeSeconds) ?? 0
    }
  });
  return true;
}

loadRootEnv(workspaceRoot);

const dc = getFirebaseDataConnect(connectorConfig);
const files = (await readdir(storeRoot).catch(() => [])).filter((name) => name.endsWith(".json"));
let sessions = 0;
let scores = 0;

for (const fileName of files) {
  const payload = JSON.parse(await readFile(path.join(storeRoot, fileName), "utf8"));
  for (const session of Array.isArray(payload.sessions) ? payload.sessions : []) {
    if (session?.tenantId && session?.userId && session?.dailyKey && session?.sessionId) {
      sessions += (await migrateSession(dc, session)) ? 1 : 0;
    }
  }
  for (const score of Array.isArray(payload.scores) ? payload.scores : []) {
    if (score?.tenantId && score?.userId && score?.dailyKey && score?.sessionId && score?.completedAt) {
      scores += (await migrateScore(dc, score)) ? 1 : 0;
    }
  }
}

console.log(`Migrated ${sessions} Connect sessions and ${scores} Connect scores from ${storeRoot}.`);
