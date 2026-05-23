const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

const publicPath = path.resolve(__dirname, '../public');
const port = process.env.PORT || 3000;

// Soporte para JSON y form-data con límite alto (fotos/videos en base64)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// CORS abierto para desarrollo
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Carpeta pública
app.use(express.static(publicPath));

// Rutas de la API
const routes = require('./routes');
app.use('/api', routes);

app.listen(port, (err) => {
  if (err) throw new Error(err);
  console.log(`StudySync corriendo en http://localhost:${port}`);
});