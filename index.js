const puppeteer = require('puppeteer');
const fs = require('fs');
const util = require('util');
const _ = require('lodash');
const moment = require('moment');

const TAGS = [ 'watercolour+bookmark', 'watercolor+bookmark', 'sea+bookmark', 'ocean+bookmark', 'lemon+bookmark' ];
const SEARCH_TERM = 'NinaFert';
const MAX_PAGE = 50;
const DELAY = 5 * 1000; // 5 sec
const DATA_DIR = 'data';
const INTERVAL = 3 * 60 * 60 * 1000; // 3 hours
// const INTERVAL = 10 * 60 * 1000; // 5 min, will be multipled on number of tags

const appendFile = util.promisify(fs.appendFile);
const readDir = util.promisify(fs.readdir);

const findEntriesOnPage = async (page, tag, pageNum) => {
  const url = `https://www.etsy.com/search?q=${tag}&ref=pagination&page=${pageNum}`;
  await page.goto(url, { waitUntil: 'networkidle2' });

  // await page.screenshot({ path: './screenshot.jpg', type: 'jpeg' });

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

const getEntriesForTag = async (browser, tag) => {
  const page = await browser.newPage();

  let result = [];

  let pageNum = 1;
  let maxPage = null;
  while (!maxPage || pageNum <= maxPage) {
    const found = await findEntriesOnPage(page, tag, pageNum);
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

  await page.close();

  return result;
};

const saveEntriesToFile = async (fileName, tag, entries) => {
  const filePath = `${DATA_DIR}/${fileName}`;
  const data = {
    timestamp: Date.now(),
    tag: tag,
    pages: MAX_PAGE,
    entries: entries
  };
  await appendFile(filePath, JSON.stringify(data) + ',\n');
};

const getAllTags = async () => {
  const files = await readDir(DATA_DIR);
  const existingTags = files.filter(f => f.endsWith('.dat')).map(f => f.substr(0, f.length - 4));

  return _.uniq(existingTags.concat(TAGS));
};

const isServiceMode = process.argv.indexOf('--service') >= 0;

(async () => {
  const tags = await getAllTags();
  const interval2 = INTERVAL;// * tags.length;

  console.log('tags:', tags);
  console.log('Interval:', interval2 / 1000 / 60, 'min');

  const job = async () => {
    const browser = await puppeteer.launch();
    for (let tag of tags) {
      console.log(moment().format(), tag);
      const result = await getEntriesForTag(browser, tag);
      await saveEntriesToFile(`${tag}.dat`, tag, result);
      // console.log(result);
    }
    await browser.close();
  };
  if (isServiceMode) {
    setInterval(() => {
      console.log(moment().format(), 'started');
      job()
        .then(() => {
          console.log(moment().format(), 'done');
        })
        .catch(err => {
          console.error(moment().format(), 'err', err);
        });
    }, interval2);
    job()
      .then(() => {
        console.log(moment().format(), 'done');
      })
      .catch(err => {
        console.error(moment().format(), 'err', err);
      });
  }
  else {
    await job();
  }
})();
