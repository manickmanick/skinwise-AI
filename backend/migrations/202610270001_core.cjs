exports.up = async function (knex) {
  await knex.schema.createTable("sessions", (t) => {
    t.string("session_id", 128).primary();
    t.bigInteger("expires_at").unsigned().notNullable();
    t.mediumtext("data").notNullable();
    t.index(["expires_at"]);
  });
  await knex.schema.createTable("users", (t) => {
    t.string("id", 36).primary();
    t.string("email", 254).notNullable().unique();
    t.string("password_hash", 100).notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("user_preferences", (t) => {
    t.string("user_id", 36)
      .primary()
      .references("users.id")
      .onDelete("CASCADE");
    t.string("timezone", 64).notNullable().defaultTo("UTC");
    t.string("city", 120).nullable();
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("skin_profiles", (t) => {
    t.string("user_id", 36)
      .primary()
      .references("users.id")
      .onDelete("CASCADE");
    t.string("skin_type", 24).notNullable();
    t.json("concerns").notNullable();
    t.json("allergies").notNullable();
    t.string("sensitivity", 24).notNullable();
    t.json("goals").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("skin_analyses", (t) => {
    t.string("id", 36).primary();
    t.string("user_id", 36)
      .nullable()
      .references("users.id")
      .onDelete("CASCADE");
    t.json("metrics").notNullable();
    t.timestamp("analyzed_at").notNullable().defaultTo(knex.fn.now());
    t.index(["user_id", "analyzed_at"]);
  });
  await knex.schema.createTable("routines", (t) => {
    t.string("id", 36).primary();
    t.string("user_id", 36)
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    t.integer("version").unsigned().notNullable();
    t.boolean("active").notNullable().defaultTo(true);
    t.json("generation_inputs").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.unique(["user_id", "version"]);
    t.index(["user_id", "active"]);
  });
  await knex.schema.createTable("routine_steps", (t) => {
    t.string("id", 36).primary();
    t.string("routine_id", 36)
      .notNullable()
      .references("routines.id")
      .onDelete("CASCADE");
    t.integer("position").unsigned().notNullable();
    t.enu("period", ["morning", "night"]).notNullable();
    t.string("title", 120).notNullable();
    t.text("instructions").notNullable();
    t.string("frequency", 80).notNullable();
    t.text("reason").notNullable();
    t.text("caution").nullable();
    t.unique(["routine_id", "period", "position"]);
    t.index(["routine_id"]);
  });
  await knex.schema.createTable("routine_days", (t) => {
    t.string("user_id", 36)
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    t.date("local_date").notNullable();
    t.string("routine_id", 36)
      .notNullable()
      .references("routines.id")
      .onDelete("CASCADE");
    t.integer("eligible_steps").unsigned().notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.primary(["user_id", "local_date"]);
    t.index(["user_id", "local_date"]);
  });
  await knex.schema.createTable("routine_completions", (t) => {
    t.string("user_id", 36)
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    t.string("step_id", 36)
      .notNullable()
      .references("routine_steps.id")
      .onDelete("CASCADE");
    t.date("local_date").notNullable();
    t.timestamp("completed_at").notNullable().defaultTo(knex.fn.now());
    t.primary(["user_id", "step_id", "local_date"]);
    t.index(["user_id", "local_date"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("routine_completions");
  await knex.schema.dropTableIfExists("routine_days");
  await knex.schema.dropTableIfExists("routine_steps");
  await knex.schema.dropTableIfExists("routines");
  await knex.schema.dropTableIfExists("skin_analyses");
  await knex.schema.dropTableIfExists("skin_profiles");
  await knex.schema.dropTableIfExists("user_preferences");
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("sessions");
};
