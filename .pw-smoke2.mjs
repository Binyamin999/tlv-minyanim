import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'he-IL' }); // no geolocation permission granted
const page = await context.newPage();
await page.goto('http://127.0.0.1:3100/he');
await page.getByRole('button', { name: 'מצאו מניין לידי' }).click();
await page.waitForTimeout(1500);
const text = await page.locator('.near-me').innerText();
console.log(JSON.stringify(text));
await browser.close();
