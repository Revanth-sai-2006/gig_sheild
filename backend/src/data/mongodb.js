import { MongoClient } from "mongodb";

let client;
let database;

const defaultPolicyCatalog = [
  {
    id: "P-WTH-001",
    name: "Weather Shield Basic",
    description: "Income support during moderate weather disruptions.",
    baseWeeklyPremium: 40,
    maxWeeklyCoverage: 500
  },
  {
    id: "P-WTH-002",
    name: "All-Risk Worker Plus",
    description: "Higher protection for risky jobs and unsafe zones.",
    baseWeeklyPremium: 60,
    maxWeeklyCoverage: 900
  },
  {
    id: "P-WTH-003",
    name: "Urban Mobility Guard",
    description: "Coverage against traffic and transit interruptions.",
    baseWeeklyPremium: 50,
    maxWeeklyCoverage: 700
  }
];

export function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function getDatabase() {
  if (!database) {
    throw new Error("Database is not initialized. Call connectToDatabase() first.");
  }

  return database;
}

export function getCollections() {
  const db = getDatabase();
  return {
    users: db.collection("users"),
    policyCatalog: db.collection("policyCatalog"),
    userPolicies: db.collection("userPolicies"),
    claims: db.collection("claims"),
    notifications: db.collection("notifications")
  };
}

async function ensureIndexesAndSeed() {
  const { users, policyCatalog, userPolicies, claims, notifications } = getCollections();

  await Promise.all([
    users.createIndex({ id: 1 }, { unique: true }),
    users.createIndex({ emailLower: 1 }, { unique: true }),
    policyCatalog.createIndex({ id: 1 }, { unique: true }),
    userPolicies.createIndex({ id: 1 }, { unique: true }),
    claims.createIndex({ id: 1 }, { unique: true }),
    notifications.createIndex({ id: 1 }, { unique: true })
  ]);

  const existingPolicies = await policyCatalog.countDocuments();
  if (existingPolicies === 0) {
    const seededPolicies = defaultPolicyCatalog.map((policy) => ({
      ...policy,
      createdAt: new Date().toISOString()
    }));

    await policyCatalog.insertMany(seededPolicies);
  }
}

export async function connectToDatabase() {
  if (database) {
    return database;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI in environment.");
  }

  if (mongoUri.includes("<db_username>") || mongoUri.includes("<db_password>")) {
    throw new Error("Replace <db_username> and <db_password> in MONGODB_URI before starting the server.");
  }

  const dbName = process.env.MONGODB_DB_NAME || "gigshield";
  client = new MongoClient(mongoUri);
  await client.connect();
  database = client.db(dbName);

  await ensureIndexesAndSeed();
  return database;
}
