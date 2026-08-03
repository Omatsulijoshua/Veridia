import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig, env } from "prisma/config";

// Resolve the path to the root .env file
config({ path: resolve(__dirname, "../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
