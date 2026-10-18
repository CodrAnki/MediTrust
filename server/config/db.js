import mongoose from "mongoose";
import { env } from "./env.js";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
mongoose.set("strictQuery", true);

export async function connectDB() {
  if (!env.mongoUri) {
    // eslint-disable-next-line no-console
    console.error(
      "\nMissing MONGO_URI.\n" +
        "Set MONGO_URI in server/.env to a MongoDB connection string, e.g.\n" +
        "  MONGO_URI=mongodb://127.0.0.1:27017/mediTrust        (local MongoDB)\n" +
        "  MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/mediTrust  (Atlas)\n",
    );
    process.exit(1);
  }
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });
    // eslint-disable-next-line no-console
    console.log(
      `MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("\nCould not connect to MongoDB.");
    // eslint-disable-next-line no-console
    console.error(`Reason: ${err.message}`);
    // eslint-disable-next-line no-console
    console.error(
      "Check that MONGO_URI in server/.env is correct and that the database is reachable " +
        "(a local mongod is running, or your Atlas IP allowlist includes this machine).\n",
    );
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    // eslint-disable-next-line no-console
    console.warn("MongoDB disconnected.");
  });
}
