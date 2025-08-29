// --- base URL: siempre apunta al backend con /api ---
const ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE = ORIGIN ? `${ORIGIN}/api` : '/api'; // si no hay VITE_API_URL, cae a /api (útil con proxy)

// 👇 DEBUG: mostrar a dónde está pegando el front
if (typeof window !== 'undefined') {
  console.debug('[api] BASE =', BASE);
  (window as any).__API_BASE__ = BASE;
}

// --- fetch con parseo robusto ---
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const mkUrl = (base: string) => `${base}${path}`;
  let url = mkUrl(BASE);

  const doFetch = async (u: string) =>
    fetch(u, {
      credentials: 'include', // manda cookies
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    });

  let res = await doFetch(url);

  const ct = res.headers.get('content-type') || '';
  const isJSON = ct.includes('application/json');
  let payload: any = isJSON ? await res.json() : await res.text();

  // Fallback DEV opcional: si vino HTML (del dev server) y NO tenés VITE_API_URL,
  // reintentamos contra http://localhost:4000/api
  if (!res.ok && typeof payload === 'string' && payload.trim().startsWith('<!DOCTYPE') && !ORIGIN) {
    const fallback = 'http://localhost:4000/api';
    console.warn('[api] HTML detectado desde el dev server. Reintentando contra', fallback);
    url = mkUrl(fallback);
    res = await doFetch(url);
    const ct2 = res.headers.get('content-type') || '';
    const isJSON2 = ct2.includes('application/json');
    payload = isJSON2 ? await res.json() : await res.text();
  }

  if (!res.ok) {
    // Sesión inválida → logout + redirect
    if (res.status === 401) {
      try { await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch {}
      if (location.pathname !== '/login') location.href = '/login';
    }
    // Error típico cuando el front le pega al dev server (HTML)
    if (typeof payload === 'string' && payload.trim().startsWith('<!DOCTYPE')) {
      throw new Error(
        'El frontend está llamando al dev server en lugar del backend. ' +
        'Revisá VITE_API_URL (debe ser http://localhost:4000) o el proxy de Vite.'
      );
    }
    // Intenta sacar más detalle de errores de validación (Joi/Zod/Mongoose)
    let msg =
      (isJSON && (payload as any)?.error) ||
      (isJSON && (payload as any)?.message) ||
      '';

    if (!msg && isJSON && (payload as any)?.errors && typeof (payload as any).errors === 'object') {
      msg = Object.values((payload as any).errors)
        .map((e: any) => e?.message || String(e))
        .join('; ');
    }

    throw new Error(msg || `HTTP ${res.status}`);
  }

  return payload as T;
}

function qs(obj?: Record<string, any>) {
  if (!obj) return '';
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export type Role = 'student'|'teacher'|'coordinator'|'admin';
export type Campus = 'DERQUI'|'JOSE_C_PAZ';

// --- Tipos de Horarios ---
export type DayCode = 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'; // lunes..sábado
export type CourseScheduleItem = { day?: DayCode; start: string; end: string }; // day es opcional

export type Me = {
  user: {
    id: string; name: string; email: string; role: Role; campus: Campus;
    phone?: string; photoUrl?: string;
    // campos extra que usamos en el perfil
    dob?: string | null;
    tutor?: string;
    tutorPhone?: string;
  }
};

export type Course = {
  _id: string;
  name: string;
  year: number;
  campus: Campus;
  teacher?: { _id: string; name: string; email: string } | null; // poblado
};

// 🔸 Roster enriquecido
export type RosterItem = {
  _id: string;
  student: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    photoUrl?: string;
    dob?: string | null;       // fecha de nacimiento (ISO) o null
    tutor?: string;
    tutorPhone?: string;
  };
};

export type TermGrades = { writing: number|null; speaking: number|null; reading: number|null; listening: number|null; comments?: string; };
export type FinalCondition = 'APPROVED'|'FAILED_ORAL'|'FAILED_WRITTEN'|'FAILED_BOTH'|'PASSED_INTERNAL'|'REPEATER';

