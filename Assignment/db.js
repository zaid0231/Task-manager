const knex = require("knex");

const databaseUrl = process.env.DATABASE_URL;
const isPostgres = Boolean(databaseUrl && databaseUrl.startsWith("postgres"));

const db = knex({
  client: isPostgres ? "pg" : "sqlite3",
  connection: isPostgres
    ? {
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
      }
    : {
        filename: "./data/dev.db",
      },
  useNullAsDefault: true,
  pool: { min: 0, max: 10 },
});

async function ensureSchema() {
  if (!(await db.schema.hasTable("users"))) {
    await db.schema.createTable("users", (table) => {
      table.increments("id").primary();
      table.string("name").notNullable();
      table.string("email").notNullable().unique();
      table.string("password").notNullable();
      table.timestamp("created_at").defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable("projects"))) {
    await db.schema.createTable("projects", (table) => {
      table.increments("id").primary();
      table.string("name").notNullable();
      table.text("description");
      table
        .integer("owner_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.date("due_date");
      table.timestamp("created_at").defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable("project_members"))) {
    await db.schema.createTable("project_members", (table) => {
      table.increments("id").primary();
      table
        .integer("project_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("projects")
        .onDelete("CASCADE");
      table
        .integer("user_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.string("role").notNullable().defaultTo("Member");
      table.unique(["project_id", "user_id"]);
    });
  }

  if (!(await db.schema.hasTable("tasks"))) {
    await db.schema.createTable("tasks", (table) => {
      table.increments("id").primary();
      table
        .integer("project_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("projects")
        .onDelete("CASCADE");
      table.string("title").notNullable();
      table.text("description");
      table
        .integer("assigned_to")
        .unsigned()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.string("status").notNullable().defaultTo("todo");
      table.date("due_date");
      table.timestamp("completed_at");
      table.timestamp("created_at").defaultTo(db.fn.now());
    });
  } else if (!(await db.schema.hasColumn("tasks", "completed_at"))) {
    await db.schema.alterTable("tasks", (table) => {
      table.timestamp("completed_at");
    });
  }
}

module.exports = { db, ensureSchema };
