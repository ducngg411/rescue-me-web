const fs = require('fs');

const pngPath = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\36e54c73-db7c-462a-bab0-3003d7cd31c9\\car_logistics_bg_1772265728992.png';
const svgPath = 'c:\\rescue-me-web\\rescue-me-web\\frontend\\public\\illustration_background_car.svg';

const imageBuffer = fs.readFileSync(pngPath);
const base64Image = imageBuffer.toString('base64');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="2088" viewBox="0 0 2088 1128" height="1128" preserveAspectRatio="xMidYMid slice" version="1.0">
  <image x="0" y="0" width="2088" height="1128" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/png;base64,${base64Image}" />
</svg>`;

fs.writeFileSync(svgPath, svgContent);
console.log('SVG created at ' + svgPath);
