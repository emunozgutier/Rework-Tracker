const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  // Wait for the projects to load
  await page.waitForSelector('.project-card');
  // Click on "Maple" project
  const projectCards = await page.$$('.project-card');
  for (let card of projectCards) {
    const text = await page.evaluate(el => el.textContent, card);
    if (text.includes('Maple')) {
      await card.click();
      break;
    }
  }
  // Wait for expanded body
  await page.waitForTimeout(1000);
  const html = await page.content();
  console.log(html);
  await browser.close();
})();
