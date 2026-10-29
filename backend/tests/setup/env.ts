// Runs in every test worker before test files are imported, so src/config/* read the test database URL.
import { useTestDatabase } from './test-db';

useTestDatabase();
