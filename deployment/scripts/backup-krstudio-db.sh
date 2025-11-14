#!/bin/bash
BACKUP_DIR="/var/backups/krstudio-ai-vision/db"
SRC_DB="/var/www/KRSTUDIO-AI-VISION/server/database.sqlite"  # עדכן אם צריך

DATE=$(date +"%Y-%m-%d_%H-%M")
mkdir -p "$BACKUP_DIR"

cp "$SRC_DB" "$BACKUP_DIR/database_$DATE.sqlite"

# מחיקת גיבויים בני יותר מ-14 ימים
find "$BACKUP_DIR" -type f -name "database_*.sqlite" -mtime +14 -delete