export type ReportCard = {
  _id: string;
  student: string|{_id:string;name:string};
  course: { _id:string; name:string; year:number }|string;
  teacher: string;
  year: number;
  t1: TermGrades; t2: TermGrades; t3: TermGrades;
  examOral: number|null; examWritten?: number|null; finalOral?: number|null; finalWritten?: number|null;
  condition: FinalCondition; comments: string;
  createdAt: string; updatedAt: string;
};

export type TopicEntry = {
  _id: string; course: string; date: string;
  topic1?: string; topic2?: string; book?: string; notes?: string;
  createdAt: string; updatedAt: string;
};

export type CommCategory = 'TASK'|'BEHAVIOR'|'ADMIN'|'INFO';

// 👇 NUEVO (hilo de respuestas de comunicaciones)
export type Reply = {
  _id: string;
  user: string | { _id: string; name: string };
  role: 'student'|'teacher'|'coordinator'|'admin';
  body: string;
  createdAt: string;
};

export type Communication = {
  _id: string;
  course: { _id:string; name:string; year:number }|string;
  student?: string;
  sender: { _id:string; name:string }|string;
  senderRole: 'teacher'|'coordinator'|'admin';
  year: number;
  category: CommCategory;
  title: string;
  body: string;
  readAt?: string|null;
  createdAt: string;

  // 👇 NUEVO
  replies?: Reply[];
};

// --- Tipos para "mis cursos" (Dashboard) ---
export type MyCourseRow = { course: Course; schedule: CourseScheduleItem[] };

// --- Tipos PARCIALES ---
export type PartialTerm = 'MAY'|'OCT';
export type PartialGrade = 'A'|'B'|'C'|'D'|'E';
export type PartialGrades = {
  reading: PartialGrade;
  writing: PartialGrade;
  listening: PartialGrade;
  speaking: PartialGrade;
  attendance: PartialGrade;
  commitment: PartialGrade;
};

// --- Tipos BRITISH ---
export type BritishProvider = 'TRINITY' | 'CAMBRIDGE' | 'BRITANICO';
export type BritishResult = {
  _id?: string;
  course?: string | { _id: string; name: string; year: number };
  provider?: BritishProvider;
  oral?: number | string | null;
  written?: number | string | null;
  updatedAt?: string;
  createdAt?: string;
};
export type BritishMine = { results: BritishResult[] };

// --- NUEVO: Tipos de Casos (staff) ---
export type CaseCategory = 'ACADEMIC_DIFFICULTY'|'BEHAVIOR'|'ATTENDANCE'|'ADMIN'|'OTHER';
export type CaseSeverity  = 'LOW'|'MEDIUM'|'HIGH';
export type CaseStatus    = 'OPEN'|'IN_PROGRESS'|'RESOLVED'|'ARCHIVED';

export type StaffCase = {
  _id: string;
  course?: { _id:string; name:string; year:number } | string | null;
  student: { _id:string; name:string; email?:string } | string;
  createdBy: string | { _id:string; name:string };
  assignee?: { _id:string; name:string } | string | null;
  watchers?: string[];
  category: CaseCategory;
  severity: CaseSeverity;
  status: CaseStatus;
  source: 'MANUAL'|'AUTOMATION';
  ruleId?: string|null;
  title: string;
  description?: string;
  checklist?: { label:string; done:boolean; doneAt?:string|null; by?:string|null }[];
  createdAt: string;
  updatedAt: string;
};

