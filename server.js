require('dotenv').config();

const express = require('express');
const handlebars = require('express-handlebars');
const links = require('./links.json');
const info = require('./info.json');

const PORT = process.env.PORT || 80;

const app = express();

app.use(express.static('public'));

app.engine('hbs', handlebars({ extname: '.hbs' }));
app.set('view engine', 'hbs');

function notFound(res, message = 'Not found.') {
  return res.status(404).send(message);
}

app.get('/', (req, res) => {
  res.render('home', { categories: info });
});

app.get('/c/:category', (req, res) => {
  const category = info.find(
    (category) => category.slug === req.params.category
  );
  if (!category) return notFound(res);
  res.render('category', { category });
});

app.get('/c/:category/:component', (req, res) => {
  const category = info.find(
    (category) => category.slug === req.params.category
  );
  if (!category) return notFound(res);
  const component = category.components.find(
    (component) => component.slug === req.params.component
  );
  if (!component) return notFound(res);
  res.render('component', { category, component });
});

app.get('/:slug', (req, res) => {
  const link = links[req.params.slug];
  if (!link) return notFound(res);
  res.redirect(link);
});

app.listen(PORT, () => {
  console.log(`Server started @ http://localhost:${PORT}`);
});
