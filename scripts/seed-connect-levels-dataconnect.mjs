import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFirebaseDataConnect, loadRootEnv } from "../packages/config/src/index.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSeedPath = path.join(workspaceRoot, "data", "connect-levels.json");
const seedPath = path.resolve(process.argv[2] ?? process.env.VYB_CONNECT_LEVELS_PATH ?? defaultSeedPath);
const storeId = process.env.VYB_CONNECT_GAME_LEVEL_STORE_ID ?? process.env.VYB_CONNECT_LEVEL_STORE_ID ?? "connect-1000-levels";

const connectorConfig = {
  connector: "connect",
  serviceId: "vyb",
  location: "asia-south1"
};

const GET_GAME_LEVEL_QUERY = `
  query GetGameLevelSeed($id: String!) {
    gamesLevel(key: { id: $id }) {
      id
      checksum
      totalLevels
      updatedAt
    }
  }
`;

const CREATE_GAME_LEVEL_MUTATION = `
  mutation CreateGameLevelSeed(
    $id: String!
    $payloadJson: String!
    $totalLevels: Int!
    $launchDate: String
    $checksum: String
  ) {
    gamesLevel_insert(
      data: {
        id: $id
        payloadJson: $payloadJson
        totalLevels: $totalLevels
        launchDate: $launchDate
        checksum: $checksum
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const UPDATE_GAME_LEVEL_MUTATION = `
  mutation UpdateGameLevelSeed(
    $id: String!
    $payloadJson: String!
    $totalLevels: Int!
    $launchDate: String
    $checksum: String
  ) {
    gamesLevel_update(
      key: { id: $id }
      data: {
        payloadJson: $payloadJson
        totalLevels: $totalLevels
        launchDate: $launchDate
        checksum: $checksum
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

function normalizeInteger(value) {
  return typeof value === "number" && Number.isInteger(value) ? value : Number.NaN;
}

function normalizeCoordinate(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const x = normalizeInteger(value.x);
  const y = normalizeInteger(value.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function validateLevel(level) {
  const levelId = normalizeInteger(level?.level_id);
  const gridSize = normalizeInteger(level?.grid_size);

  if (!Number.isFinite(levelId) || !Number.isFinite(gridSize) || gridSize < 2) {
    return false;
  }

  if (!Array.isArray(level.dots) || !Array.isArray(level.solution_path)) {
    return false;
  }

  const expectedPathLength = gridSize * gridSize;
  if (level.solution_path.length !== expectedPathLength) {
    return false;
  }

  const seen = new Set();
  for (const point of level.solution_path) {
    const normalized = normalizeCoordinate(point);
    if (!normalized || normalized.x < 0 || normalized.y < 0 || normalized.x >= gridSize || normalized.y >= gridSize) {
      return false;
    }

    const key = `${normalized.x}:${normalized.y}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }

  for (let index = 1; index < level.solution_path.length; index += 1) {
    const previous = level.solution_path[index - 1];
    const current = level.solution_path[index];
    const distance = Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y);
    if (distance !== 1) {
      return false;
    }
  }

  const dotIds = level.dots.map((dot) => normalizeInteger(dot?.id));
  if (dotIds.some((id) => !Number.isFinite(id))) {
    return false;
  }

  const sortedDotIds = [...dotIds].sort((left, right) => left - right);
  return sortedDotIds[0] === 1 && sortedDotIds[sortedDotIds.length - 1] === level.dots.length;
}

function validateSeed(payload) {
  const levels = Array.isArray(payload.levels) ? payload.levels : [];
  const badLevelIds = [];
  const ids = new Set();

  for (const level of levels) {
    ids.add(level?.level_id);
    if (!validateLevel(level)) {
      badLevelIds.push(level?.level_id ?? "unknown");
    }
  }

  if (levels.length === 0 || badLevelIds.length > 0 || ids.size !== levels.length) {
    throw new Error(
      `Invalid Connect seed: levels=${levels.length}, uniqueIds=${ids.size}, badLevels=${badLevelIds.slice(0, 8).join(", ")}`
    );
  }

  return levels;
}

loadRootEnv();

const payloadJson = await readFile(seedPath, "utf8");
const payload = JSON.parse(payloadJson);
const levels = validateSeed(payload);
const checksum = createHash("sha256").update(payloadJson).digest("hex");
const variables = {
  id: storeId,
  payloadJson,
  totalLevels: levels.length,
  launchDate: typeof payload.launchDate === "string" ? payload.launchDate : null,
  checksum
};

const dc = getFirebaseDataConnect(connectorConfig);
const existing = await dc.executeGraphqlRead(GET_GAME_LEVEL_QUERY, {
  operationName: "GetGameLevelSeed",
  variables: {
    id: storeId
  }
});

if (existing.data?.gamesLevel) {
  await dc.executeGraphql(UPDATE_GAME_LEVEL_MUTATION, {
    operationName: "UpdateGameLevelSeed",
    variables
  });
  console.log(`Updated game level store '${storeId}' with ${levels.length} Connect levels (${checksum}).`);
} else {
  await dc.executeGraphql(CREATE_GAME_LEVEL_MUTATION, {
    operationName: "CreateGameLevelSeed",
    variables
  });
  console.log(`Created game level store '${storeId}' with ${levels.length} Connect levels (${checksum}).`);
}
