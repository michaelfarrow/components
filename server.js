require('dotenv').config();

const express = require('express');
const app = express();
const links = require('./links.json');

const PORT = process.env.PORT || 80;

app.get('/', (req, res) => {
  res.send('OK');
});

app.get('/:slug', (req, res) => {
  const link = links[req.params.slug];
  if (!link) {
    return res.status(404).send('Not found.');
  }
  res.redirect(link);
});

app.listen(PORT, () => {
  console.log(`Server started @ http://localhost:${PORT}`);
});
