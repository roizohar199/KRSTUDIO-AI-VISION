#!/bin/bash
BACKUP_DIR="/var/backups/krstudio-ai-vision/code"
SRC_DIR="/var/www/KRSTUDIO-AI-VISION"

DATE=$(date +"%Y-%m-%d_%H-%M")
mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/krstudio-code_$DATE.tar.gz" -C "$SRC_DIR" .

# מחיקת גיבויים בני יותר מ-14 ימים
find "$BACKUP_DIR" -type f -name "krstudio-code_*.tar.gz" -mtime +14 -delete

