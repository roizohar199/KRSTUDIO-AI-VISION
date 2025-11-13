# 🚀 הוראות פריסה - KRSTUDIO AI VISION

## סקירה כללית

הפרויקט כולל:
- **React Client** - רץ תחת `/ltx/video/` ב-NGINX
- **Node.js Server** - רץ על פורט 4100, נגיש דרך `/api/ltx/`
- **RunPod Python Server** - רץ על RunPod, נגיש דרך `/runpod/`

---

## 1. בניית React Client

```bash
cd client
npm install
npm run build
```

הבנייה תיצור תיקייה `dist/` שצריכה להיות בנתיב:
```
/var/www/KRSTUDIO-AI-VISION/client/dist
```

---

## 2. הגדרת Node.js Server

### א. התקנת תלויות
```bash
cd server
npm install
```

### ב. הגדרת משתני סביבה
צור קובץ `.env` בתיקיית `server/`:
```env
PORT=4100
CLIENT_ORIGIN=https://k-rstudio.com
RUNPOD_LTX_BASE_URL=https://rmo5wr1h48d38t-8000.proxy.runpod.net
```

### ג. הפעלת השרת
```bash
# Development
npm run dev

# Production (עם PM2)
pm2 start server/src/index.js --name k-rstudio-ltx
```

---

## 3. הגדרת NGINX

### א. הוסף את הבלוקים הבאים לקובץ התצורה שלך:
`/etc/nginx/sites-available/k-rstudio.com`

ראה את הקובץ `nginx-k-rstudio.conf` לדוגמה מלאה.

### ב. בדיקת תצורה ורילוד:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. מבנה הנתיבים

| נתיב | יעד | תיאור |
|------|-----|-------|
| `/ltx/video/` | React Build | האפליקציה הראשית |
| `/api/ltx/` | Node.js (port 4100) | API ליצירת וידאו |
| `/runpod/` | RunPod Server | גישה ישירה ל-RunPod |

---

## 5. CORS Configuration

השרת Node.js מוגדר לקבל בקשות מ:
- Development: `http://localhost:5174`
- Production: `https://k-rstudio.com` (או הדומיין שלך)

עדכן את `CLIENT_ORIGIN` בקובץ `.env` בהתאם.

---

## 6. Image Conditioning

המערכת תומכת כעת בהעלאת תמונות כ-Image Conditioning:
- המשתמש מעלה תמונה דרך ה-UI
- התמונה נשלחת כ-base64 לשרת Node
- השרת מעביר את התמונה ל-RunPod Python
- RunPod משתמש בתמונה ליצירת וידאו עם סגנון אחיד

---

## 7. בדיקות

### בדיקת React (Development):
```bash
cd client
npm run dev
# פתח http://localhost:5174
```

### בדיקת Node Server:
```bash
cd server
node src/index.js
# בדוק http://localhost:4100/api/ltx/history
```

### בדיקת Production:
1. בנה את React: `cd client && npm run build`
2. העתק את `dist/` לשרת
3. הפעל את Node server
4. בדוק את NGINX config
5. פתח `https://k-rstudio.com/ltx/video/`

---

## 8. Troubleshooting

### React לא נטען:
- בדוק ש-`base: "/ltx/video/"` ב-`vite.config.js`
- בדוק ש-NGINX מפנה נכון ל-`dist/`

### API לא עובד:
- בדוק ש-Node server רץ על פורט 4100
- בדוק CORS settings
- בדוק ש-NGINX proxy_pass נכון

### תמונות לא נשלחות:
- בדוק ש-`express.json({ limit: "50mb" })` מוגדר
- בדוק את ה-console לראות שגיאות

---

## 9. Environment Variables

### Client (.env או Vite):
```env
VITE_API_BASE_URL=  # ריק ב-production (משתמש ב-relative path)
```

### Server (.env):
```env
PORT=4100
CLIENT_ORIGIN=https://k-rstudio.com
RUNPOD_LTX_BASE_URL=https://rmo5wr1h48d38t-8000.proxy.runpod.net
```

---

## 10. Production Checklist

- [ ] React build הושלם בהצלחה
- [ ] `dist/` הועתק לשרת ב-`/var/www/KRSTUDIO-AI-VISION/client/dist`
- [ ] Node server רץ על פורט 4100
- [ ] NGINX config עודכן ונבדק
- [ ] CORS מוגדר נכון
- [ ] משתני סביבה מוגדרים
- [ ] RunPod URL נכון
- [ ] בדיקת כל הנתיבים עובדים

---

**בהצלחה! 🎉**

