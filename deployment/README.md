# KRSTUDIO AI VISION - Deployment Instructions

## 1. Nginx Configuration

הקובץ `nginx/krstudio-ai-vision.conf` צריך להיות מועתק ל:
```bash
sudo cp deployment/nginx/krstudio-ai-vision.conf /etc/nginx/sites-available/krstudio-ai-vision
sudo ln -s /etc/nginx/sites-available/krstudio-ai-vision /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**חשוב:** עדכן את `<YOUR-RUNPOD-ENDPOINT-HERE>` בנתיב `/runpod/generate` עם כתובת ה-RunPod שלך.

## 2. PM2 Log Rotation

הרץ את הפקודות הבאות ב-SSH:

```bash
# התקנת מודול הרוטציה
pm2 install pm2-logrotate

# הגדרות מומלצות
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
pm2 set pm2-logrotate:compress true

# לבדוק שהכל רשום
pm2 conf pm2-logrotate
```

## 3. Database Backup Script

העתק את הסקריפט:
```bash
sudo cp deployment/scripts/backup-krstudio-db.sh /usr/local/bin/backup-krstudio-db.sh
sudo chmod +x /usr/local/bin/backup-krstudio-db.sh
```

**חשוב:** עדכן את הנתיב `SRC_DB` בקובץ אם מסד הנתונים שלך נמצא במקום אחר.

הוסף ל-crontab:
```bash
crontab -e
```

הוסף את השורה:
```
0 3 * * * /usr/local/bin/backup-krstudio-db.sh >/dev/null 2>&1
```

## 4. Code Backup Script

העתק את הסקריפט:
```bash
sudo cp deployment/scripts/backup-krstudio-code.sh /usr/local/bin/backup-krstudio-code.sh
sudo chmod +x /usr/local/bin/backup-krstudio-code.sh
```

הוסף ל-crontab:
```bash
crontab -e
```

הוסף את השורה:
```
30 3 * * * /usr/local/bin/backup-krstudio-code.sh >/dev/null 2>&1
```

## 5. Environment Variables

ודא שיש לך בקובץ `.env`:
```
PORT=4100
LTX_SERVER=https://your-runpod-endpoint.com
SDXL_SERVER=https://your-sdxl-server.com (אופציונלי)
API_KEYS=key1,key2,key3 (אופציונלי - ללקוחות חיצוניים)
```

