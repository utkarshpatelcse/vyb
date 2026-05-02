import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFirebaseDataConnect, loadRootEnv } from "../packages/config/src/index.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSeedPath = path.join(workspaceRoot, "data", "queens-levels.json");
const seedPath = path.resolve(process.argv[2] ?? process.env.VYB_QUEENS_LEVELS_PATH ?? defaultSeedPath);
const storeId = process.env.VYB_QUEENS_GAME_LEVEL_STORE_ID ?? process.env.VYB_QUEENS_LEVEL_STORE_ID ?? "queens-1000-levels";

const connectorConfig = {
  connector: "connect",
  serviceId: "vyb",
  location: "asia-south1"
};

const GET_GAME_LEVEL_QUERY = `
  query GetQueensGameLevelSeed($id: String!) {
    gamesLevel(key: { id: $id }) {
      id
      checksum
      totalLevels
      updatedAt
    }
  }
`;

const CREATE_GAME_LEVEL_MUTATION = `
  mutation CreateQueensGameLevelSeed(
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
  mutation UpdateQueensGameLevelSeed(
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

function coordinateKey(point) {
  return `${point.x}:${point.y}`;
}

function getRegionId(level, point) {
  return level.regions[point.x]?.[point.y] ?? 0;
}

function touches(left, right) {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y)) <= 1;
}

function validateLevel(level) {
  const levelId = normalizeInteger(level?.level_id);
  const gridSize = normalizeInteger(level?.grid_size);

  if (!Number.isFinite(levelId) || !Number.isFinite(gridSize) || gridSize < 4) {
    return false;
  }

  if (!Array.isArray(level.regions) || level.regions.length !== gridSize || !Array.isArray(level.solution)) {
    return false;
  }

  const regionIds = new Set();
  for (const row of level.regions) {
    if (!Array.isArray(row) || row.length !== gridSize) {
      return false;
    }

    for (const regionId of row) {
      const normalizedRegionId = normalizeInteger(regionId);
      if (!Number.isFinite(normalizedRegionId) || normalizedRegionId < 1 || normalizedRegionId > gridSize) {
        return false;
      }
      regionIds.add(normalizedRegionId);
    }
  }

  if (regionIds.size !== gridSize || level.solution.length !== gridSize) {
    return false;
  }

  const solution = [];
  const cells = new Set();
  const rows = new Set();
  const columns = new Set();
  const solutionRegions = new Set();

  for (const rawPoint of level.solution) {
    const point = normalizeCoordinate(rawPoint);
    if (!point || point.x < 0 || point.y < 0 || point.x >= gridSize || point.y >= gridSize) {
      return false;
    }

    const key = coordinateKey(point);
    if (cells.has(key)) {
      return false;
    }

    cells.add(key);
    rows.add(point.x);
    columns.add(point.y);
    solutionRegions.add(getRegionId(level, point));
    solution.push(point);
  }

  if (rows.size !== gridSize || columns.size !== gridSize || solutionRegions.size !== gridSize) {
    return false;
  }

  for (let leftIndex = 0; leftIndex < solution.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < solution.length; rightIndex += 1) {
      if (touches(solution[leftIndex], solution[rightIndex])) {
        return false;
      }
    }
  }

  return ["Intro", "Intermediate", "Advanced", "Pro"].includes(level.difficulty);
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

  if (levels.length !== 1000 || badLevelIds.length > 0 || ids.size !== levels.length) {
    throw new Error(
      `Invalid Queens seed: levels=${levels.length}, uniqueIds=${ids.size}, badLevels=${badLevelIds.slice(0, 8).join(", ")}`
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
  operationName: "GetQueensGameLevelSeed",
  variables: {
    id: storeId
  }
});

if (existing.data?.gamesLevel) {
  await dc.executeGraphql(UPDATE_GAME_LEVEL_MUTATION, {
    operationName: "UpdateQueensGameLevelSeed",
    variables
  });
  console.log(`Updated game level store '${storeId}' with ${levels.length} Queens levels (${checksum}).`);
} else {
  await dc.executeGraphql(CREATE_GAME_LEVEL_MUTATION, {
    operationName: "CreateQueensGameLevelSeed",
    variables
  });
  console.log(`Created game level store '${storeId}' with ${levels.length} Queens levels (${checksum}).`);
}
