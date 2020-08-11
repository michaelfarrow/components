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
  const filledHeaders = [];
  console.log('');
  console.log(`Processing sheet: ${sheet.title}`);
  const groups = [{ name: undefined, components: [] }];
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
    if (filledCells.length === 1) {
      if (!groups[groups.length - 1].components.length) {
        groups[groups.length - 1].name = id;
      } else {
        groups.push({ name: id, components: [] });
      }
    } else if (filledCells.length > 1) {
      const fields = [];
      for (let i = 1; i < headers.length; i++) {
        const header = headers[i];
        if (header && String(header).trim().length) {
          const fieldVal = row._rawData[i];
          // if (fieldVal && String(fieldVal).trim().length) {
          const headerTitle = String(header).trim();
          switch (headerTitle.toLowerCase()) {
            case 'datasheet':
              if (fieldVal) {
                datasheet = String(fieldVal).trim();
                datasheetPreview = `https://drive.google.com/file/d/${
                  datasheet.match(
                    /^https:\/\/drive\.google\.com\/file\/d\/([^\/]+)/
                  )[1]
                }/preview`;
              }
              break;
            case 'quantity':
              quantity = Number(fieldVal);
              break;
            case 'unit':
              if (fields.length) {
                fields[fields.length - 1].value = `${
                  fields[fields.length - 1].value
                }${fieldVal}`;
              }
              break;
            default:
              const headerUnit = headerTitle.match(/(.+)\s*\(\s*(.+)\s*\)$/);
              let processedFieldVal = String(
                fieldVal === undefined ? '' : fieldVal
              ).trim();
              if (processedFieldVal.match(/^\d+\.\d+$/)) {
                processedFieldVal = processedFieldVal
                  .replace(/0+$/, '')
                  .replace(/^(\d+)\.$/, '$1');
              }
              const headerLabel = headerUnit
                ? headerUnit[1].trim()
                : headerTitle;
              fields.push({
                label: headerLabel,
                value: headerUnit
                  ? `${processedFieldVal}${headerUnit[2]}`
                  : processedFieldVal,
              });
              if (!filledHeaders.find((header) => header.index === i)) {
                filledHeaders.push({
                  index: i,
                  title: headerLabel,
                });
              }
          }
          // }
        }
      }
      groups[groups.length - 1].components.push({
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
    groups,
    headers: filledHeaders,
    colCount: filledHeaders.length + 2,
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
