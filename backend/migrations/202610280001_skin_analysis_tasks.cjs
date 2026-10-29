exports.up = async function (knex) {
  await knex.schema.createTable("skin_analysis_tasks", (t) => {
    t.string("id", 36).primary();

    t.string("user_id", 36)
      .nullable()
      .references("users.id")
      .onDelete("SET NULL");

    t.string("session_id", 128).notNullable();

    t.string("provider_task_id", 255).nullable();

    t.enu("status", ["pending", "processing", "success", "failed", "timed_out"])
      .notNullable()
      .defaultTo("pending");

    t.json("image_metadata").nullable();
    t.json("metrics").nullable();

    t.string("error_code", 100).nullable();
    t.string("error_message", 500).nullable();

    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("completed_at").nullable();

    t.index(["session_id", "created_at"]);
    t.index(["status", "created_at"]);
    t.index(["user_id", "created_at"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("skin_analysis_tasks");
};
