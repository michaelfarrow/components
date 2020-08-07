require('dotenv').config();

const { GoogleSpreadsheet } = require('google-spreadsheet');
const pEachSeries = require('p-each-series');
const fs = require('fs-extra');
const slugify = require('./lib/slugify');

const doc = new GoogleSpreadsheet(
  '1oOCwb1pybm2RI6DSiBEv8W0xA06XPEoygVb6PnAuSno'
);

const links = {};
const componentCats = [];

function isDriveLink(str) {
  return !!(str && str.match(/^https:\/\/drive\.google\.com\/file\/d\/[^\/]+/));
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
  // await sheet.loadCells();
  const headers = sheet.headerValues;
  console.log('');
  console.log(`Processing sheet: ${sheet.title}`);
  const components = [];
  rows.forEach((row) => {
    // console.log(row.rowNumber);
    const id = row._rawData[0];
    const slug = slugify(id);
    const filledCells = row._rawData.filter(
      (cell) => cell && String(cell).length
    );
    let quantity = 0;
    let datasheet = undefined;
    let datasheetPreview = undefined;
    if (filledCells.length) {
      const fields = [];
      for (let i = 1; i < headers.length; i++) {
        const header = headers[i];
        if (header && String(header).trim().length) {
          const fieldVal = row._rawData[i];
          if (fieldVal && String(fieldVal).trim().length) {
            const headerNormalised = String(header).trim();
            switch (headerNormalised.toLowerCase()) {
              case 'datasheet':
                datasheet = String(fieldVal).trim();
                datasheetPreview = `https://drive.google.com/file/d/${
                  datasheet.match(
                    /^https:\/\/drive\.google\.com\/file\/d\/([^\/]+)/
                  )[1]
                }/preview`;
                break;
              case 'quantity':
                quantity = Number(fieldVal);
                break;
              default:
                const headerUnit = headerNormalised.match(
                  /(.+)\s*\(\s*(.+)\s*\)$/
                );
                let processedFieldVal = String(fieldVal).trim();
                if (processedFieldVal.match(/^\d+\.\d+$/)) {
                  processedFieldVal = processedFieldVal
                    .replace(/0+$/, '')
                    .replace(/^(\d+)\.$/, '$1');
                }
                fields.push({
                  label: headerUnit ? headerUnit[1].trim() : headerNormalised,
                  value: headerUnit
                    ? `${processedFieldVal}${headerUnit[2]}`
                    : processedFieldVal,
                });
            }
          }
        }
      }
      components.push({
        id,
        slug,
        quantity,
        datasheet,
        datasheetPreview,
        fields,
      });
      row._rawData.forEach((cell) => {
        const driveLink = isDriveLink(cell);
        if (driveLink) {
          if (!id || !id.length) {
            console.log(`no id for url ${cell}`);
            process.exit(1);
          }
          if (links[slug]) {
            console.log(`duplicate id: ${slug}`);
            process.exit(1);
          }
          links[slug] = cell;
          console.log(`${slug} - ${cell}`);
        }
      });
    }
  });
  componentCats.push({
    title: sheet.title,
    slug: slugify(sheet.title),
    components,
  });
}

function processSheets() {
  return pEachSeries(doc.sheetsByIndex, processSheet);
}

function saveLinks() {
  return fs.outputJSON('./links.json', links, { spaces: 2 });
}

function saveInfo() {
  return fs.outputJSON('./info.json', componentCats, { spaces: 2 });
}

auth().then(loadInfo).then(processSheets).then(saveLinks).then(saveInfo);
