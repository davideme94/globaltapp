// server/src/index.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import env from './config';
import { connectDB } from './db';
import { errorHandler } from './middlewares/error';

/** Rutas base */
import healthRoute from './routes/health';
import authRoute from './routes/auth';

/**
 * ⚠️ courseManageRoute primero (contiene POST /courses/:courseId/enroll con year)
 * luego coursesRoute y el resto.
 */
import courseManageRoute from './routes/courseManage';
import coursesRoute from './routes/courses';

import studentsRoute from './routes/students';
import communicationsRoute from './routes/communications';
import partialsRoute from './routes/partialReports';
import reportCardsRoute from './routes/reportCards';
import attendanceRoute from './routes/attendance';
import rosterRoute from './routes/roster';
import topicsRoute from './routes/topics';
import courseLinksRoute from './routes/courseLinks';
import practiceRoute from './routes/practice';
import scheduleRoute from './routes/schedule';
import britishRoutes from './routes/british';

/** NUEVO: mis inscripciones + compat cursos/míos */
import enrollmentsRoute from './routes/enrollments';
import coursesMineRoute from './routes/coursesMine';

/** utilitarios perfil/usuarios/uploads */
import usersRoute from './routes/users';     // GET/POST /users, PUT /users/:id/active, POST /users/:id/reset-password
import profileRoute from './routes/profile'; // PUT /me
import uploadsRoute from './routes/uploads'; // POST /uploads/avatar

const app = express();
app.set('trust proxy', 1);

/** CORS */
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      const okExplicit = env.CLIENT_ORIGINS.includes(origin);
      const okDev =
        env.NODE_ENV === 'development' &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
      if (okExplicit || okDev) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

/** Static para avatares/archivos subidos */
app.use('/uploads', express.static(path.resolve('uploads')));

/** Rutas API base */
app.use('/api', healthRoute);
app.use('/api', authRoute);

/**
 * 👇 IMPORTANTE: este primero para que gane el handler de enroll con year
 */
app.use('/api', courseManageRoute);

/** Luego el resto (incluye coursesRoute que puede tener paths similares) */
app.use('/api', coursesRoute);
app.use('/api', studentsRoute);
app.use('/api', communicationsRoute);
app.use('/api', partialsRoute);
app.use('/api', reportCardsRoute);
app.use('/api', attendanceRoute);
app.use('/api', rosterRoute);
app.use('/api', topicsRoute);
app.use('/api', courseLinksRoute);
app.use('/api', practiceRoute);
app.use('/api', scheduleRoute);
app.use('/api', britishRoutes);

/** Mis inscripciones + compat cursos/míos (para el dashboard del alumno/docente) */
app.use('/api', enrollmentsRoute);
app.use('/api', coursesMineRoute);

/** utilitarios */
app.use('/api', usersRoute);
app.use('/api', profileRoute);
app.use('/api', uploadsRoute);


/** Manejo de errores */
app.use(errorHandler);

/** Bootstrap */
async function bootstrap() {
  await connectDB();
  app.listen(env.PORT, env.HOST, () => {
    console.log(`[server] ${env.NODE_ENV} - http://${env.HOST}:${env.PORT}`);
    console.log(`[server] CORS allowed origins: ${env.CLIENT_ORIGINS.join(', ')}`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] bootstrap error:', err);
  process.exit(1);
});
