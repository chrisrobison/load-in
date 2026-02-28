import { getDb } from "./client.js";

function main(): void {
  getDb();
  console.log("SQLite schema is ready.");
}

main();
