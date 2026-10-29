exports.up = async function (knex) {
  await knex.schema.createTable("password_reset_otps", (t) => {
    t.string("id", 36).primary();
    t.string("user_id", 36)
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    t.string("purpose", 32).notNullable().defaultTo("password_reset");
    t.string("otp_hash", 64).nullable();
    t.bigInteger("expires_at").unsigned().notNullable();
    t.integer("attempts").unsigned().notNullable().defaultTo(0);
    t.bigInteger("last_sent_at").unsigned().notNullable();
    t.bigInteger("verified_at").unsigned().nullable();
    t.string("reset_token_hash", 64).nullable();
    t.bigInteger("reset_expires_at").unsigned().nullable();
    t.bigInteger("used_at").unsigned().nullable();
    t.index(["user_id", "expires_at"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("password_reset_otps");
};
