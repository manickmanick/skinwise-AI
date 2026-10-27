require("dotenv").config();
const common = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "skinwise_ai",
    charset: "utf8mb4",
    timezone: "Z",
  },
  pool: { min: 0, max: 10 },
  migrations: {
    directory: "./migrations",
    extension: "cjs",
    tableName: "knex_migrations",
  },
};
module.exports = { development: common, production: common };