export const api = {
  // AUTH / Perfil actual
  me: () => request<Me>('/auth/me'),
  login: (email: string, password: string) =>
    request<Me>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  // PERFIL
  updateMe: (payload: {
    name?: string;
    campus?: Campus;
    phone?: string;
    photoUrl?: string;
    // nuevos opcionales:
    dob?: string;        // YYYY-MM-DD
    tutor?: string;
    tutorPhone?: string;
  }) =>
    request<{ ok?: true; user?: any }>(
      '/me',
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  // USERS (gestión coord/admin)
  users: {
    list: (opts?: { role?: 'student'|'teacher'; q?: string; page?: number; limit?: number }) =>
      request<{ rows: { _id:string; name:string; email:string; role:'student'|'teacher'; campus:Campus; active:boolean }[]; total:number; page:number; limit:number }>(
        `/users${qs(opts)}`
      ),
    create: (payload: { name:string; role:'student'|'teacher'; campus:Campus; email?:string }) => {
      const body: any = { ...payload };
      if (body.email !== undefined) {
        body.email = String(body.email).trim();
        if (!body.email) delete body.email;
      }
      return request<{ user: { _id:string; name:string; email:string; role:string; campus:Campus; active:boolean }, password: string }>(
        '/users', { method:'POST', body: JSON.stringify(body) }
      );
    },
    setActive: (id: string, active: boolean) =>
      request<{ user:any }>(`/users/${id}/active`, { method:'PUT', body: JSON.stringify({ active }) }),
    resetPassword: (id: string) =>
      request<{ user:{ _id:string; email:string; name:string }, password:string }>(`/users/${id}/reset-password`, { method:'POST' }),
    search: (role: 'teacher'|'student', q: string) =>
      request<{ rows: { _id:string; name:string; email:string; role:string }[] }>(`/users/search${qs({ role, q })}`),
    delete: (id: string) =>
      request<{ ok:true }>(`/users/${id}`, { method: 'DELETE' }),
  },

  // COURSES
  courses: {
    list: (filters?: { year?: number; campus?: Campus }) =>
      request<{ courses: Course[] }>(`/courses${qs(filters)}`),
    create: (payload: { name: string; year: number; campus: Campus }) =>
      request<{ course: Course }>('/courses', { method: 'POST', body: JSON.stringify(payload) }),
    roster: (courseId: string) =>
      request<{ roster: RosterItem[] }>(`/courses/${courseId}/roster`),
    links: {
      get: (courseId: string) =>
        request<{ course: { _id:string; name:string; year:number }, links: { syllabusUrl?: string; materialsUrl?: string } | null }>(`/courses/${courseId}/links`),
      set: (courseId: string, payload: { syllabusUrl?: string; materialsUrl?: string }) =>
        request<{ ok: true; links: any }>(`/courses/${courseId}/links`, { method: 'PUT', body: JSON.stringify(payload) }),
    },
    // Horarios del curso
    schedule: {
      get: (courseId: string) =>
        request<{ course: { _id:string; name:string; year:number }; schedule: CourseScheduleItem[] }>(
          `/courses/${courseId}/schedule`
        ),
      set: (courseId: string, items: CourseScheduleItem[]) =>
        request<{ ok:true; schedule: CourseScheduleItem[] }>(
          `/courses/${courseId}/schedule`,
          { method: 'PUT', body: JSON.stringify({ schedule: items }) }
        ),
    },
    // Mis cursos (alumno actual)
    mine: (opts?: { year?: number }) =>
      request<{ year: number; rows: MyCourseRow[] }>(`/courses/mine${qs(opts)}`),
    assignTeacher: (courseId: string, teacherId: string) =>
      request<{ ok:true; course: Course }>(`/courses/${courseId}/teacher`, { method:'PUT', body: JSON.stringify({ teacherId }) }),
    enroll: (courseId: string, studentId: string) =>
      request<{ ok:true; enrollment:any; createdPassword?: string }>(`/courses/${courseId}/enroll`, { method:'POST', body: JSON.stringify({ studentId }) }),
    enrollByEmail: (courseId: string, email: string, autoCreate = true) =>
      request<{ ok:true; enrollment:any; createdPassword?: string }>(`/courses/${courseId}/enroll`, { method:'POST', body: JSON.stringify({ email, autoCreate }) }),
    unenroll: (courseId: string, studentId: string) =>
      request<{ ok:true }>(`/courses/${courseId}/enroll/${studentId}`, { method:'DELETE' }),
    // NUEVO: desinscripción "dura" usando ?hard=1
    unenrollHard: (courseId: string, studentId: string) =>
      request<{ ok:true }>(`/courses/${courseId}/enroll/${studentId}?hard=1`, { method: 'DELETE' }),
    delete: (id: string) =>
      request<{ ok:true }>(`/courses/${id}`, { method: 'DELETE' }),
  },

  // PARTIALS (informes parciales)
  partials: {
    // alumno
    mine: () =>
      request<{ rows: any[]; reports?: any[] }>('/partials/mine'),

    // curso (coord/profe/admin) – opcional ?term= y ?year=
    course: (courseId: string, opts?: { term?: PartialTerm; year?: number }) =>
      request<{ course: { id:string; name:string; year:number; term: PartialTerm }; year: number; rows: any[] }>(
        `/partials/course/${courseId}${qs(opts)}`
      ),

    // guardar / actualizar
    upsert: (payload: {
      courseId: string;
      studentId: string;
      term: PartialTerm;
      grades: PartialGrades;
      comments?: string;
      year?: number;
    }) =>
      request<{ ok:true; report:any }>(
        '/partials',
        { method:'PUT', body: JSON.stringify(payload) }
      ),
  },

  // REPORT CARDS
  reportcards: {
    listCourse: (courseId: string) =>
      request<{ course: { id:string; name:string; year:number }; rows: { student: { _id:string; name:string; email:string }, card: ReportCard|null }[] }>(`/reportcards/course/${courseId}`),
    upsert: (payload: {
      courseId: string; studentId: string;
      t1?: Partial<TermGrades>; t2?: Partial<TermGrades>; t3?: Partial<TermGrades>;
      examOral?: number|null; examWritten?: number|null; finalOral?: number|null; finalWritten?: number|null;
      condition?: FinalCondition; comments?: string;
    }) => request<{ card: ReportCard }>('/reportcards', { method: 'PUT', body: JSON.stringify(payload) }),
    mine: () => request<{ cards: ReportCard[] }>('/reportcards/mine'),
    detail: (courseId: string, studentId: string) =>
      request<{ student:any; course:any; teacher:any; report: ReportCard|null }>(`/reportcards/detail${qs({ courseId, studentId })}`),
  },

  // ATTENDANCE
  attendance: {
    upsert: (payload: { courseId: string; date: string; studentId: string; status: 'P'|'A'|'T'|'J' }) =>
      request<{ ok: true; item: any }>('/attendance', { method: 'PUT', body: JSON.stringify(payload) }),
    grid: (courseId: string, params?: { from?: string; to?: string }) =>
      request<{ dates: string[]; rows: { student: { _id:string; name:string }, statusByDate: Record<string,string|null>, resume: { P:number; A:number; J:number; T:number; total:number; percent:number } }[] }>(`/attendance/grid${qs({ courseId, ...(params||{}) })}`),
  },

  // TOPICS
  topics: {
    upsert: (payload: { courseId: string; date: string; topic1?: string; topic2?: string; book?: string; notes?: string }) =>
      request<{ ok: true; entry: TopicEntry }>('/topics', { method: 'PUT', body: JSON.stringify(payload) }),
    grid: (courseId: string, params?: { from?: string; to?: string }) =>
      request<{ rows: TopicEntry[] }>(`/topics/grid${qs({ courseId, ...(params||{}) })}`),
  },

  // COMMUNICATIONS
  communications: {
    send: (payload: { courseId: string; studentId?: string; category: CommCategory; title: string; body: string }) =>
      request<{ ok:true; sent:number; ids:string[] }>('/communications', { method:'POST', body: JSON.stringify(payload) }),
    course: (courseId: string, opts?: { studentId?: string; year?: number }) =>
      request<{ rows: Communication[] }>(`/communications/course/${courseId}${qs(opts)}`),
    mine: () =>
      request<{ rows: Communication[] }>('/communications/mine'),
    markRead: (id: string) =>
      request<{ ok:true; item: Communication }>(`/communications/${id}/read`, { method: 'PUT' }),
    // NUEVO: broadcast masivo (coord/admin)
    broadcast: (payload: {
      title: string;
      body: string;
      category?: 'TASK'|'BEHAVIOR'|'ADMIN'|'INFO';
      roles?: ('student'|'teacher'|'coordinator'|'admin')[];
      campuses?: ('DERQUI'|'JOSE_C_PAZ')[];
      active?: boolean;
      courseId?: string;
    }) =>
      request<{ ok:true; sent:number; ids:string[] }>(
        '/communications/broadcast',
        { method: 'POST', body: JSON.stringify(payload) }
      ),
    // 👇 NUEVO: responder a una comunicación
    reply: (id: string, body: string) =>
      request<{ ok:true; reply: Reply }>(
        `/communications/${id}/replies`,
        { method: 'POST', body: JSON.stringify({ body }) }
      ),
  },

  // PRACTICE
  practice: {
    accessByCourse: (courseId: string) =>
      request<{ rows: { student: { _id:string; name:string; email:string }, enabled: boolean }[] }>(`/practice/access/course/${courseId}`),
    setAccess: (studentId: string, enabled: boolean) =>
      request<{ ok:true; access:any }>(`/practice/access`, { method:'PUT', body: JSON.stringify({ studentId, enabled }) } ),
    seed: () => request<{ ok:true; created:number }>(`/practice/seed-simple`, { method:'POST' }),
    play: () => request<{ questions: { _id:string; prompt:string; type:'MC'|'GAP'; options?: string[]|null }[] }>(`/practice/play`),
    submit: (questionId: string, answer: string) =>
      request<{ correct: boolean }>(`/practice/submit`, { method:'POST', body: JSON.stringify({ questionId, answer }) } ),
    createQuestion: (payload: { prompt:string; type:'MC'|'GAP'; options?:string[]; answer:string; level?:string; courseId?:string }) =>
      request<{ ok:true; question:any }>(`/practice/questions`, { method:'POST', body: JSON.stringify(payload) }),
    listQuestions: () => request<{ questions:any[] }>(`/practice/questions`),
  },

  // BRITISH
  british: {
    mine: () => request<BritishMine>('/british/mine'),
    byCourse: (courseId: string, opts?: { year?: number }) =>
      request<{ rows: any[]; year: number }>(`/british/course/${courseId}${qs(opts)}`),
    upsert: (payload: {
      courseId: string;
      studentId: string;
      provider?: BritishProvider;
      oral?: number | null;
      written?: number | null;
      year?: number;
    }) =>
      request<{ ok: true; result: any }>(
        '/british',
        { method: 'PUT', body: JSON.stringify(payload) }
      ),
  },

  // 👇 NUEVO: Casos (seguimiento de alumnos)
  cases: {
    create: (payload: {
      studentId: string; courseId?: string;
      title: string; description?: string;
      category: CaseCategory; severity?: CaseSeverity;
      checklist?: string[]; assigneeId?: string;
    }) =>
      request<{ ok:true; case: StaffCase }>(
        '/cases',
        { method:'POST', body: JSON.stringify(payload) }
      ),

    list: (filters?: {
      status?: CaseStatus; category?: CaseCategory;
      studentId?: string; courseId?: string; severity?: CaseSeverity
    }) =>
      request<{ rows: StaffCase[] }>(
        `/cases${qs(filters)}`
      ),

    update: (id: string, patch: Partial<Pick<StaffCase,'status'|'severity'>> & { assignee?: string }) =>
      request<{ ok:true; case: StaffCase }>(
        `/cases/${id}`,
        { method:'PUT', body: JSON.stringify(patch) }
      ),

    reply: (id: string, body: string) =>
      request<{ ok:true; reply:any }>(
        `/cases/${id}/replies`,
        { method:'POST', body: JSON.stringify({ body }) }
      ),
  },

  // 👇 NUEVO: Alerts (automatizaciones)
  alerts: {
    run: (opts?: { courseId?: string; reminders?: boolean }) =>
      request<{ ok:true; scanned:number; created:number }>(
        `/alerts/run${qs({ ...opts, reminders: opts?.reminders ? 1 : undefined })}`,
        { method:'POST' }
      ),
  },
};
