אמולטור Firebase מקומי לבדיקת חוקים ומשחקים חדשים בלי לגעת בייצור.

  cd tools/fb-emu && npx -y firebase-tools@13 emulators:start --only database --project beitardle

בדפדפן/אפליקציה: localStorage.setItem("sportdel:fbEmu","localhost:9000") (באמולטור אנדרואיד: 10.0.2.2:9000).
database.rules.json נגזר מ-config/firebase-rules.json (בלי מפתחות _).
