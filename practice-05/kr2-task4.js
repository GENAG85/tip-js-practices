import { createApiClient } from "./src/api-client.js";
import { createTaskApi } from "./src/task-api.js";

const client = createApiClient({
  baseUrl: "http://127.0.0.1:5505/api",
  timeoutMs: 2000,
});

const api = createTaskApi(client);

try {
  await api.getTaskById(999);
} catch (error) {
  console.log("kind:", error.kind);
  console.log("status:", error.status);
}