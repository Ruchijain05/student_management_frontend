import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Award,
  BookOpen,
  Bell,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Clock3,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError, tokenStore } from "./api";
import type {
  AdminDashboard,
  Attendance,
  Course,
  CourseResult,
  Entity,
  Enrollment,
  FeeAssignment,
  Mark,
  Notice,
  Student,
  StudentDashboard,
  SportsAchievement,
  SportsDashboard,
  TimetableEntry,
  User,
} from "./types";

type Page =
  | "overview"
  | "students"
  | "courses"
  | "enrollments"
  | "attendance"
  | "marks"
  | "sports"
  | "notices"
  | "timetable"
  | "fees"
  | "results"
  | "profile";
type Row = Entity;
type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "date" | "time" | "select" | "sport" | "medal" | "course-search" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: string;
  step?: string;
  maxLength?: number;
  full?: boolean;
};
type PageInfo = { title: string; singular: string; icon: LucideIcon; subtitle: string };
type Message = { kind: "success" | "error"; text: string };

const SPORTS = [
  "Cricket",
  "Football",
  "Basketball",
  "Volleyball",
  "Badminton",
  "Tennis",
  "Table Tennis",
  "Hockey",
  "Kabaddi",
  "Kho-Kho",
  "Swimming",
  "Chess",
  "Wrestling",
  "Roller Skating",
  "Carrom",
  "Karate",
  "Judo",
  "Baseball",
  "Motorsports",
  "Boxing",
];

const MEDALS = [
  "Gold Medal",
  "Silver Medal",
  "Bronze Medal",
  "Participation Certificate",
];

const PAGE_INFO: Record<Page, PageInfo> = {
  overview: {
    title: "Overview",
    singular: "overview",
    icon: LayoutDashboard,
    subtitle: "A little progress each day adds up to big results.",
  },
  students: {
    title: "Students",
    singular: "student",
    icon: Users,
    subtitle: "Keep student records organized and up to date.",
  },
  courses: {
    title: "Courses",
    singular: "course",
    icon: BookOpen,
    subtitle: "Build a clear view of the curriculum.",
  },
  enrollments: {
    title: "Enrollments",
    singular: "enrollment",
    icon: GraduationCap,
    subtitle: "See who is learning what.",
  },
  attendance: {
    title: "Attendance",
    singular: "attendance record",
    icon: CalendarCheck,
    subtitle: "A consistent check-in makes a big difference.",
  },
  marks: {
    title: "Assessments",
    singular: "assessment",
    icon: ClipboardList,
    subtitle: "Track assessment scores and academic progress.",
  },
  sports: {
    title: "Sports & achievements",
    singular: "sports achievement",
    icon: Award,
    subtitle: "Celebrate athletic achievements and competition milestones.",
  },
  notices: {
    title: "Notice Board",
    singular: "notice",
    icon: Bell,
    subtitle: "Keep everyone informed about important campus updates.",
  },
  timetable: {
    title: "Course Timetable",
    singular: "class schedule",
    icon: CalendarDays,
    subtitle: "Your Monday–Saturday classes, all in one place.",
  },
  fees: {
    title: "Fees Management",
    singular: "fee assignment",
    icon: CreditCard,
    subtitle: "Track course fees, payments, and outstanding balances.",
  },
  results: {
    title: "Results",
    singular: "result",
    icon: Award,
    subtitle: "Celebrate progress, one course at a time.",
  },
  profile: {
    title: "My profile",
    singular: "profile",
    icon: ShieldCheck,
    subtitle: "Your student account and academic record.",
  },
};

const ADMIN_NAV: Page[] = [
  "overview",
  "students",
  "courses",
  "enrollments",
  "attendance",
  "marks",
  "sports",
  "notices",
  "timetable",
  "fees",
  "results",
];
const STUDENT_NAV: Page[] = [
  "overview",
  "profile",
  "courses",
  "enrollments",
  "attendance",
  "marks",
  "sports",
  "notices",
  "timetable",
  "fees",
  "results",
];

