# KRSTUDIO AI VISION – LTX flow

1. ה-frontend קורא לכתובת `https://k-rstudio.com/api/generate-video`.
2. ה-VPS (`server.js`) מבצע proxy לשרת ה-GPU שמוגדר במשתנה `LTX_SERVER`.
3. שרת ה-GPU מריץ את LTX ומחזיר JSON עם המפתח `video` ובו מחרוזת base64 (לדוגמה: `data:video/mp4;base64,...`).
4. ה-frontend מציג את הווידאו למשתמש.

להחלפת שרת GPU יש לעדכן את `LTX_SERVER` בקובץ `.env` שעל ה-VPS ולהריץ:

```
pm2 restart krstudio-ai-vision --update-env
```

