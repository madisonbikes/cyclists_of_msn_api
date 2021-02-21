import "reflect-metadata";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TEST_MONGODB_DATABASE_NAME, TEST_MONGODB_SERVER_PORT } from "./setup";
import { logger } from "../utils";

let mongoServer;

// noinspection JSUnusedGlobalSymbols
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function mochaGlobalSetup() {
  mongoServer = new MongoMemoryServer({
    instance: {
      dbName: TEST_MONGODB_DATABASE_NAME,
      port: TEST_MONGODB_SERVER_PORT
    }
  });
  await mongoServer.start();
  const url = await mongoServer.getUri();
  logger.debug("connecting to test mongodb ", url)
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function mochaGlobalTeardown() {
  await mongoServer.stop();
}