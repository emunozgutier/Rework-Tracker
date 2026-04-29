const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 1000));
  const projectCards = await page.$$('.project-card');
  for (let card of projectCards) {
    const text = await page.evaluate(el => el.textContent, card);
    if (text.includes('Maple')) {
      await card.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));
  const html = await page.evaluate(() => document.body.innerText);
  console.log(html);
  await browser.close();
})();
