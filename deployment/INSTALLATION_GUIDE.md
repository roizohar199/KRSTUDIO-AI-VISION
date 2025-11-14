# 🚀 מדריך התקנה מפורט - KRSTUDIO AI VISION

מדריך זה מסביר שלב אחר שלב איך להפעיל את כל הקבצים שיצרנו.

---

## 📋 לפני שמתחילים

**חשוב:** כל הפקודות הבאות צריך להריץ ב-**SSH על השרת שלך** (לא במחשב המקומי).

---

## 1️⃣ התקנת Nginx Configuration

### מה זה עושה?
מגדיר את Nginx (שרת האינטרנט) להפנות בקשות לשרת Node.js שלך.

### שלבים:

**שלב 1:** התחבר ל-SSH לשרת שלך

**שלב 2:** עבור לתיקיית הפרויקט:
```bash
cd /var/www/KRSTUDIO-AI-VISION
```

**שלב 3:** העתק את קובץ התצורה של Nginx:
```bash
sudo cp deployment/nginx/krstudio-ai-vision.conf /etc/nginx/sites-available/krstudio-ai-vision
```

**שלב 4:** צור קישור סמלי (symlink):
```bash
sudo ln -s /etc/nginx/sites-available/krstudio-ai-vision /etc/nginx/sites-enabled/
```

**שלב 5:** בדוק שהתצורה תקינה:
```bash
sudo nginx -t
```
אם אתה רואה `syntax is ok` ו-`test is successful` - הכל תקין!

**שלב 6:** טען מחדש את Nginx:
```bash
sudo systemctl reload nginx
```

**⚠️ חשוב:** לפני שתעשה את זה, פתח את הקובץ ועדכן:
```bash
sudo nano /etc/nginx/sites-available/krstudio-ai-vision
```
חפש את השורה:
```
proxy_pass https://<YOUR-RUNPOD-ENDPOINT-HERE>/;
```
והחלף את `<YOUR-RUNPOD-ENDPOINT-HERE>` בכתובת ה-RunPod האמיתית שלך.

---

## 2️⃣ התקנת PM2 Log Rotation

### מה זה עושה?
מגביל את גודל קבצי הלוגים של PM2 כדי שלא יתפוסו יותר מדי מקום בדיסק.

### שלבים:

**שלב 1:** התקן את מודול הרוטציה:
```bash
pm2 install pm2-logrotate
```

**שלב 2:** הגדר את הגודל המקסימלי של כל קובץ לוג (10MB):
```bash
pm2 set pm2-logrotate:max_size 10M
```

**שלב 3:** שמור 7 ימים של לוגים ישנים:
```bash
pm2 set pm2-logrotate:retain 7
```

