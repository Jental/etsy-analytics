const puppeteer = require('puppeteer');

const TAG = 'watercolour+bookmark';
const SEARCH_TERM = 'NinaFert';
const MAX_PAGE = 3;
const DELAY = 5 * 1000; // 5 sec

const findEntriesOnPage = async (page, pageNum) => {
  const url = `https://www.etsy.com/search?q=${TAG}&ref=pagination&page=${pageNum}`;
  await page.goto(url, { waitUntil: 'networkidle2' });

  //await page.screenshot({ path: './screenshot.jpg', type: 'jpeg' });

  const cardsData = await page.$$eval(
    '.v2-listing-card__info',
    (elements, { searchTerm, pageNum }) =>
      elements
      .map((el, i)  => [
        el.innerText,
        i,
        el.querySelector('h3').innerText
      ])
      .filter(([text, idx, title]) => text.indexOf(searchTerm) >= 0)
      .map(([text, idx, title]) => [title, pageNum, idx]),
    { searchTerm: SEARCH_TERM, pageNum: pageNum }
  );

  const pageData = await page.$$eval(
    '.search-pagination a.wt-btn span[aria-hidden="true"]',
    (elements) => elements.map(el => parseInt(el.innerText.trim())).filter(p => p)
  );

  return {
    cardsData,
    maxPage : Math.max(...pageData)
  };
};

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  let result = [];

  let pageNum = 1;
  let maxPage = null;
  while (!maxPage || pageNum <= maxPage) {
    const found = await findEntriesOnPage(page, pageNum);
    const cardsData = found.cardsData;
    const foundMaxPage = found.maxPage;
    // console.log(cardsData, foundMaxPage);

    if (cardsData.length > 0) {
      result = [...result, ...cardsData];
    }

    if (!maxPage && foundMaxPage) {
      maxPage = Math.min(foundMaxPage, MAX_PAGE);
    }
    else if (!maxPage) {
      maxPage = MAX_PAGE;
    }
    
    await new Promise((resolve, reject) => setTimeout(resolve, DELAY));

    pageNum = pageNum + 1;
  }

  console.log(result);

  await page.close();
  await browser.close();
})();
