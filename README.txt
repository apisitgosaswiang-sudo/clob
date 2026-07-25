CLOB RC2 Boot Recovery — Changed Files Only

Replace only these files in the existing clob-main(2) project:
1. index.html
2. js/app.js
3. sw.js

Keep the same folder paths. Do not upload this folder as an extra nested directory.
After replacing the files, clear the website cache / remove the old PWA icon, then open the site once in Safari.

Base used: clob-main(2).zip
Purpose: prevent the app from staying on a blank screen while Firebase/Auth initialization is pending or fails.