function recordValue(row: Row, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function fullName(student?: Student) {
  return student ? `${student.first_name} ${student.last_name}` : "Unknown student";
}

function formatDate(value: unknown, includeTime = false) {
  if (typeof value !== "string" || !value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(parsed);
}

function formatLectureTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | string) {
  const amount = Number(value);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function currentWeekday(): string | null {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date().getDay()
  ];
}

function AuthScreen({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [resetSent, setResetSent] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (mode === "login") {
        const response = await api<{ user: User; access_token: string }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: values.email, password: values.password }),
        });
        onLogin(response.user, response.access_token);
      } else if (mode === "register") {
        const response = await api<{ user: User; access_token: string }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            password: values.password,
          }),
        });
        onLogin(response.user, response.access_token);
      } else if (!resetSent) {
        await api("/auth/password-reset/request", {
          method: "POST",
          body: JSON.stringify({ email: values.email }),
        });
        setResetSent(true);
        setMessage({
          kind: "success",
          text: "If an account exists for that email, a reset code has been generated. In local development, check the backend terminal; otherwise contact your campus administrator.",
        });
      } else {
        await api("/auth/password-reset/confirm", {
          method: "POST",
          body: JSON.stringify({
            email: values.email,
            otp: values.otp,
            new_password: values.new_password,
          }),
        });
        setMode("login");
        setResetSent(false);
        setMessage({ kind: "success", text: "Password updated. You can now sign in." });
      }
    } catch (error) {
      setMessage({ kind: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const isReset = mode === "reset";
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand brand-light">
          <span className="brand-mark"><GraduationCap size={21} /></span>
          <span>Chandradip<span className="brand-period">.</span></span>
        </div>
        <div className="story-copy">
          <span className="eyebrow story-eyebrow"><Sparkles size={14} /> Chandradip, in sync</span>
          <h1>Make room<br />for <em>what&apos;s next.</em></h1>
          <p>One thoughtful place for the people, plans, and progress that make a great education.</p>
        </div>
        <div className="story-note">
          <div className="avatar-stack"><span>AM</span><span>JR</span><span>SK</span><b>+</b></div>
          <span>Good things happen<br />when we learn together.</span>
        </div>
        <div className="story-orb story-orb-one" />
        <div className="story-orb story-orb-two" />
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-brand brand">
          <span className="brand-mark"><GraduationCap size={20} /></span>
          <span>Chandradip<span className="brand-period">.</span></span>
        </div>
        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow">{isReset ? "ACCOUNT RECOVERY" : "WELCOME TO CAMPUS"}</span>
            <h2>{mode === "login" ? "Welcome back" : mode === "register" ? "Join your campus" : resetSent ? "Enter your reset code" : "Forgot your password?"}</h2>
            <p>{mode === "login" ? "Sign in to pick up where you left off." : mode === "register" ? "Create your student account to get started." : "We’ll help you get back into your account."}</p>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <div className="form-row">
                <label>First name<input name="first_name" autoComplete="given-name" placeholder="Jordan" required /></label>
                <label>Last name<input name="last_name" autoComplete="family-name" placeholder="Rivera" required /></label>
              </div>
            )}
            <label>Email address
              <input name="email" type="email" autoComplete="email" placeholder="you@school.edu" required />
            </label>
            {mode === "login" && (
              <label className="password-label">Password
                <button className="text-button" type="button" onClick={() => { setMode("reset"); setMessage(null); }}>Forgot password?</button>
                <input name="password" type="password" autoComplete="current-password" placeholder="Your password" required />
              </label>
            )}
            {mode === "register" && (
              <label>Password
                <input name="password" type="password" autoComplete="new-password" minLength={6} maxLength={8} pattern="[0-9]{6,8}" inputMode="numeric" placeholder="6–8 digit password" required />
                <small className="field-hint">Use 6–8 numbers, just like your student account policy.</small>
              </label>
            )}
            {isReset && resetSent && (
              <>
                <label>6-digit reset code
                  <input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required />
                </label>
                <label>New password
                  <input name="new_password" type="password" minLength={6} maxLength={8} pattern="[0-9]{6,8}" inputMode="numeric" autoComplete="new-password" placeholder="6–8 digit password" required />
                </label>
              </>
            )}
            {message && <div className={`notice notice-${message.kind}`} role="status">{message.text}</div>}
            <button className="button button-primary button-wide" disabled={busy}>
              {busy ? "Just a moment…" : mode === "login" ? "Sign in" : mode === "register" ? "Create student account" : resetSent ? "Reset password" : "Send reset code"}
              {!busy && <ArrowUpRight size={17} />}
            </button>
          </form>
          <div className="auth-switch">
            {mode === "login" ? <>New to Chandradip? <button className="text-button" onClick={() => { setMode("register"); setMessage(null); }}>Create an account</button></> :
              <>Already have an account? <button className="text-button" onClick={() => { setMode("login"); setResetSent(false); setMessage(null); }}>Sign in</button></>}
          </div>
          <p className="auth-footnote"><ShieldCheck size={14} /> Your academic information stays private and secure.</p>
        </div>
        <span className="auth-copyright">© {new Date().getFullYear()} Chandradip Student Management</span>
      </section>
    </main>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something unexpected happened. Please try again.";
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState<Page>("overview");
  const [rows, setRows] = useState<Row[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [adminSummary, setAdminSummary] = useState<AdminDashboard | null>(null);
  const [studentSummary, setStudentSummary] = useState<StudentDashboard | null>(null);
  const [sportsSummary, setSportsSummary] = useState<SportsDashboard | null>(null);
  const [latestNotices, setLatestNotices] = useState<Notice[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [feeAssignments, setFeeAssignments] = useState<FeeAssignment[]>([]);
  const [profile, setProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Message | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<FeeAssignment | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? ADMIN_NAV : STUDENT_NAV;
  const currentInfo = PAGE_INFO[page];

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setAuthLoading(false));
  }, []);

  const loadPage = useCallback(async (target: Page, activeUser: User) => {
    setLoading(true);
    setError("");
    try {
      if (target === "overview") {
        if (activeUser.role === "admin") {
          const [summary, noticesList, studentList, courseList] = await Promise.all([
            api<AdminDashboard>("/dashboard/admin"),
            api<Notice[]>("/notices?limit=5"),
            api<Student[]>("/students?limit=100"),
            api<Course[]>("/courses?limit=100"),
          ]);
          setAdminSummary(summary);
          setLatestNotices(noticesList);
          setStudents(studentList);
          setCourses(courseList);
        } else {
          const [summary, noticesList, schedule, feesList] = await Promise.all([
            api<StudentDashboard>("/dashboard/student"),
            api<Notice[]>("/notices?limit=5"),
            api<TimetableEntry[]>("/timetable?limit=200"),
            api<FeeAssignment[]>("/fees?limit=200"),
          ]);
          setStudentSummary(summary);
          setLatestNotices(noticesList);
          setTimetableEntries(schedule);
          setFeeAssignments(feesList);
          if (activeUser.student_id) {
            setProfile(await api<Student>(`/students/${activeUser.student_id}`));
          }
        }
        setRows([]);
      } else if (target === "profile") {
        if (activeUser.student_id) {
          setProfile(await api<Student>(`/students/${activeUser.student_id}`));
        }
        setRows([]);
      } else if (target === "students") {
        setRows(await api<Student[]>("/students?limit=100"));
      } else if (target === "courses") {
        const list = await api<Course[]>("/courses?limit=100");
        setCourses(list);
        setRows(list);
      } else if (target === "enrollments") {
        const [list, studentList, courseList] = await Promise.all([
          api<Enrollment[]>("/enrollments?limit=100"),
          api<Student[]>("/students?limit=100"),
          api<Course[]>("/courses?limit=100"),
        ]);
        setStudents(studentList);
        setCourses(courseList);
        setRows(list);
      } else if (target === "attendance") {
        const [list, studentList, courseList] = await Promise.all([
          api<Attendance[]>("/attendance?limit=100"),
          api<Student[]>("/students?limit=100"),
          api<Course[]>("/courses?limit=100"),
        ]);
        setStudents(studentList);
        setCourses(courseList);
        setRows(list);
      } else if (target === "marks") {
        const [list, studentList, courseList] = await Promise.all([
          api<Mark[]>("/marks?limit=100"),
          api<Student[]>("/students?limit=100"),
          api<Course[]>("/courses?limit=100"),
        ]);
        setStudents(studentList);
        setCourses(courseList);
        setRows(list);
      } else if (target === "sports") {
        setSportsSummary(null);
        const list = await api<SportsAchievement[]>("/sports?limit=100");
        setRows(list);
        if (activeUser.role === "admin") {
          const [summary, studentList] = await Promise.all([
            api<SportsDashboard>("/dashboard/sports"),
            api<Student[]>("/students?limit=100"),
          ]);
          setSportsSummary(summary);
          setStudents(studentList);
        } else {
          setSportsSummary(null);
        }
      } else if (target === "notices") {
        setRows(await api<Notice[]>("/notices?limit=100"));
      } else if (target === "timetable") {
        if (activeUser.role === "admin") {
          const [schedule, courseList] = await Promise.all([
            api<TimetableEntry[]>("/timetable?limit=200"),
            api<Course[]>("/courses?limit=100"),
          ]);
          setRows(schedule);
          setCourses(courseList);
        } else {
          setRows(await api<TimetableEntry[]>("/timetable?limit=200"));
        }
      } else if (target === "fees") {
        const [feeList, studentList, courseList] = await Promise.all([
          api<FeeAssignment[]>("/fees?limit=200"),
          activeUser.role === "admin" ? api<Student[]>("/students?limit=100") : Promise.resolve([]),
          activeUser.role === "admin" ? api<Course[]>("/courses?limit=100") : Promise.resolve([]),
        ]);
        setFeeAssignments(feeList);
        setRows(feeList);
        if (activeUser.role === "admin") {
          setStudents(studentList);
          setCourses(courseList);
        }
      } else if (target === "results") {
        const [list, studentList, courseList] = await Promise.all([
          api<CourseResult[]>("/results"),
          api<Student[]>("/students?limit=100"),
          api<Course[]>("/courses?limit=100"),
        ]);
        setStudents(studentList);
        setCourses(courseList);
        setRows(list);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadPage(page, user);
  }, [user, page, loadPage]);

  function handleLogin(nextUser: User, accessToken: string) {
    tokenStore.set(accessToken);
    setPage("overview");
    setUser(nextUser);
  }

  function handleLogout() {
    tokenStore.clear();
    setUser(null);
    setRows([]);
    setNotice(null);
    setPage("overview");
  }

  function navigate(target: Page) {
    setPage(target);
    setSearch("");
    setNotice(null);
    setMobileNavOpen(false);
  }

  const pageRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [rows, search]);

  const fields = useMemo(
    () => getFields(page, students, courses, Boolean(editing)),
    [page, students, courses, editing],
  );

  function openCreate() {
    setPaymentTarget(null);
    setEditing(null);
    setFormValues(defaultValues(getFields(page, students, courses)));
    setModalOpen(true);
  }

  function openEdit(row: Row) {
    setPaymentTarget(null);
    setEditing(row);
    setFormValues(defaultValues(getFields(page, students, courses, true), row));
    setModalOpen(true);
  }

  function openRecordPayment(row: FeeAssignment) {
    setEditing(null);
    setPaymentTarget(row);
    const localDate = new Date();
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    setFormValues({
      amount: "",
      payment_date: localDate.toISOString().slice(0, 10),
      payment_method: "cash",
    });
    setModalOpen(true);
  }

  async function saveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentTarget) {
      setSaving(true);
      setNotice(null);
      try {
        await api(`/fees/${paymentTarget.id}/payments`, {
          method: "POST",
          body: JSON.stringify({
            amount: Number(formValues.amount),
            payment_date: formValues.payment_date,
            payment_method: formValues.payment_method,
          }),
        });
        setModalOpen(false);
        setPaymentTarget(null);
        setNotice({ kind: "success", text: "Payment recorded successfully." });
        await loadPage(page, user!);
      } catch (paymentError) {
        setNotice({ kind: "error", text: errorMessage(paymentError) });
      } finally {
        setSaving(false);
      }
      return;
    }
    if (
      page === "timetable" &&
      !courses.some((course) => String(course.id) === formValues.course_id)
    ) {
      setNotice({ kind: "error", text: "Select an existing course from the list." });
      return;
    }
    if (page === "sports" && !SPORTS.some((sport) => sport === formValues.sport_name)) {
      setNotice({ kind: "error", text: "Select a sport from the provided list." });
      return;
    }
    const existingResult = editing ? recordValue(editing, "result") : null;
    const unchangedLegacyResult =
      page === "sports" &&
      editing !== null &&
      formValues.result === existingResult &&
      typeof existingResult === "string" &&
      !MEDALS.includes(existingResult);
    if (
      page === "sports" &&
      formValues.result &&
      !MEDALS.includes(formValues.result) &&
      !unchangedLegacyResult
    ) {
      setNotice({ kind: "error", text: "Select a medal or recognition from the provided list." });
      return;
    }
    setSaving(true);
    setNotice(null);
    const payload: Record<string, string | number | null> = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => [
        key,
        ["student_id", "course_id", "score", "max_score", "course_fee"].includes(key) && value !== ""
          ? Number(value)
          : value,
      ]),
    );
    if ("description" in payload && payload.description === "") payload.description = null;
    if ("course_fee" in payload && payload.course_fee === "") payload.course_fee = null;
    for (const field of ["event_name", "competition_name", "result"]) {
      if (field in payload && payload[field] === "") payload[field] = null;
    }
    if (unchangedLegacyResult) delete payload.result;
    const pathByPage: Partial<Record<Page, string>> = {
      students: "/students",
      courses: "/courses",
      enrollments: "/enrollments",
      attendance: "/attendance",
      marks: "/marks",
      sports: "/sports",
      notices: "/notices",
      timetable: "/timetable",
      fees: "/fees",
    };
    const path = pathByPage[page];
    if (!path) return;
    try {
      await api(`${path}${editing ? `/${recordValue(editing, "id")}` : ""}`, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      setNotice({
        kind: "success",
        text: `${currentInfo.singular[0].toUpperCase()}${currentInfo.singular.slice(1)} ${editing ? "updated" : "created"} successfully.`,
      });
      await loadPage(page, user!);
    } catch (saveError) {
      setNotice({ kind: "error", text: errorMessage(saveError) });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: Row) {
    const id = recordValue(row, "id");
    if (typeof id !== "number" || !window.confirm(`Delete this ${currentInfo.singular}? This action cannot be undone.`)) return;
    const pathByPage: Partial<Record<Page, string>> = {
      students: "/students",
      courses: "/courses",
      enrollments: "/enrollments",
      attendance: "/attendance",
      marks: "/marks",
      sports: "/sports",
      notices: "/notices",
      timetable: "/timetable",
      fees: "/fees",
    };
    const path = pathByPage[page];
    if (!path) return;
    setNotice(null);
    try {
      await api(`${path}/${id}`, { method: "DELETE" });
      setNotice({ kind: "success", text: `${currentInfo.singular} deleted.` });
      await loadPage(page, user!);
    } catch (deleteError) {
      setNotice({ kind: "error", text: errorMessage(deleteError) });
    }
  }

  if (authLoading) {
    return <div className="splash"><span className="brand-mark"><GraduationCap size={21} /></span><span>Getting your campus ready…</span></div>;
  }
  if (!user) return <AuthScreen onLogin={handleLogin} />;

  const firstName = profile?.first_name || user.email.split("@")[0] || "there";
  const showCreate = isAdmin && ["students", "courses", "enrollments", "attendance", "marks", "sports", "notices", "timetable", "fees"].includes(page);

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark"><GraduationCap size={21} /></span>
          <span>Chandradip<span className="brand-period">.</span></span>
          <button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={19} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = PAGE_INFO[item].icon;
            return (
              <button key={item} className={`nav-item ${page === item ? "nav-item-active" : ""}`} onClick={() => navigate(item)}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{PAGE_INFO[item].title}</span>
                {page === item && <span className="nav-active-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><div className="help-icon"><CircleHelp size={17} /></div><div><b>Need a hand?</b><span>Visit your campus admin</span></div></div>
          <div className="sidebar-user">
            <div className="user-avatar">{initials(profile, user)}</div>
            <div className="user-copy"><b>{profile ? fullName(profile) : user.email.split("@")[0]}</b><span>{isAdmin ? "Administrator" : "Student"}</span></div>
            <button className="icon-button logout-button" aria-label="Sign out" title="Sign out" onClick={handleLogout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Chandradip</span><span className="breadcrumb-slash">/</span><b>{currentInfo.title}</b></div>
          <div className="topbar-right">
            <div className="date-chip"><span className="date-dot" />{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</div>
            <button className="topbar-avatar" title={user.email}>{initials(profile, user)}</button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{isAdmin ? "ADMIN PORTAL" : "STUDENT PORTAL"}</span>
              <h1>{page === "overview" ? <>Good {greeting()}, {firstName}<span className="wave">✳</span></> : currentInfo.title}</h1>
              <p>{page === "overview" ? "Here’s what’s happening across Chandradip today." : currentInfo.subtitle}</p>
            </div>
            {showCreate && <button className="button button-primary" onClick={openCreate}><Plus size={17} /> Add {currentInfo.singular}</button>}
          </div>

          {notice && <div className={`notice page-notice notice-${notice.kind}`} role="status"><span>{notice.kind === "success" ? <Check size={16} /> : <CircleHelp size={16} />}</span>{notice.text}<button className="icon-button" aria-label="Dismiss" onClick={() => setNotice(null)}><X size={16} /></button></div>}
          {error && <div className="notice page-notice notice-error" role="alert"><CircleHelp size={16} />{error}<button className="button button-small button-quiet" onClick={() => void loadPage(page, user)}>Try again</button></div>}

          {loading && <div className="loading-line"><span /> Loading your campus data…</div>}
          {page === "overview" && (
            isAdmin
              ? <AdminOverview summary={adminSummary} students={students} courses={courses} onNavigate={navigate} />
              : <StudentOverview summary={studentSummary} profile={profile} onNavigate={navigate} />
          )}
          {page === "overview" && !isAdmin && (
            <TodaysScheduleCard entries={timetableEntries} onViewAll={() => navigate("timetable")} />
          )}
          {page === "overview" && !isAdmin && (
            <StudentFeesCard feeAssignments={feeAssignments} onViewAll={() => navigate("fees")} />
          )}
          {page === "overview" && (
            <NoticeBoardPreview notices={latestNotices} onViewAll={() => navigate("notices")} />
          )}
          {page === "sports" && isAdmin && sportsSummary && (
            <SportsDashboardPanel summary={sportsSummary} />
          )}
          {page === "profile" && profile && <ProfileCard profile={profile} user={user} />}
          {page === "profile" && !profile && !loading && <EmptyState title="Student profile not linked" text="Your account is not connected to a student record. Please contact your campus administrator." />}
          {pageRows.length > 0 && page !== "overview" && page !== "profile" && (
            <section className="data-card">
              <div className="table-toolbar">
                <div><h2>{currentInfo.title} <span className="count-pill">{pageRows.length}</span></h2><p>{isAdmin ? "Manage and review your campus records." : "Your academic information, all in one place."}</p></div>
                <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${currentInfo.title.toLowerCase()}…`} /></label>
              </div>
              <DataTable page={page} rows={pageRows} students={students} courses={courses} isAdmin={!!isAdmin} onEdit={openEdit} onDelete={deleteRow} onRecordPayment={openRecordPayment} />
              <div className="table-footer"><span>Showing {pageRows.length} {pageRows.length === 1 ? currentInfo.singular : `${currentInfo.title.toLowerCase()}`}</span><span>Chandradip records <span className="footer-dot">·</span> Updated just now</span></div>
            </section>
          )}
          {!loading && page !== "overview" && page !== "profile" && rows.length === 0 && !error && (
            <EmptyState title={`No ${page === "marks" ? "assessments" : page} yet`} text={isAdmin ? `When you add a ${currentInfo.singular}, it will show up here.` : "Your campus records will appear here when they are available."} action={showCreate ? `Add ${currentInfo.singular}` : undefined} onAction={showCreate ? openCreate : undefined} />
          )}
          {!loading && pageRows.length === 0 && rows.length > 0 && page !== "overview" && page !== "profile" && <EmptyState title="No matches found" text="Try another search term." />}
          <footer className="page-footer"><span>Made for a brighter school day <span className="footer-sun">✳</span></span><span>Chandradip Student Management <span className="footer-dot">·</span> {new Date().getFullYear()}</span></footer>
        </div>
      </main>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModalOpen(false); setPaymentTarget(null); } }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading"><div><span className="eyebrow">{paymentTarget ? "NEW PAYMENT" : editing ? "UPDATE RECORD" : "NEW RECORD"}</span><h2 id="modal-title">{paymentTarget ? "Record course payment" : `${editing ? "Edit" : "Add"} ${currentInfo.singular}`}</h2>{paymentTarget && <p className="payment-modal-context">{paymentTarget.student_name} · {paymentTarget.course_code} · {formatCurrency(paymentTarget.pending_fee)} pending</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={() => { setModalOpen(false); setPaymentTarget(null); }}><X size={20} /></button></div>
            <form onSubmit={saveForm}>
              <div className="modal-fields">
                {page === "fees" && (
                  <span className="field-hint field-full">
                    {courses.some((course) => course.course_fee != null)
                      ? "Course fees are managed in Courses and automatically used for student assignments."
                      : "Set a course fee in Courses before assigning fees to students."}
                  </span>
                )}
                {(paymentTarget ? PAYMENT_FIELDS : fields).map((field) => (
                  field.type === "sport" || field.type === "medal" || field.type === "course-search" ? (
                    <div key={field.name} className={`field-control ${field.full ? "field-full" : ""}`}>
                      <span id={`${field.name}-label`}>{field.label}</span>
                      <SearchableOptionSelect
                        value={formValues[field.name] ?? ""}
                        onChange={(value) => setFormValues((values) => ({ ...values, [field.name]: value }))}
                        labelledBy={`${field.name}-label`}
                        options={field.type === "sport" ? SPORTS : field.type === "medal" ? MEDALS : field.options ?? []}
                        placeholder={field.type === "sport" ? "Choose a sport" : field.type === "medal" ? "Choose a medal or recognition" : "Choose a course"}
                        searchLabel={field.type === "sport" ? "Search sports" : field.type === "medal" ? "Search medal types" : "Search courses"}
                        searchPlaceholder={field.type === "sport" ? "Search sports..." : field.type === "medal" ? "Search medal types..." : "Search by course code or title..."}
                        listLabel={field.type === "sport" ? "Sports" : field.type === "medal" ? "Medal types" : "Courses"}
                        emptyMessage={field.type === "sport" ? "No sports match your search." : field.type === "medal" ? "No medal types match your search." : "No courses match your search."}
                      />
                    </div>
                  ) : (
                    <label key={field.name} className={field.full ? "field-full" : ""}>{field.label}
                      {field.type === "select" ? (
                        <select required={field.required} value={formValues[field.name] ?? ""} onChange={(event) => setFormValues((values) => ({ ...values, [field.name]: event.target.value }))}>
                          <option value="">Choose {field.label.toLowerCase()}</option>
                          {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          required={field.required}
                          maxLength={field.maxLength}
                          rows={4}
                          placeholder={field.placeholder}
                          value={formValues[field.name] ?? ""}
                          onChange={(event) => setFormValues((values) => ({ ...values, [field.name]: event.target.value }))}
                        />
                      ) : (
                        <input type={field.type ?? "text"} required={field.required} min={field.min} step={field.step} placeholder={field.placeholder} value={formValues[field.name] ?? ""} onChange={(event) => setFormValues((values) => ({ ...values, [field.name]: event.target.value }))} />
                      )}
                    </label>
                  )
                ))}
              </div>
              <p className="modal-hint"><ShieldCheck size={15} /> Records are saved securely to your campus account.</p>
              {notice?.kind === "error" && <div className="notice notice-error">{notice.text}</div>}
              <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => { setModalOpen(false); setPaymentTarget(null); }}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : paymentTarget ? "Record payment" : editing ? "Save changes" : "Create record"}<ArrowUpRight size={16} /></button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function initials(profile: Student | null, user: User) {
  if (profile) return `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase();
  return user.email.slice(0, 2).toUpperCase();
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

function defaultValues(fields: Field[], row?: Row | null) {
  const localDate = new Date();
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  return Object.fromEntries(fields.map((field) => {
    const value = row
      ? recordValue(row, field.name)
      : field.type === "date"
        ? localDate.toISOString().slice(0, 10)
        : "";
    const displayValue = value == null ? "" : String(value);
    return [field.name, field.type === "time" ? displayValue.slice(0, 5) : displayValue];
  }));
}

function SearchableOptionSelect({
  value,
  onChange,
  labelledBy,
  options,
  placeholder,
  searchLabel,
  searchPlaceholder,
  listLabel,
  emptyMessage,
}: {
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
  options: readonly (string | { value: string; label: string })[];
  placeholder: string;
  searchLabel: string;
  searchPlaceholder: string;
  listLabel: string;
  emptyMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const optionValue = (option: string | { value: string; label: string }) =>
    typeof option === "string" ? option : option.value;
  const optionLabel = (option: string | { value: string; label: string }) =>
    typeof option === "string" ? option : option.label;
  const filteredOptions = options.filter((option) =>
    optionLabel(option).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const selectedOption = options.find((option) => optionValue(option) === value);

  useEffect(() => {
    if (open) searchInput.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="searchable-select">
      <button
        type="button"
        className="searchable-select-trigger"
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span>{selectedOption ? optionLabel(selectedOption) : placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="searchable-select-menu">
          <div className="searchable-select-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchInput}
              type="search"
              aria-label={searchLabel}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
                if (event.key === "Enter") event.preventDefault();
              }}
            />
          </div>
          <div className="searchable-select-options" role="listbox" aria-label={listLabel}>
            {filteredOptions.length > 0 ? filteredOptions.map((option) => (
              <button
                key={optionValue(option)}
                type="button"
                role="option"
                aria-selected={optionValue(option) === value}
                className="searchable-select-option"
                onClick={() => {
                  onChange(optionValue(option));
                  close();
                }}
              >
                {optionLabel(option)}
              </button>
            )) : (
              <p className="searchable-select-empty">{emptyMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getFields(page: Page, students: Student[], courses: Course[], editing = false): Field[] {
  const studentOptions = students.map((student) => ({ value: String(student.id), label: `${fullName(student)} · ${student.email}` }));
  const courseOptions = courses.map((course) => ({ value: String(course.id), label: `${course.code} · ${course.title}` }));
  const feeCourseOptions = courses.flatMap((course) =>
    course.course_fee == null ? [] : [{
      value: String(course.id),
      label: `${course.code} · ${course.title} · ${formatCurrency(course.course_fee)}`,
    }],
  );
  if (page === "students") return [
    { name: "first_name", label: "First name", required: true, placeholder: "Jordan" },
    { name: "last_name", label: "Last name", required: true, placeholder: "Rivera" },
    { name: "email", label: "Email address", type: "email", required: true, full: true, placeholder: "jordan@school.edu" },
  ];
  if (page === "courses") return [
    { name: "code", label: "Course code", required: true, placeholder: "BIO 204" },
    { name: "title", label: "Course title", required: true, placeholder: "Introduction to Biology" },
    { name: "description", label: "Description", full: true, placeholder: "A short course description" },
    { name: "course_fee", label: "Course fee", type: "number", min: "0.01", step: "0.01", placeholder: "15000.00" },
  ];
  if (page === "notices") return [
    { name: "title", label: "Notice title", required: true, placeholder: "Annual sports day" },
    { name: "notice_date", label: "Notice date", type: "date", required: true },
    { name: "description", label: "Description", type: "textarea", required: true, full: true, maxLength: 2000, placeholder: "Share the details everyone should know..." },
  ];
  if (page === "timetable") return [
    { name: "course_id", label: "Course", type: "course-search", required: true, options: courseOptions, full: true },
    { name: "weekday", label: "Weekday", type: "select", required: true, options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((value) => ({ value, label: value })) },
    { name: "start_time", label: "Lecture starts", type: "time", required: true },
    { name: "end_time", label: "Lecture ends", type: "time", required: true },
    { name: "classroom_number", label: "Classroom number", required: true, placeholder: "Room 204" },
  ];
  if (page === "fees") return [
    { name: "student_id", label: "Student", type: "select", required: true, options: studentOptions },
    { name: "course_id", label: "Course · fee from course catalog", type: "course-search", required: true, options: feeCourseOptions, full: true },
  ];
  if (page === "enrollments") return [
    { name: "student_id", label: "Student", type: "select", required: true, options: studentOptions },
    { name: "course_id", label: "Course", type: "select", required: true, options: courseOptions },
  ];
  if (page === "attendance" && editing) return [
    { name: "status", label: "Status", type: "select", required: true, options: ["present", "absent", "late", "excused"].map((value) => ({ value, label: titleCase(value) })) },
  ];
  if (page === "attendance") return [
    { name: "student_id", label: "Student", type: "select", required: true, options: studentOptions },
    { name: "course_id", label: "Course", type: "select", required: true, options: courseOptions },
    { name: "attendance_date", label: "Attendance date", type: "date", required: true },
    { name: "status", label: "Status", type: "select", required: true, options: ["present", "absent", "late", "excused"].map((value) => ({ value, label: titleCase(value) })) },
  ];
  if (page === "marks" && editing) return [
    { name: "assessment_name", label: "Assessment name", required: true, full: true, placeholder: "Midterm examination" },
    { name: "score", label: "Score", type: "number", required: true, min: "0", step: "0.01", placeholder: "85" },
    { name: "max_score", label: "Maximum score", type: "number", required: true, min: "0.01", step: "0.01", placeholder: "100" },
  ];
  if (page === "marks") return [
    { name: "student_id", label: "Student", type: "select", required: true, options: studentOptions },
    { name: "course_id", label: "Course", type: "select", required: true, options: courseOptions },
    { name: "assessment_name", label: "Assessment name", required: true, full: true, placeholder: "Midterm examination" },
    { name: "score", label: "Score", type: "number", required: true, min: "0", step: "0.01", placeholder: "85" },
    { name: "max_score", label: "Maximum score", type: "number", required: true, min: "0.01", step: "0.01", placeholder: "100" },
  ];
  if (page === "sports" && editing) return [
    { name: "sport_name", label: "Sport", type: "sport", required: true },
    { name: "level", label: "Competition level", type: "select", required: true, options: ["district", "state", "national"].map((value) => ({ value, label: titleCase(value) })) },
    { name: "event_name", label: "Event", placeholder: "100m" },
    { name: "competition_name", label: "Competition", placeholder: "Annual Meet" },
    { name: "achievement_date", label: "Achievement date", type: "date", required: true },
    { name: "result", label: "Medal / recognition", type: "medal", full: true },
  ];
  if (page === "sports") return [
    { name: "student_id", label: "Student", type: "select", required: true, options: studentOptions },
    { name: "sport_name", label: "Sport", type: "sport", required: true },
    { name: "level", label: "Competition level", type: "select", required: true, options: ["district", "state", "national"].map((value) => ({ value, label: titleCase(value) })) },
    { name: "event_name", label: "Event", placeholder: "100m" },
    { name: "competition_name", label: "Competition", placeholder: "Annual Meet" },
    { name: "achievement_date", label: "Achievement date", type: "date", required: true },
    { name: "result", label: "Medal / recognition", type: "medal", full: true },
  ];
  return [];
}

const PAYMENT_FIELDS: Field[] = [
  { name: "amount", label: "Payment amount", type: "number", required: true, min: "0.01", step: "0.01", placeholder: "5000.00" },
  { name: "payment_date", label: "Payment date", type: "date", required: true },
  {
    name: "payment_method",
    label: "Payment method",
    type: "select",
    required: true,
    options: [
      { value: "cash", label: "Cash" },
      { value: "card", label: "Card" },
      { value: "upi", label: "UPI" },
      { value: "bank_transfer", label: "Bank transfer" },
    ],
  },
];

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function AdminOverview({ summary, students, courses, onNavigate }: {
  summary: AdminDashboard | null;
  students: Student[];
  courses: Course[];
  onNavigate: (page: Page) => void;
}) {
  const stats = [
    { label: "Total students", value: summary?.total_students ?? "—", icon: Users, color: "sage", trend: "Chandradip community" },
    { label: "Active courses", value: summary?.total_courses ?? "—", icon: BookOpen, color: "blue", trend: "Across all departments" },
    { label: "Enrollments", value: summary?.total_enrollments ?? "—", icon: GraduationCap, color: "peach", trend: "Student-course matches" },
    { label: "Assessments", value: summary?.total_assessments ?? "—", icon: Award, color: "lavender", trend: "Scores recorded" },
  ];
  return (
    <div className="overview-stack">
      <section className="welcome-banner">
        <div className="banner-copy"><span className="eyebrow">YOUR DAILY BRIEFING</span><h2>Small steps. <em>Big futures.</em></h2><p>Everything Chandradip needs, thoughtfully in one place.</p><button className="button button-banner" onClick={() => onNavigate("students")}>Explore students <ArrowUpRight size={16} /></button></div>
        <div className="banner-art" aria-hidden="true"><div className="art-sun" /><div className="art-arch"><div className="art-window"><span /><span /><span /><span /></div></div><div className="art-book art-book-one" /><div className="art-book art-book-two" /><div className="art-stem stem-one" /><div className="art-stem stem-two" /><span className="art-sparkle sparkle-one">✳</span><span className="art-sparkle sparkle-two">✦</span></div>
      </section>
      <div className="section-title-row"><div><span className="eyebrow">AT A GLANCE</span><h2>Chandradip, by the numbers</h2></div><span className="updated-chip"><span className="date-dot" /> Live snapshot</span></div>
      <section className="stat-grid">
        {stats.map(({ label, value, icon: Icon, color, trend }, index) => <article className="stat-card" key={label}><div className={`stat-icon stat-${color}`}><Icon size={19} /></div><span className="stat-label">{label}</span><div className="stat-value">{value}</div><div className="stat-meta">{index % 2 === 0 ? <ArrowUpRight size={14} /> : <Activity size={14} />}{trend}</div></article>)}
      </section>
      <section className="overview-bottom">
        <article className="summary-card"><div className="card-heading"><div><span className="eyebrow">TODAY</span><h2>Attendance check-in</h2></div><span className="round-icon"><CalendarCheck size={18} /></span></div><div className="attendance-highlight"><div className="attendance-number">{summary?.attendance_records_today ?? "—"}</div><span>attendance records<br />logged today</span></div><div className="simple-progress"><span style={{ width: summary?.total_students ? `${Math.min(100, (summary.attendance_records_today / summary.total_students) * 100)}%` : "0%" }} /></div><p className="muted-caption">A good day to show up and shine.</p><button className="inline-link" onClick={() => onNavigate("attendance")}>View attendance <ArrowUpRight size={15} /></button></article>
        <article className="summary-card"><div className="card-heading"><div><span className="eyebrow">RECENTLY ADDED</span><h2>New faces & courses</h2></div><span className="round-icon round-icon-peach"><Sparkles size={18} /></span></div><div className="recent-list">{students.slice(-3).reverse().map((student) => <div className="recent-row" key={`student-${student.id}`}><span className="recent-avatar">{student.first_name[0]}{student.last_name[0]}</span><span className="recent-copy"><b>{fullName(student)}</b><small>New student</small></span><ArrowUpRight size={14} /></div>)}{students.length === 0 && <p className="empty-inline">Your campus stories start here.</p>}{courses.slice(0, 1).map((course) => <div className="recent-row" key={`course-${course.id}`}><span className="recent-avatar recent-avatar-blue"><BookOpen size={15} /></span><span className="recent-copy"><b>{course.title}</b><small>{course.code} · Course</small></span><ArrowUpRight size={14} /></div>)}</div><button className="inline-link" onClick={() => onNavigate("courses")}>Browse courses <ArrowUpRight size={15} /></button></article>
      </section>
    </div>
  );
}

function StudentOverview({ summary, profile, onNavigate }: {
  summary: StudentDashboard | null;
  profile: Student | null;
  onNavigate: (page: Page) => void;
}) {
  const cards = [
    { label: "Enrolled courses", value: summary?.enrolled_courses ?? "—", icon: BookOpen, color: "sage", hint: "Keep your curiosity going" },
    { label: "Attendance", value: summary ? `${summary.attendance_percentage}%` : "—", icon: CalendarCheck, color: "blue", hint: `${summary?.attendance_records ?? 0} class check-ins` },
    { label: "Assessments", value: summary?.assessments_recorded ?? "—", icon: ClipboardList, color: "peach", hint: "Every effort counts" },
    { label: "Average score", value: summary?.average_percentage == null ? "—" : `${summary.average_percentage}%`, icon: Award, color: "lavender", hint: "Keep up the great work" },
  ];
  return (
    <div className="overview-stack">
      <section className="welcome-banner student-banner"><div className="banner-copy"><span className="eyebrow">YOUR LEARNING SPACE</span><h2>Keep growing, <em>{profile?.first_name ?? "scholar"}.</em></h2><p>Your progress is made of all the little things you show up for.</p><button className="button button-banner" onClick={() => onNavigate("results")}>See my results <ArrowUpRight size={16} /></button></div><div className="student-art" aria-hidden="true"><div className="student-art-circle"><GraduationCap size={66} strokeWidth={1.1} /></div><span className="student-art-star star-a">✳</span><span className="student-art-star star-b">✦</span><div className="student-art-ground" /></div></section>
      <div className="section-title-row"><div><span className="eyebrow">YOUR PROGRESS</span><h2>Look how far you&apos;ve come</h2></div><button className="inline-link" onClick={() => onNavigate("profile")}>My profile <ArrowUpRight size={15} /></button></div>
      <section className="stat-grid">{cards.map(({ label, value, icon: Icon, color, hint }) => <article className="stat-card" key={label}><div className={`stat-icon stat-${color}`}><Icon size={19} /></div><span className="stat-label">{label}</span><div className="stat-value">{value}</div><div className="stat-meta">{hint}</div></article>)}</section>
      <section className="student-next"><div className="next-icon"><Sparkles size={19} /></div><div><span className="eyebrow">A LITTLE REMINDER</span><h2>Progress isn&apos;t always loud.</h2><p>Showing up, asking questions, and trying again — that&apos;s where the good stuff happens.</p></div><button className="button button-quiet" onClick={() => onNavigate("courses")}>Explore courses <ArrowUpRight size={16} /></button></section>
    </div>
  );
}

function TodaysScheduleCard({
  entries,
  onViewAll,
}: {
  entries: TimetableEntry[];
  onViewAll: () => void;
}) {
  const weekday = currentWeekday();
  const todaysEntries = entries
    .filter((entry) => entry.weekday === weekday)
    .sort((left, right) => left.start_time.localeCompare(right.start_time));

  return (
    <section className="timetable-today-card" aria-labelledby="today-schedule-title">
      <div className="timetable-today-header">
        <div className="timetable-today-icon"><CalendarDays size={20} /></div>
        <div>
          <span className="eyebrow">YOUR CLASSES</span>
          <h2 id="today-schedule-title">Today&apos;s Schedule</h2>
          <p>{weekday ?? "Sunday"} · {new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(new Date())}</p>
        </div>
        <button className="inline-link" onClick={onViewAll}>Full timetable <ArrowUpRight size={15} /></button>
      </div>
      {todaysEntries.length > 0 ? (
        <div className="timetable-today-list">
          {todaysEntries.slice(0, 5).map((entry) => (
            <article className="timetable-today-item" key={entry.id}>
              <div className="timetable-today-time">
                <b>{formatLectureTime(entry.start_time)}</b>
                <span>{formatLectureTime(entry.end_time)}</span>
              </div>
              <div className="timetable-today-subject">
                <b>{entry.course_title}</b>
                <span><BookOpen size={13} /> {entry.course_code} <MapPin size={13} /> {entry.classroom_number}</span>
              </div>
              <Clock3 className="timetable-today-clock" size={17} />
            </article>
          ))}
          {todaysEntries.length > 5 && (
            <button className="inline-link timetable-more-link" onClick={onViewAll}>
              View {todaysEntries.length - 5} more classes <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      ) : (
        <p className="timetable-today-empty">
          {weekday
            ? "There are no classes scheduled for today."
            : "Enjoy your Sunday. Your Monday–Saturday timetable is ready to view."}
        </p>
      )}
    </section>
  );
}

function StudentFeesCard({
  feeAssignments,
  onViewAll,
}: {
  feeAssignments: FeeAssignment[];
  onViewAll: () => void;
}) {
  const totals = feeAssignments.reduce(
    (result, fee) => ({
      total: result.total + Number(fee.total_fee),
      paid: result.paid + Number(fee.paid_fee),
      pending: result.pending + Number(fee.pending_fee),
    }),
    { total: 0, paid: 0, pending: 0 },
  );

  return (
    <section className="fees-summary-card" aria-labelledby="student-fees-title">
      <div className="fees-summary-header">
        <div>
          <span className="eyebrow">ACCOUNT SUMMARY</span>
          <h2 id="student-fees-title"><CreditCard size={19} /> My Course Fees</h2>
          <p>Review your course charges and payment progress.</p>
        </div>
        <button className="inline-link" onClick={onViewAll}>Fee details <ArrowUpRight size={15} /></button>
      </div>
      {feeAssignments.length > 0 ? (
        <>
          <div className="fees-total-grid">
            <div><span>Total fees</span><b>{formatCurrency(totals.total)}</b></div>
            <div><span>Paid</span><b>{formatCurrency(totals.paid)}</b></div>
            <div><span>Pending</span><b>{formatCurrency(totals.pending)}</b></div>
          </div>
          <div className="fees-summary-list">
            {feeAssignments.map((fee) => (
              <article className="fees-summary-row" key={fee.id}>
                <div className="fees-summary-course">
                  <b>{fee.course_title}</b>
                  <small>{fee.course_code} · Paid {formatCurrency(fee.paid_fee)} of {formatCurrency(fee.total_fee)}</small>
                </div>
                <span className={`fee-status fee-status-${fee.status.toLowerCase()}`}>{fee.status}</span>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="fees-summary-empty">Your course fee details will appear here when they are available.</p>
      )}
    </section>
  );
}

function NoticeBoardPreview({
  notices,
  onViewAll,
}: {
  notices: Notice[];
  onViewAll: () => void;
}) {
  return (
    <section className="notice-board-card" aria-labelledby="latest-notices-title">
      <div className="notice-board-header">
        <div>
          <span className="eyebrow">CAMPUS UPDATES</span>
          <h2 id="latest-notices-title"><Bell size={18} /> Notice Board</h2>
          <p>Latest announcements and important dates.</p>
        </div>
        <button className="button button-quiet" onClick={onViewAll}>View all notices <ArrowUpRight size={15} /></button>
      </div>
      {notices.length > 0 ? (
        <div className="notice-board-list">
          {notices.map((item) => (
            <article className="notice-board-item" key={item.id}>
              <div className="notice-date"><CalendarCheck size={15} /><time dateTime={item.notice_date}>{formatDate(item.notice_date)}</time></div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="notice-board-empty">There are no notices to display right now.</p>
      )}
    </section>
  );
}

function SportsDashboardPanel({ summary }: { summary: SportsDashboard }) {
  const stats = [
    { label: "Athletes", value: summary.total_athletes },
    { label: "Achievements", value: summary.total_achievements },
    { label: "District athletes", value: summary.district_athletes },
    { label: "State athletes", value: summary.state_athletes },
    { label: "National athletes", value: summary.national_athletes },
    { label: "District achievements", value: summary.district_achievements },
    { label: "State achievements", value: summary.state_achievements },
    { label: "National achievements", value: summary.national_achievements },
  ];
  return (
    <section className="overview-stack">
      <div className="section-title-row">
        <div><span className="eyebrow">SPORTS DASHBOARD</span><h2>Participation & achievements</h2></div>
      </div>
      <section className="stat-grid">
        {stats.map(({ label, value }) => (
          <article className="stat-card" key={label}>
            <div className="stat-icon stat-lavender"><Award size={19} /></div>
            <span className="stat-label">{label}</span>
            <div className="stat-value">{value}</div>
          </article>
        ))}
      </section>
      <section className="overview-bottom">
        <article className="summary-card">
          <div className="card-heading"><div><span className="eyebrow">BY SPORT</span><h2>Participation</h2></div><span className="round-icon"><Activity size={18} /></span></div>
          {summary.sport_breakdown.length > 0 ? (
            <div className="recent-list">
              {summary.sport_breakdown.map((sport) => (
                <div className="recent-row" key={sport.sport_name}>
                  <span className="recent-avatar recent-avatar-blue"><Award size={15} /></span>
                  <span className="recent-copy"><b>{sport.sport_name}</b><small>{sport.athlete_count} athletes · {sport.achievement_count} achievements</small></span>
                </div>
              ))}
            </div>
          ) : <p className="empty-inline">Sports participation will appear here.</p>}
        </article>
        <article className="summary-card">
          <div className="card-heading"><div><span className="eyebrow">RECENT</span><h2>Latest achievements</h2></div><span className="round-icon round-icon-peach"><Sparkles size={18} /></span></div>
          {summary.recent_achievements.length > 0 ? (
            <div className="recent-list">
              {summary.recent_achievements.map((achievement) => (
                <div className="recent-row" key={achievement.id}>
                  <span className="recent-avatar">{achievement.student_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                  <span className="recent-copy"><b>{achievement.student_name} · {achievement.sport_name}</b><small>{titleCase(achievement.level)} · {formatDate(achievement.achievement_date)}{achievement.result ? ` · ${achievement.result}` : ""}</small></span>
                </div>
              ))}
            </div>
          ) : <p className="empty-inline">No achievements have been recorded yet.</p>}
        </article>
      </section>
    </section>
  );
}

function ProfileCard({ profile, user }: { profile: Student; user: User }) {
  return <section className="profile-card"><div className="profile-banner"><div className="profile-large-avatar">{profile.first_name[0]}{profile.last_name[0]}</div><span className="role-tag"><ShieldCheck size={14} /> Student account</span></div><div className="profile-details"><span className="eyebrow">STUDENT PROFILE</span><h2>{fullName(profile)}</h2><p>Your campus identity and account details.</p><div className="profile-detail-grid"><div><span>Student ID</span><b>#{profile.id}</b></div><div><span>Email address</span><b>{profile.email}</b></div><div><span>Account role</span><b>{titleCase(user.role)}</b></div><div><span>Member since</span><b>{formatDate(profile.created_at)}</b></div></div></div></section>;
}

function DataTable({ page, rows, students, courses, isAdmin, onEdit, onDelete, onRecordPayment }: {
  page: Page;
  rows: Row[];
  students: Student[];
  courses: Course[];
  isAdmin: boolean;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  onRecordPayment: (row: FeeAssignment) => void;
}) {
  const studentLabel = (id: unknown) => fullName(students.find((student) => student.id === Number(id)));
  const courseLabel = (id: unknown) => {
    const course = courses.find((item) => item.id === Number(id));
    return course ? `${course.code} · ${course.title}` : "Unknown course";
  };
  const columns: { key: string; label: string; render?: (row: Row) => ReactNode }[] =
    page === "students" ? [
      { key: "first_name", label: "Student", render: (row) => <div className="table-person"><span className="person-avatar">{String(recordValue(row, "first_name") ?? "")[0]}{String(recordValue(row, "last_name") ?? "")[0]}</span><span><b>{String(recordValue(row, "first_name") ?? "")} {String(recordValue(row, "last_name") ?? "")}</b><small>Student #{String(recordValue(row, "id") ?? "")}</small></span></div> },
      { key: "email", label: "Email address" },
      { key: "created_at", label: "Joined", render: (row) => formatDate(recordValue(row, "created_at")) },
    ] : page === "courses" ? [
      { key: "code", label: "Course code", render: (row) => <span className="course-code">{String(recordValue(row, "code") ?? "")}</span> },
      { key: "title", label: "Course title", render: (row) => <div className="table-main"><b>{String(recordValue(row, "title") ?? "")}</b><small>{String(recordValue(row, "description") || "No description added")}</small></div> },
      { key: "course_fee", label: "Course fee", render: (row) => recordValue(row, "course_fee") == null ? "Not set" : formatCurrency(String(recordValue(row, "course_fee"))) },
    ] : page === "enrollments" ? [
      { key: "student_id", label: "Student", render: (row) => studentLabel(recordValue(row, "student_id")) },
      { key: "course_id", label: "Course", render: (row) => courseLabel(recordValue(row, "course_id")) },
      { key: "enrolled_at", label: "Enrolled", render: (row) => formatDate(recordValue(row, "enrolled_at")) },
    ] : page === "attendance" ? [
      { key: "student_id", label: "Student", render: (row) => studentLabel(recordValue(row, "student_id")) },
      { key: "course_id", label: "Course", render: (row) => courseLabel(recordValue(row, "course_id")) },
      { key: "attendance_date", label: "Date", render: (row) => formatDate(recordValue(row, "attendance_date")) },
      { key: "status", label: "Status", render: (row) => <span className={`status-pill status-${recordValue(row, "status")}`}><span />{titleCase(String(recordValue(row, "status") ?? ""))}</span> },
    ] : page === "marks" ? [
      { key: "student_id", label: "Student", render: (row) => studentLabel(recordValue(row, "student_id")) },
      { key: "course_id", label: "Course", render: (row) => courseLabel(recordValue(row, "course_id")) },
      { key: "assessment_name", label: "Assessment" },
      { key: "score", label: "Score", render: (row) => <span className="score-value">{String(recordValue(row, "score") ?? "—")} <small>/ {String(recordValue(row, "max_score") ?? "—")}</small></span> },
    ] : page === "sports" ? [
      ...(isAdmin ? [{ key: "student_id", label: "Student", render: (row: Row) => studentLabel(recordValue(row, "student_id")) }] : []),
      { key: "sport_name", label: "Sport" },
      { key: "level", label: "Level", render: (row) => <span className="status-pill"><span />{titleCase(String(recordValue(row, "level") ?? ""))}</span> },
      { key: "event_name", label: "Event" },
      { key: "competition_name", label: "Competition" },
      { key: "achievement_date", label: "Date", render: (row) => formatDate(recordValue(row, "achievement_date")) },
      { key: "result", label: "Result" },
    ] : page === "notices" ? [
      { key: "title", label: "Title", render: (row) => <strong>{String(recordValue(row, "title") ?? "")}</strong> },
      { key: "description", label: "Description", render: (row) => <span className="notice-table-description">{String(recordValue(row, "description") ?? "")}</span> },
      { key: "notice_date", label: "Date", render: (row) => formatDate(recordValue(row, "notice_date")) },
    ] : page === "timetable" ? [
      { key: "course_title", label: "Course", render: (row) => <div className="table-main"><b>{String(recordValue(row, "course_title") ?? "")}</b><small>{String(recordValue(row, "course_code") ?? "")}</small></div> },
      { key: "weekday", label: "Day", render: (row) => <span className={`timetable-day ${recordValue(row, "weekday") === currentWeekday() ? "timetable-day-today" : ""}`}>{String(recordValue(row, "weekday") ?? "")}</span> },
      { key: "start_time", label: "Lecture time", render: (row) => `${formatLectureTime(String(recordValue(row, "start_time") ?? ""))} – ${formatLectureTime(String(recordValue(row, "end_time") ?? ""))}` },
      { key: "classroom_number", label: "Classroom" },
    ] : page === "fees" ? [
      ...(isAdmin ? [{ key: "student_name", label: "Student", render: (row: Row) => <div className="table-main"><b>{String(recordValue(row, "student_name") ?? "")}</b><small>Student #{String(recordValue(row, "student_id") ?? "")}</small></div> }] : []),
      { key: "course_title", label: "Course", render: (row) => <div className="table-main"><b>{String(recordValue(row, "course_title") ?? "")}</b><small>{String(recordValue(row, "course_code") ?? "")}</small></div> },
      { key: "total_fee", label: "Total fee", render: (row) => formatCurrency(String(recordValue(row, "total_fee") ?? "0")) },
      { key: "paid_fee", label: "Paid", render: (row) => formatCurrency(String(recordValue(row, "paid_fee") ?? "0")) },
      { key: "pending_fee", label: "Pending", render: (row) => formatCurrency(String(recordValue(row, "pending_fee") ?? "0")) },
      { key: "status", label: "Status", render: (row) => {
        const feeStatus = String(recordValue(row, "status") ?? "Pending");
        return <span className={`fee-status fee-status-${feeStatus.toLowerCase()}`}>{feeStatus}</span>;
      } },
      { key: "payments", label: "Payment history", render: (row) => {
        const payments = recordValue(row, "payments");
        if (!Array.isArray(payments) || payments.length === 0) return "No payments";
        return <div className="fee-payment-history">{(payments as FeeAssignment["payments"]).map((payment) => (
          <span key={payment.id}>{formatCurrency(payment.amount)} · {formatDate(payment.payment_date)} · {titleCase(payment.payment_method.replace("_", " "))}</span>
        ))}</div>;
      } },
    ] : [
      { key: "course_code", label: "Course", render: (row) => <div className="table-main"><span className="course-code">{String(recordValue(row, "course_code") ?? "")}</span><small>{String(recordValue(row, "course_title") ?? "")}</small></div> },
      ...(isAdmin ? [{ key: "student_id", label: "Student", render: (row: Row) => studentLabel(recordValue(row, "student_id")) }] : []),
      { key: "assessment_count", label: "Assessments" },
      { key: "average_percentage", label: "Average", render: (row) => <span className="score-value">{String(recordValue(row, "average_percentage") ?? "—")}%</span> },
      { key: "grade", label: "Grade", render: (row) => <span className={`grade-pill grade-${String(recordValue(row, "grade") ?? "")}`}>{String(recordValue(row, "grade") ?? "")}</span> },
    ];

  return <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{isAdmin && page !== "results" && <th className="actions-column">Actions</th>}</tr></thead><tbody>
    {rows.map((row) => <tr className={page === "timetable" && recordValue(row, "weekday") === currentWeekday() ? "timetable-row-today" : ""} key={String(recordValue(row, "id") ?? `${recordValue(row, "student_id")}-${recordValue(row, "course_id")}`)}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : String(recordValue(row, column.key) ?? "—")}</td>)}{isAdmin && page !== "results" && <td><div className="row-actions">{page === "fees" ? <button className="button button-small button-primary" disabled={Number(recordValue(row, "pending_fee")) <= 0} onClick={() => onRecordPayment(row as FeeAssignment)}>Record payment</button> : <><button className="button button-small button-quiet" onClick={() => onEdit(row)}>Edit</button><button className="button button-small button-danger" onClick={() => onDelete(row)}>Delete</button></>}</div></td>}</tr>)}
  </tbody></table></div>;
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <section className="empty-state"><div className="empty-illustration"><BookOpen size={27} strokeWidth={1.5} /><span>✳</span></div><h2>{title}</h2><p>{text}</p>{action && onAction && <button className="button button-primary" onClick={onAction}><Plus size={16} />{action}</button>}</section>;
}

export default App;
