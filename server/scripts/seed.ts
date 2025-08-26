import { connectDB, disconnectDB } from '../src/db';
import { User } from '../src/models/user';
import { Course } from '../src/models/course';
import { Enrollment } from '../src/models/enrollment';
import { hashPassword } from '../src/utils/password';

async function ensureUser(opts: {
  name: string;
  email: string;
  role: 'admin' | 'coordinator' | 'teacher' | 'student';
  campus: 'DERQUI' | 'JOSE_C_PAZ';
  password: string;
}) {
  const passwordHash = await hashPassword(opts.password);
  const res = await User.updateOne(
    { email: opts.email },
    {
      $set: {
        name: opts.name,
        role: opts.role,
        campus: opts.campus,
        passwordHash // <- SIEMPRE actualiza la password
      }
    },
    { upsert: true }
  );
  if (res.upsertedCount) {
    console.log(` + creado: ${opts.email} / ${opts.password}`);
  } else {
    console.log(` ~ actualizado: ${opts.email} / ${opts.password}`);
  }
  return await User.findOne({ email: opts.email }).lean();
}

async function main() {
  await connectDB();

  // Modo force: eliminar curso/enrollment demo si existen
  const FORCE = !!process.env.SEED_FORCE;

  const admin = await ensureUser({
    name: 'Admin Demo',
    email: 'admin@inst.test',
    role: 'admin',
    campus: 'DERQUI',
    password: 'admin123'
  });

  const coord = await ensureUser({
    name: 'Coordinador Demo',
    email: 'coord@inst.test',
    role: 'coordinator',
    campus: 'DERQUI',
    password: 'coord123'
  });

  const profe = await ensureUser({
    name: 'Profesor Demo',
    email: 'profe@inst.test',
    role: 'teacher',
    campus: 'JOSE_C_PAZ',
    password: 'profe123'
  });

  const alumno = await ensureUser({
    name: 'Alumno Demo',
    email: 'alumno@inst.test',
    role: 'student',
    campus: 'DERQUI',
    password: 'alumno123'
  });

  const year = new Date().getFullYear();
  const courseName = `Inglés A1 ${year}`;

  if (FORCE) {
    await Course.deleteMany({ name: courseName, year, campus: 'DERQUI' });
    await Enrollment.deleteMany({ year });
  }

  await Course.updateOne(
    { name: courseName, year, campus: 'DERQUI' },
    {
      $setOnInsert: {
        teacher: profe?._id ?? null,
        schedule: [{ dayOfWeek: 2, start: '18:00', end: '19:30' }],
        materials: []
      }
    },
    { upsert: true }
  );

  const course = await Course.findOne({ name: courseName, year, campus: 'DERQUI' }).lean();
  console.log(` + curso: ${courseName} (${course?._id})`);

  if (course && alumno?._id) {
    await Enrollment.updateOne(
      { course: course._id, student: alumno._id, year },
      { $setOnInsert: { status: 'active' } },
      { upsert: true }
    );
    console.log(' + inscripción alumno demo OK');
  }

  console.log('\nUsuarios para probar (front):');
  console.log('- admin@inst.test / admin123');
  console.log('- coord@inst.test / coord123');
  console.log('- profe@inst.test / profe123');
  console.log('- alumno@inst.test / alumno123');

  await disconnectDB();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDB();
  process.exit(1);
});
