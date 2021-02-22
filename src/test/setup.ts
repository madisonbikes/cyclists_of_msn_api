import "reflect-metadata";
import { DEFAULT_SERVER_PORT, ServerConfiguration } from "../config";
import axios from "axios";
import winston from "winston";
import { MongoMemoryServer } from "mongodb-memory-server";
import { container as rootContainer, DependencyContainer, injectable, Lifecycle } from "tsyringe";
import path from "path";
import { Database } from "../database";
import assert from "assert";

// no logging for tests
winston.remove(winston.transports.Console);
winston.remove(winston.transports.File);

// preset axios
// FIXME get rid of axios and use supertest
axios.defaults.baseURL = `http://localhost:${DEFAULT_SERVER_PORT}`;

let mongoUri: string;
let mongoServer: MongoMemoryServer | undefined;

// the test container is initialized once for the suite
let tc: DependencyContainer | undefined;

export type SuiteOptions = {
  // spin up a memory mongodb instance for testing purposes
  withDatabase: boolean
}

/** entry point that should be included first in each describe block */
export function setupSuite(options: Partial<SuiteOptions> = {}): void {
  beforeAll(async () => {
    assert(tc == undefined);
    tc = await initializeSuite(options);

    await createDatabaseConnection();
  });

  afterAll(async () => {
    assert(tc);

    await clearDatabaseConnection();
    await cleanupSuite();
    tc = undefined;
  });
}

/**
 * Callers that make modifications to the container should do so in a CHILD container because the container is not reset
 * between tests
 */
export function testContainer(): DependencyContainer {
  assert(tc);
  return tc;
}

/** return the object managing the connection to the mongodb instance */
export function testDatabase(): Database {
  return testContainer().resolve(Database);
}

async function initializeSuite(options: Partial<SuiteOptions>): Promise<DependencyContainer> {
  const withDatabase = options.withDatabase;
  if (withDatabase) {
    mongoServer = new MongoMemoryServer();
    mongoUri = await mongoServer.getUri();
  }

  // don't use value registrations because they will be cleared in the beforeEach() handler
  const testContainer = rootContainer.createChildContainer();
  testContainer.register<ServerConfiguration>(ServerConfiguration,
    { useClass: TestConfiguration },
    { lifecycle: Lifecycle.ContainerScoped });
  if (withDatabase) {
    testContainer.register<Database>(Database,
      { useClass: Database },
      { lifecycle: Lifecycle.ContainerScoped });
  } else {
    testContainer.register<Database>(Database,
      {
        useFactory: () => {
          throw new Error("No database allowed for this test suite");
        }
      });
  }
  return testContainer;
}

async function cleanupSuite(): Promise<void> {
  await mongoServer?.stop();
  mongoServer = undefined;
}

@injectable()
class TestConfiguration extends ServerConfiguration {
  constructor() {
    super();

    this.photosDir = path.resolve(
      __dirname,
      "../../test_resources");
    this.mongodbUri = mongoUri;
  }
}

async function clearDatabaseConnection() {
  assert(tc);

  const database = tc.resolve(Database);
  await database.disconnect();
}

async function createDatabaseConnection() {
  assert(tc);
  const database = tc.resolve(Database);
  await database.connect();
}