**שלב 4:** הגדר רוטציה יומית בחצות:
```bash
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

**שלב 5:** הפעל דחיסה של לוגים ישנים:
```bash
pm2 set pm2-logrotate:compress true
```

**שלב 6:** בדוק שהכל הוגדר נכון:
```bash
pm2 conf pm2-logrotate
```

---

## 3️⃣ התקנת סקריפט גיבוי מסד הנתונים

### מה זה עושה?
יוצר גיבוי יומי של מסד הנתונים שלך (אם יש לך SQLite או מסד נתונים אחר).

### שלבים:

**שלב 1:** העתק את הסקריפט:
```bash
sudo cp /var/www/KRSTUDIO-AI-VISION/deployment/scripts/backup-krstudio-db.sh /usr/local/bin/backup-krstudio-db.sh
```

**שלב 2:** תן הרשאות הרצה לסקריפט:
```bash
sudo chmod +x /usr/local/bin/backup-krstudio-db.sh
```

**שלב 3:** בדוק איפה מסד הנתונים שלך נמצא, ועדכן את הסקריפט אם צריך:
```bash
sudo nano /usr/local/bin/backup-krstudio-db.sh
```
חפש את השורה:
```bash
SRC_DB="/var/www/KRSTUDIO-AI-VISION/server/database.sqlite"
```
והחלף בנתיב הנכון למסד הנתונים שלך.

**שלב 4:** הוסף את הסקריפט ל-crontab (מערכת הפעלה אוטומטית):
```bash
crontab -e
```

**שלב 5:** כשתיפתח עורך הטקסט, הוסף את השורה הבאה בסוף הקובץ:
```
0 3 * * * /usr/local/bin/backup-krstudio-db.sh >/dev/null 2>&1
```
זה אומר: "הרץ את הסקריפט כל יום ב-03:00 בלילה"

**שלב 6:** שמור וסגור (בננו: `Ctrl+X`, אחר כך `Y`, אחר כך `Enter`)

---

## 4️⃣ התקנת סקריפט גיבוי קוד

### מה זה עושה?
יוצר גיבוי יומי של כל הקוד שלך (server + client).

### שלבים:

**שלב 1:** העתק את הסקריפט:
```bash
sudo cp /var/www/KRSTUDIO-AI-VISION/deployment/scripts/backup-krstudio-code.sh /usr/local/bin/backup-krstudio-code.sh
```

**שלב 2:** תן הרשאות הרצה לסקריפט:
```bash
sudo chmod +x /usr/local/bin/backup-krstudio-code.sh
```

**שלב 3:** הוסף את הסקריפט ל-crontab:
```bash
crontab -e
```

**שלב 4:** הוסף את השורה הבאה (אם כבר יש לך שורה של גיבוי DB, הוסף את זו אחריה):
```
30 3 * * * /usr/local/bin/backup-krstudio-code.sh >/dev/null 2>&1
```
זה אומר: "הרץ את הסקריפט כל יום ב-03:30 בלילה" (חצי שעה אחרי גיבוי ה-DB)

**שלב 5:** שמור וסגור

---

## 5️⃣ בדיקה שהכל עובד

### בדוק את Nginx:
```bash
sudo systemctl status nginx
```

### בדוק את PM2:
```bash
pm2 status
```

### בדוק את הגיבויים (אחרי יום):
```bash
ls -lh /var/backups/krstudio-ai-vision/db/
ls -lh /var/backups/krstudio-ai-vision/code/
```

---

## ❓ שאלות נפוצות

**Q: איפה נמצאים הגיבויים?**
A: בתיקיות:
- מסד נתונים: `/var/backups/krstudio-ai-vision/db/`
- קוד: `/var/backups/krstudio-ai-vision/code/`

**Q: איך למחוק גיבוי ישן ידנית?**
A:
```bash
sudo rm /var/backups/krstudio-ai-vision/db/database_2024-01-01_03-00.sqlite
```

**Q: איך לראות מה יש ב-crontab?**
A:
```bash
crontab -l
```

**Q: איך להסיר משימה מ-crontab?**
A:
```bash
crontab -e
```
ואז מחק את השורה שאתה לא רוצה.

---

## ✅ סיכום - רשימת פקודות מהירה

אם אתה רוצה להריץ הכל בבת אחת (אחרי שבדקת את הנתיבים):

# Nginx
cd /var/www/KRSTUDIO-AI-VISION
sudo cp deployment/nginx/krstudio-ai-vision.conf /etc/nginx/sites-available/krstudio-ai-vision
sudo ln -s /etc/nginx/sites-available/krstudio-ai-vision /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# PM2 Log Rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
pm2 set pm2-logrotate:compress true

# Backup Scripts
sudo cp deployment/scripts/backup-krstudio-db.sh /usr/local/bin/backup-krstudio-db.sh
sudo cp deployment/scripts/backup-krstudio-code.sh /usr/local/bin/backup-krstudio-code.sh
sudo chmod +x /usr/local/bin/backup-krstudio-*.sh

# Crontab (תצטרך לערוך ידנית)
crontab -e
# הוסף:
# 0 3 * * * /usr/local/bin/backup-krstudio-db.sh >/dev/null 2>&1
# 30 3 * * * /usr/local/bin/backup-krstudio-code.sh >/dev/null 2>&1
```

