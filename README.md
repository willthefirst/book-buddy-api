# Book Buddy API

## Migrations

https://github.com/balmasi/migrate-mongoose

Examples:

### Create a migration
node_modules/.bin/migrate create add_users_2 --config config/migrate.json

### Remove extraneous migrations (for cleanup after removing them from /migrations)
node_modules/.bin/migrate prune --config config/migrate.json

### List migrations
node_modules/.bin/migrate list --config config/migrate.json

### Running migration
node_modules/.bin/migrate --config config/migrate.json up <migration_name>

A slight weirdness here: first run the migration, then update the model in /models.js

## Daily date format

Dailies are stored as strings in MongoDB in a timezone agnostic format: YYYY-MM-DD
