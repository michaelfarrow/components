require('dotenv').config();

const { GoogleSpreadsheet } = require('google-spreadsheet');
const pEachSeries = require('p-each-series');
const fs = require('fs-extra');

const doc = new GoogleSpreadsheet(
  '1oOCwb1pybm2RI6DSiBEv8W0xA06XPEoygVb6PnAuSno'
);

const links = {};

function slugify(str) {
  return str
    .toString()
    .toLowerCase()
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

function isDriveLink(str) {
  return !!(str && str.match(/^https:\/\/drive.google.com\/file/));
}

async function auth() {
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/gm, '\n'),
  });
}

async function loadInfo() {
  await doc.loadInfo();
}

async function processSheet(sheet) {
  const rows = await sheet.getRows();
  console.log(`Processing sheet: ${sheet.title}`);
  rows.forEach((row) => {
    const id = row._rawData[0];
    row._rawData.forEach((cell) => {
      const driveLink = isDriveLink(cell);
      if (driveLink) {
        if (!id || !id.length) {
          console.log(`no id for url ${cell}`);
          process.exit(1);
        }
        const slug = slugify(id);
        if (links[slug]) {
          console.log(`duplicate id: ${slug}`);
          process.exit(1);
        }
        links[slug] = cell;
      }
    });
  });
}

function processSheets() {
  return pEachSeries(doc.sheetsByIndex, processSheet);
}

function saveLinks() {
  return fs.outputJSON('./links.json', links, { spaces: 2 });
}

auth().then(loadInfo).then(processSheets).then(saveLinks);
