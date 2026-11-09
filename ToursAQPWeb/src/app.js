const path = require('path');
const express = require('express');
const session = require('express-session');
const apiRouter = require('./routes/api');

const DEV_SECRET = 'toursaqp-dev-secret';

function createApp() {
  const isProduction = process.env.NODE_ENV === 'production';
  const secret = process.env.SESSION_SECRET || (isProduction ? null : DEV_SECRET);
  if (!secret) {
    throw new Error('SESSION_SECRET es obligatorio cuando NODE_ENV=production');
  }

  const app = express();
  app.disable('x-powered-by');
  // En produccion se asume un proxy HTTPS delante (Render, Fly.io, nginx...).
  if (isProduction) app.set('trust proxy', 1);

  app.use(express.json());
  app.use(
    session({
      secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 4,
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
      },
    })
  );

  app.use('/api', apiRouter);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Sin este manejador, Express responde con HTML y expone la traza del error.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON invalido' });
    }
    if (err.status && err.status < 500) {
      return res.status(err.status).json({ error: 'Solicitud invalida' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { createApp };
