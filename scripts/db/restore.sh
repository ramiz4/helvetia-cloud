#!/bin/bash

# Load environment variables from packages/database/.env
if [ -f "packages/database/.env" ]; then
    export $(grep -v '^#' packages/database/.env | xargs)
else
    echo "Error: packages/database/.env not found."
    exit 1
fi

# Extract credentials from DATABASE_URL
# Format: postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=...
# This regex is simplified for the specific known format
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\).*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\).*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

BACKUP_DIR="backups/db"

if [ -z "$1" ]; then
    # Find latest backup
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/helvetia_*.sql 2>/dev/null | head -n 1)
    if [ -z "$BACKUP_FILE" ]; then
        echo "No backup file found in $BACKUP_DIR"
        exit 1
    fi
else
    BACKUP_FILE="$1"
fi

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file '$BACKUP_FILE' not found."
    exit 1
fi

echo "Restoring from backup: $BACKUP_FILE"
echo "Target Database: $DB_NAME at $DB_HOST:$DB_PORT"
echo "Active User: $DB_USER"

read -p "WARNING: This will overwrite the current database. Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 1
fi

# Set PGPASSWORD environment variable to avoid password prompt
export PGPASSWORD=$DB_PASS

# Drop and recreate public schema to ensure clean slate
echo "Cleaning existing database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Restoring data..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Restore successful!"
else
    echo "Restore failed!"
    exit 1
fi

unset PGPASSWORD
