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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/helvetia_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating backup of database '$DB_NAME'..."
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USER"
echo "File: $BACKUP_FILE"

# Set PGPASSWORD environment variable to avoid password prompt
export PGPASSWORD=$DB_PASS

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F p -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup successful: $BACKUP_FILE"
    # Keep only the last 5 backups
    ls -t "$BACKUP_DIR"/helvetia_*.sql | tail -n +6 | xargs -I {} rm -- {}
else
    echo "Backup failed!"
    exit 1
fi

unset PGPASSWORD
