import { openDatabase, seedSamples } from "../src/db.js";

const db = await openDatabase();
const count = await seedSamples(db);

console.log(`seeded ${count} samples`);

