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
  Download,
  Eye,
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
  Department,
  Entity,
  Enrollment,
  FeeAssignment,
  Mark,
  Notice,
  PrincipalDashboard,
  HODDashboard,
  Student,
  StudentDashboard,
  SportsAchievement,
  SportsDashboard,
  TimetableEntry,
  Teacher,
  TeacherCourse,
  TeacherDashboard,
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
  | "departments"
  | "teachers"
  | "teacher-courses"
  | "profile";
type Row = Entity;
type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "date" | "time" | "select" | "sport" | "medal" | "course-search" | "department-search" | "textarea";
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
  departments: {
    title: "Departments",
    singular: "department",
    icon: BookOpen,
    subtitle: "Organize courses and HOD access by department.",
  },
  teachers: {
    title: "Teachers",
    singular: "teacher",
    icon: Users,
    subtitle: "Manage department teaching staff.",
  },
  "teacher-courses": {
    title: "Teacher Course Assignments",
    singular: "teacher course assignment",
    icon: GraduationCap,
    subtitle: "Assign courses to teachers within their department.",
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
  "departments",
  "teachers",
  "teacher-courses",
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
const PRINCIPAL_NAV: Page[] = [
  "overview",
  "students",
  "courses",
  "enrollments",
  "attendance",
  "marks",
  "results",
  "fees",
];
const HOD_NAV: Page[] = [
  "overview",
  "students",
  "courses",
  "teachers",
  "enrollments",
  "attendance",
  "marks",
  "results",
  "fees",
];
const TEACHER_NAV: Page[] = [
  "overview",
  "courses",
  "students",
  "attendance",
  "marks",
  "results",
];

type PrincipalReportData = {
  enrollments: Enrollment[];
  attendance: Attendance[];
  marks: Mark[];
  results: CourseResult[];
  fees: FeeAssignment[];
};

async function fetchAll<T>(path: string, pageSize = 100): Promise<T[]> {
  const records: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await api<T[]>(`${path}?offset=${offset}&limit=${pageSize}`);
    records.push(...page);
    if (page.length < pageSize) return records;
  }
}

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

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escapeCell = (value: string) => {
    const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replace(/"/g, '""')}"`;
  };
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          <span>AcademicHub<span className="brand-period">.</span></span>
        </div>
        <div className="story-copy">
          <span className="eyebrow story-eyebrow"><Sparkles size={14} /> AcademicHub, in sync</span>
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
          <span>AcademicHub<span className="brand-period">.</span></span>
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
            {mode === "login" ? <>New to AcademicHub? <button className="text-button" onClick={() => { setMode("register"); setMessage(null); }}>Create an account</button></> :
              <>Already have an account? <button className="text-button" onClick={() => { setMode("login"); setResetSent(false); setMessage(null); }}>Sign in</button></>}
          </div>
          <p className="auth-footnote"><ShieldCheck size={14} /> Your academic information stays private and secure.</p>
        </div>
        <span className="auth-copyright">© {new Date().getFullYear()} AcademicHub Student Management</span>
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [adminSummary, setAdminSummary] = useState<AdminDashboard | null>(null);
  const [studentSummary, setStudentSummary] = useState<StudentDashboard | null>(null);
  const [principalSummary, setPrincipalSummary] = useState<PrincipalDashboard | null>(null);
  const [hodSummary, setHodSummary] = useState<HODDashboard | null>(null);
  const [teacherSummary, setTeacherSummary] = useState<TeacherDashboard | null>(null);
  const [principalReportData, setPrincipalReportData] = useState<PrincipalReportData | null>(null);
  const [selectedPrincipalStudent, setSelectedPrincipalStudent] = useState<Student | null>(null);
  const [attendanceThreshold, setAttendanceThreshold] = useState(75);
  const [sportsSummary, setSportsSummary] = useState<SportsDashboard | null>(null);
  const [latestNotices, setLatestNotices] = useState<Notice[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [feeAssignments, setFeeAssignments] = useState<FeeAssignment[]>([]);
  const [profile, setProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Message | null>(null);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<FeeAssignment | null>(null);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isPrincipal = user?.role === "principal";
  const isHod = user?.role === "hod";
  const isTeacher = user?.role === "teacher";
  const navItems = isAdmin ? ADMIN_NAV : isPrincipal ? PRINCIPAL_NAV : isHod ? HOD_NAV : isTeacher ? TEACHER_NAV : STUDENT_NAV;
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
          const [summary, noticesList, studentList, courseList, departmentList] = await Promise.all([
            api<AdminDashboard>("/dashboard/admin"),
            api<Notice[]>("/notices?limit=5"),
            api<Student[]>("/students?limit=100"),
            api<Course[]>("/courses?limit=100"),
            api<Department[]>("/departments?limit=100"),
          ]);
          setAdminSummary(summary);
          setLatestNotices(noticesList);
          setStudents(studentList);
          setCourses(courseList);
          setDepartments(departmentList);
        } else if (activeUser.role === "principal") {
          const [
            summary,
            studentList,
            courseList,
            enrollmentsList,
            attendanceList,
            marksList,
            resultsList,
            feesList,
          ] = await Promise.all([
            api<PrincipalDashboard>("/dashboard/principal"),
            fetchAll<Student>("/students"),
            fetchAll<Course>("/courses"),
            fetchAll<Enrollment>("/enrollments"),
            fetchAll<Attendance>("/attendance"),
            fetchAll<Mark>("/marks"),
            api<CourseResult[]>("/results"),
            fetchAll<FeeAssignment>("/fees", 200),
          ]);
          setPrincipalSummary(summary);
          setStudents(studentList);
          setCourses(courseList);
          setFeeAssignments(feesList);
          setPrincipalReportData({
            enrollments: enrollmentsList,
            attendance: attendanceList,
            marks: marksList,
            results: resultsList,
            fees: feesList,
          });
        } else if (activeUser.role === "teacher") {
          const [
            summary,
            studentList,
            courseList,
            enrollmentList,
            attendanceList,
            marksList,
            resultList,
          ] = await Promise.all([
            api<TeacherDashboard>("/dashboard/teacher"),
            fetchAll<Student>("/students"),
            fetchAll<Course>("/courses"),
            fetchAll<Enrollment>("/enrollments"),
            fetchAll<Attendance>("/attendance"),
            fetchAll<Mark>("/marks"),
            api<CourseResult[]>("/results"),
          ]);
          setTeacherSummary(summary);
          setStudents(studentList);
          setCourses(courseList);
          setPrincipalReportData({
            enrollments: enrollmentList,
            attendance: attendanceList,
            marks: marksList,
            results: resultList,
            fees: [],
          });
        } else if (activeUser.role === "hod") {
          const [
            summary,
            studentList,
            courseList,
            departmentList,
            teacherList,
            enrollmentsList,
            attendanceList,
            marksList,
            resultsList,
            feesList,
          ] = await Promise.all([
            api<HODDashboard>("/dashboard/hod"),
            fetchAll<Student>("/students"),
            fetchAll<Course>("/courses"),
            api<Department[]>("/departments?limit=100"),
            fetchAll<Teacher>("/teachers"),
            fetchAll<Enrollment>("/enrollments"),
            fetchAll<Attendance>("/attendance"),
            fetchAll<Mark>("/marks"),
            api<CourseResult[]>("/results"),
            fetchAll<FeeAssignment>("/fees", 200),
          ]);
          setHodSummary(summary);
          setStudents(studentList);
          setCourses(courseList);
          setDepartments(departmentList);
          setTeachers(teacherList);
          setFeeAssignments(feesList);
          setPrincipalReportData({
            enrollments: enrollmentsList,
            attendance: attendanceList,
            marks: marksList,
            results: resultsList,
            fees: feesList,
          });
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
        setRows(activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher"
          ? await fetchAll<Student>("/students")
          : await api<Student[]>("/students?limit=100"));
      } else if (target === "courses") {
        const list = activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher"
          ? await fetchAll<Course>("/courses")
          : await api<Course[]>("/courses?limit=100");
        setCourses(list);
        if (activeUser.role === "admin") {
          setDepartments(await fetchAll<Department>("/departments"));
        }
        setRows(list);
      } else if (target === "departments") {
        const list = await api<Department[]>("/departments?limit=100");
        setDepartments(list);
        setRows(list);
      } else if (target === "teachers") {
        const listPromise = fetchAll<Teacher>("/teachers");
        const departmentsPromise = activeUser.role === "admin"
          ? fetchAll<Department>("/departments")
          : Promise.resolve(null);
        const [list, departmentList] = await Promise.all([listPromise, departmentsPromise]);
        setTeachers(list);
        if (departmentList) setDepartments(departmentList);
        setRows(list);
      } else if (target === "teacher-courses") {
        const [assignmentList, teacherList, courseList] = await Promise.all([
          fetchAll<TeacherCourse>("/teachers/assignments"),
          fetchAll<Teacher>("/teachers"),
          fetchAll<Course>("/courses"),
        ]);
        setTeachers(teacherList);
        setCourses(courseList);
        setRows(assignmentList);
      } else if (target === "enrollments") {
        const [list, studentList, courseList] = await Promise.all([
          activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher" ? fetchAll<Enrollment>("/enrollments") : api<Enrollment[]>("/enrollments?limit=100"),
          activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher" ? fetchAll<Student>("/students") : api<Student[]>("/students?limit=100"),
          activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher" ? fetchAll<Course>("/courses") : api<Course[]>("/courses?limit=100"),
        ]);
        setStudents(studentList);
        setCourses(courseList);
        setRows(list);
      } else if (target === "attendance") {
        const [list, studentList, courseList] = await Promise.all([
          activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher" ? fetchAll<Attendance>("/attendance") : api<Attendance[]>("/attendance?limit=100"),
          activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher" ? fetchAll<Student>("/students") : api<Student[]>("/students?limit=100"),
          activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher" ? fetchAll<Course>("/courses") : api<Course[]>("/courses?limit=100"),
        ]);
        setStudents(studentList);
        setCourses(courseList);
        setRows(list);
      } else if (target === "marks") {
        const [list, studentList, courseList] = await Promise.all([
          activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher" ? fetchAll<Mark>("/marks") : api<Mark[]>("/marks?limit=100"),
          activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher" ? fetchAll<Student>("/students") : api<Student[]>("/students?limit=100"),
          activeUser.role === "principal" || activeUser.role === "hod" || activeUser.role === "teacher" ? fetchAll<Course>("/courses") : api<Course[]>("/courses?limit=100"),
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
          activeUser.role === "principal" || activeUser.role === "hod" ? fetchAll<FeeAssignment>("/fees", 200) : api<FeeAssignment[]>("/fees?limit=200"),
          activeUser.role === "admin"
            ? api<Student[]>("/students?limit=100")
            : activeUser.role === "principal" || activeUser.role === "hod" ? fetchAll<Student>("/students") : Promise.resolve([]),
          activeUser.role === "admin"
            ? api<Course[]>("/courses?limit=100")
            : activeUser.role === "principal" || activeUser.role === "hod" ? fetchAll<Course>("/courses") : Promise.resolve([]),
        ]);
        setFeeAssignments(feeList);
        setRows(feeList);
        if (activeUser.role === "admin" || activeUser.role === "hod") {
          setStudents(studentList);
          setCourses(courseList);
        }
      } else if (target === "results") {
        const [list, studentList, courseList] = await Promise.all([
          api<CourseResult[]>("/results"),
          activeUser.role === "principal" || activeUser.role === "hod" ? fetchAll<Student>("/students") : api<Student[]>("/students?limit=100"),
          activeUser.role === "principal" || activeUser.role === "hod" ? fetchAll<Course>("/courses") : api<Course[]>("/courses?limit=100"),
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
    setLogoutConfirmOpen(false);
    tokenStore.clear();
    setUser(null);
    setRows([]);
    setNotice(null);
    setPage("overview");
  }

  function navigate(target: Page) {
    setPage(target);
    setSearch("");
    setCourseFilter("all");
    setNotice(null);
    setMobileNavOpen(false);
  }

  const pageRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const rowCourseId = Number(recordValue(row, "course_id"));
      const matchesCourse = courseFilter === "all"
        || (page === "students"
          ? principalReportData?.enrollments.some(
              (enrollment) => enrollment.student_id === Number(recordValue(row, "id"))
                && enrollment.course_id === Number(courseFilter),
            ) === true
          : page === "courses"
            ? Number(recordValue(row, "id")) === Number(courseFilter)
            : rowCourseId === Number(courseFilter));
      if (!matchesCourse) return false;
      if (!term) return true;
      const studentId = Number(recordValue(row, "student_id"));
      const courseId = page === "courses" ? Number(recordValue(row, "id")) : rowCourseId;
      const student = students.find((item) => item.id === studentId);
      const course = courses.find((item) => item.id === courseId);
      const teacher = teachers.find(
        (item) => item.id === Number(recordValue(row, "teacher_id")),
      );
      const enrolledStudents = page === "courses"
        ? principalReportData?.enrollments
            .filter((enrollment) => enrollment.course_id === courseId)
            .map((enrollment) => students.find((item) => item.id === enrollment.student_id))
            .filter((item): item is Student => item !== undefined)
            .map((item) => `${item.first_name} ${item.last_name} ${item.email}`)
            .join(" ")
        : "";
      const enrolledCourses = page === "students"
        ? principalReportData?.enrollments
            .filter((enrollment) => enrollment.student_id === Number(recordValue(row, "id")))
            .map((enrollment) => courses.find((item) => item.id === enrollment.course_id))
            .filter((item): item is Course => item !== undefined)
            .map((item) => `${item.code} ${item.title}`)
            .join(" ")
        : "";
      const searchableValues = [
        ...Object.values(row).map((value) => String(value ?? "")),
        student ? `${student.first_name} ${student.last_name} ${student.email}` : "",
        course ? `${course.code} ${course.title}` : "",
        teacher ? `${teacher.name} ${teacher.email}` : "",
        enrolledStudents ?? "",
        enrolledCourses ?? "",
      ];
      return searchableValues.some((value) => value.toLowerCase().includes(term));
    });
  }, [rows, search, courseFilter, page, principalReportData, students, courses, teachers]);

  const fields = useMemo(
    () => getFields(page, students, courses, Boolean(editing), departments, teachers),
    [page, students, courses, editing, departments, teachers],
  );

  function openCreate() {
    setPaymentTarget(null);
    setPaymentIdempotencyKey("");
    setEditing(null);
    setFormValues(defaultValues(getFields(page, students, courses, false, departments, teachers)));
    setModalOpen(true);
  }

  function openEdit(row: Row) {
    setPaymentTarget(null);
    setPaymentIdempotencyKey("");
    setEditing(row);
    setFormValues(defaultValues(getFields(page, students, courses, true, departments, teachers), row));
    setModalOpen(true);
  }

  function openRecordPayment(row: FeeAssignment) {
    setEditing(null);
    setPaymentTarget(row);
    setPaymentIdempotencyKey(crypto.randomUUID());
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
    if (
      page === "teachers" &&
      !formValues.department_id
    ) {
      setNotice({ kind: "error", text: "Choose a department for this teacher." });
      return;
    }
    if (paymentTarget) {
      setSaving(true);
      setNotice(null);
      try {
        const paymentResult = await api<{ replayed: boolean }>(`/fees/${paymentTarget.id}/payments`, {
          method: "POST",
          body: JSON.stringify({
            amount: Number(formValues.amount),
            payment_date: formValues.payment_date,
            payment_method: formValues.payment_method,
            idempotency_key: paymentIdempotencyKey,
          }),
        });
        setModalOpen(false);
        setPaymentTarget(null);
        setPaymentIdempotencyKey("");
        setNotice({
          kind: "success",
          text: paymentResult.replayed
            ? "This payment was already recorded; the existing payment was returned."
            : "Payment recorded successfully.",
        });
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
        ["student_id", "course_id", "department_id", "teacher_id", "score", "max_score", "course_fee"].includes(key) && value !== ""
          ? Number(value)
          : value,
      ]),
    );
    if ("description" in payload && payload.description === "") payload.description = null;
    if ("course_fee" in payload && payload.course_fee === "") payload.course_fee = null;
    if ("department_id" in payload && payload.department_id === "") payload.department_id = null;
    for (const field of ["event_name", "competition_name", "result"]) {
      if (field in payload && payload[field] === "") payload[field] = null;
    }
    if (unchangedLegacyResult) delete payload.result;
    const pathByPage: Partial<Record<Page, string>> = {
      students: "/students",
      courses: "/courses",
      departments: "/departments",
      teachers: "/teachers",
      "teacher-courses": "/teachers/assignments",
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
      const requestPath = page === "teacher-courses"
        ? `/teachers/${payload.teacher_id}/courses`
        : `${path}${editing ? `/${recordValue(editing, "id")}` : ""}`;
      const requestBody = page === "teacher-courses"
        ? { course_id: payload.course_id }
        : payload;
      await api(requestPath, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(requestBody),
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
      departments: "/departments",
      teachers: "/teachers",
      "teacher-courses": "/teachers/assignments",
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
      const requestPath = page === "teacher-courses"
        ? `/teachers/${recordValue(row, "teacher_id")}/courses/${recordValue(row, "course_id")}`
        : `${path}/${id}`;
      await api(requestPath, { method: "DELETE" });
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
  const showCreate = (isAdmin && ["students", "courses", "enrollments", "attendance", "marks", "sports", "notices", "timetable", "fees", "departments", "teachers", "teacher-courses"].includes(page))
    || (isTeacher && ["attendance", "marks"].includes(page));

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark"><GraduationCap size={21} /></span>
          <span>AcademicHub<span className="brand-period">.</span></span>
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
            <div className="user-copy"><b>{profile ? fullName(profile) : user.email.split("@")[0]}</b><span>{isAdmin ? "Administrator" : isPrincipal ? "Principal" : isHod ? "Head of Department" : isTeacher ? "Teacher" : "Student"}</span></div>
            <button className="icon-button logout-button" aria-label="Sign out" title="Sign out" onClick={() => setLogoutConfirmOpen(true)}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>AcademicHub</span><span className="breadcrumb-slash">/</span><b>{currentInfo.title}</b></div>
          <div className="topbar-right">
            <div className="date-chip"><span className="date-dot" />{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</div>
            <button className="topbar-avatar" title={user.email}>{initials(profile, user)}</button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{isAdmin ? "ADMIN PORTAL" : isPrincipal ? "PRINCIPAL PORTAL" : isHod ? "HOD PORTAL" : isTeacher ? "TEACHER PORTAL" : "STUDENT PORTAL"}</span>
              <h1>{page === "overview" ? <>Good {greeting()}, {firstName}<span className="wave">✳</span></> : currentInfo.title}</h1>
              <p>{page === "overview" ? "Here’s what’s happening across AcademicHub today." : currentInfo.subtitle}</p>
            </div>
            {showCreate && <button className="button button-primary" onClick={openCreate}><Plus size={17} /> Add {currentInfo.singular}</button>}
          </div>

          {notice && <div className={`notice page-notice notice-${notice.kind}`} role="status"><span>{notice.kind === "success" ? <Check size={16} /> : <CircleHelp size={16} />}</span>{notice.text}<button className="icon-button" aria-label="Dismiss" onClick={() => setNotice(null)}><X size={16} /></button></div>}
          {error && <div className="notice page-notice notice-error" role="alert"><CircleHelp size={16} />{error}<button className="button button-small button-quiet" onClick={() => void loadPage(page, user)}>Try again</button></div>}

          {loading && <div className="loading-line"><span /> Loading your campus data…</div>}
          {page === "overview" && (
            isAdmin
              ? <AdminOverview summary={adminSummary} students={students} courses={courses} onNavigate={navigate} />
              : isPrincipal
                ? <PrincipalOverview
                  summary={principalSummary}
                  reports={principalReportData}
                  students={students}
                  courses={courses}
                  attendanceThreshold={attendanceThreshold}
                  onAttendanceThresholdChange={setAttendanceThreshold}
                  onViewStudent={(studentId) => {
                    setSelectedPrincipalStudent(students.find((student) => student.id === studentId) ?? null);
                  }}
                  onNavigate={navigate}
                />
                : isHod
                  ? <HODOverview
                    summary={hodSummary}
                    reports={principalReportData}
                    students={students}
                    courses={courses}
                    teachers={teachers}
                    attendanceThreshold={attendanceThreshold}
                    onAttendanceThresholdChange={setAttendanceThreshold}
                    onViewStudent={(studentId) => {
                      setSelectedPrincipalStudent(students.find((student) => student.id === studentId) ?? null);
                    }}
                    onNavigate={navigate}
                  />
                  : isTeacher
                    ? <TeacherOverview
                      summary={teacherSummary}
                      courses={courses}
                      students={students}
                      reports={principalReportData}
                      onNavigate={navigate}
                    />
                : <StudentOverview summary={studentSummary} profile={profile} onNavigate={navigate} />
          )}
          {page === "overview" && user.role === "student" && (
            <TodaysScheduleCard entries={timetableEntries} onViewAll={() => navigate("timetable")} />
          )}
          {page === "overview" && user.role === "student" && (
            <StudentFeesCard feeAssignments={feeAssignments} onViewAll={() => navigate("fees")} />
          )}
          {page === "overview" && !isPrincipal && !isHod && !isTeacher && (
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
                <div><h2>{currentInfo.title} <span className="count-pill">{pageRows.length}</span></h2><p>{isAdmin ? "Manage and review your campus records." : isPrincipal ? "Campus records · Read-only" : isHod ? "Department records · Read-only" : isTeacher ? (page === "attendance" || page === "marks" ? "Assigned-course records · You can add or update records." : "Assigned-course records · Read-only") : "Your academic information, all in one place."}</p></div>
                <div className="table-filters">
                  {(isPrincipal || isHod) && (
                    <label className="course-filter">
                      <span className="sr-only">Filter by course</span>
                      <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                        <option value="all">All courses</option>
                        {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${currentInfo.title.toLowerCase()}…`} /></label>
                </div>
              </div>
              <DataTable
                page={page}
                rows={pageRows}
                students={students}
                courses={courses}
                departments={departments}
                teachers={teachers}
                enrollments={principalReportData?.enrollments ?? []}
                isAdmin={!!isAdmin}
                isPrincipal={isPrincipal || isHod || isTeacher}
                canManageAcademicRecords={isTeacher && (page === "attendance" || page === "marks")}
                onViewStudent={(studentId) => {
                  setSelectedPrincipalStudent(students.find((student) => student.id === studentId) ?? null);
                }}
                onEdit={openEdit}
                onDelete={deleteRow}
                onRecordPayment={openRecordPayment}
              />
              <div className="table-footer"><span>Showing {pageRows.length} {pageRows.length === 1 ? currentInfo.singular : `${currentInfo.title.toLowerCase()}`}</span><span>AcademicHub records <span className="footer-dot">·</span> Updated just now</span></div>
            </section>
          )}
          {!loading && page !== "overview" && page !== "profile" && rows.length === 0 && !error && (
            <EmptyState title={`No ${page === "marks" ? "assessments" : page} yet`} text={isAdmin ? `When you add a ${currentInfo.singular}, it will show up here.` : "Your campus records will appear here when they are available."} action={showCreate ? `Add ${currentInfo.singular}` : undefined} onAction={showCreate ? openCreate : undefined} />
          )}
          {!loading && pageRows.length === 0 && rows.length > 0 && page !== "overview" && page !== "profile" && <EmptyState title="No matches found" text="Try another search term." />}
          <footer className="page-footer"><span>Made for a brighter school day <span className="footer-sun">✳</span></span><span>AcademicHub Student Management <span className="footer-dot">·</span> {new Date().getFullYear()}</span></footer>
        </div>
      </main>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModalOpen(false); setPaymentTarget(null); setPaymentIdempotencyKey(""); } }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading"><div><span className="eyebrow">{paymentTarget ? "NEW PAYMENT" : editing ? "UPDATE RECORD" : "NEW RECORD"}</span><h2 id="modal-title">{paymentTarget ? "Record course payment" : `${editing ? "Edit" : "Add"} ${currentInfo.singular}`}</h2>{paymentTarget && <p className="payment-modal-context">{paymentTarget.student_name} · {paymentTarget.course_code} · {formatCurrency(paymentTarget.pending_fee)} pending</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={() => { setModalOpen(false); setPaymentTarget(null); setPaymentIdempotencyKey(""); }}><X size={20} /></button></div>
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
                  field.type === "sport" || field.type === "medal" || field.type === "course-search" || field.type === "department-search" ? (
                    <div key={field.name} className={`field-control ${field.full ? "field-full" : ""}`}>
                      <span id={`${field.name}-label`}>{field.label}</span>
                      <SearchableOptionSelect
                        value={formValues[field.name] ?? ""}
                        onChange={(value) => setFormValues((values) => ({ ...values, [field.name]: value }))}
                        labelledBy={`${field.name}-label`}
                        options={field.type === "sport" ? SPORTS : field.type === "medal" ? MEDALS : field.options ?? []}
                        placeholder={field.type === "sport" ? "Choose a sport" : field.type === "medal" ? "Choose a medal or recognition" : field.type === "department-search" ? "Choose a department" : "Choose a course"}
                        searchLabel={field.type === "sport" ? "Search sports" : field.type === "medal" ? "Search medal types" : field.type === "department-search" ? "Search departments" : "Search courses"}
                        searchPlaceholder={field.type === "sport" ? "Search sports..." : field.type === "medal" ? "Search medal types..." : field.type === "department-search" ? "Search by department name..." : "Search by course code or title..."}
                        listLabel={field.type === "sport" ? "Sports" : field.type === "medal" ? "Medal types" : field.type === "department-search" ? "Departments" : "Courses"}
                        emptyMessage={field.type === "sport" ? "No sports match your search." : field.type === "medal" ? "No medal types match your search." : field.type === "department-search" ? "No departments match your search." : "No courses match your search."}
                      />
                    </div>
                  ) : (
                    <label key={field.name} className={field.full ? "field-full" : ""}>{field.label}
                      {field.type === "select" ? (
                        <select required={field.required} value={formValues[field.name] ?? ""} onChange={(event) => {
                          setFormValues((values) => ({ ...values, [field.name]: event.target.value }));
                          if (paymentTarget) setPaymentIdempotencyKey(crypto.randomUUID());
                        }}>
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
                          onChange={(event) => {
                            setFormValues((values) => ({ ...values, [field.name]: event.target.value }));
                            if (paymentTarget) setPaymentIdempotencyKey(crypto.randomUUID());
                          }}
                        />
                      ) : (
                        <input type={field.type ?? "text"} required={field.required} min={field.min} step={field.step} placeholder={field.placeholder} value={formValues[field.name] ?? ""} onChange={(event) => {
                          setFormValues((values) => ({ ...values, [field.name]: event.target.value }));
                          if (paymentTarget) setPaymentIdempotencyKey(crypto.randomUUID());
                        }} />
                      )}
                    </label>
                  )
                ))}
              </div>
              <p className="modal-hint"><ShieldCheck size={15} /> Records are saved securely to your campus account.</p>
              {notice?.kind === "error" && <div className="notice notice-error">{notice.text}</div>}
              <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => { setModalOpen(false); setPaymentTarget(null); setPaymentIdempotencyKey(""); }}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : paymentTarget ? "Record payment" : editing ? "Save changes" : "Create record"}<ArrowUpRight size={16} /></button></div>
            </form>
          </section>
        </div>
      )}
      {(isPrincipal || isHod || isTeacher) && selectedPrincipalStudent && principalReportData && (
        <PrincipalStudentDetails
          student={selectedPrincipalStudent}
          reports={principalReportData}
          courses={courses}
          showFees={!isTeacher}
          onClose={() => setSelectedPrincipalStudent(null)}
        />
      )}
      {logoutConfirmOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLogoutConfirmOpen(false);
          }}
        >
          <section
            className="modal logout-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
            aria-describedby="logout-modal-description"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">SIGN OUT</span>
                <h2 id="logout-modal-title">Log out of AcademicHub?</h2>
              </div>
            </div>
            <p id="logout-modal-description" className="logout-confirm-copy">
              Are you sure you want to end your current session?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={handleLogout}
              >
                Yes, Logout <LogOut size={16} />
              </button>
            </div>
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

function getFields(
  page: Page,
  students: Student[],
  courses: Course[],
  editing = false,
  departments: Department[] = [],
  teachers: Teacher[] = [],
): Field[] {
  const studentOptions = students.map((student) => ({ value: String(student.id), label: `${fullName(student)} · ${student.email}` }));
  const courseOptions = courses.map((course) => ({ value: String(course.id), label: `${course.code} · ${course.title}` }));
  const departmentOptions = departments.map((department) => ({
    value: String(department.id),
    label: department.name,
  }));
  const teacherOptions = teachers.map((teacher) => ({
    value: String(teacher.id),
    label: `${teacher.name} · ${teacher.email}`,
  }));
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
    { name: "department_id", label: "Department", type: "department-search", options: departmentOptions },
  ];
  if (page === "departments") return [
    { name: "name", label: "Department name", required: true, full: true, placeholder: "Computer Science" },
  ];
  if (page === "teachers") return [
    { name: "name", label: "Teacher name", required: true, placeholder: "Alex Morgan" },
    { name: "email", label: "Email address", type: "email", required: true, placeholder: "alex@college.edu" },
    { name: "department_id", label: "Department", type: "department-search", required: true, options: departmentOptions },
  ];
  if (page === "teacher-courses") return [
    { name: "teacher_id", label: "Teacher", type: "select", required: true, options: teacherOptions },
    { name: "course_id", label: "Course", type: "course-search", required: true, options: courseOptions, full: true },
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
    { label: "Total students", value: summary?.total_students ?? "—", icon: Users, color: "sage", trend: "AcademicHub community" },
    { label: "Active courses", value: summary?.total_courses ?? "—", icon: BookOpen, color: "blue", trend: "Across all departments" },
    { label: "Enrollments", value: summary?.total_enrollments ?? "—", icon: GraduationCap, color: "peach", trend: "Student-course matches" },
    { label: "Assessments", value: summary?.total_assessments ?? "—", icon: Award, color: "lavender", trend: "Scores recorded" },
  ];
  return (
    <div className="overview-stack">
      <section className="welcome-banner">
        <div className="banner-copy"><span className="eyebrow">YOUR DAILY BRIEFING</span><h2>Small steps. <em>Big futures.</em></h2><p>Everything AcademicHub needs, thoughtfully in one place.</p><button className="button button-banner" onClick={() => onNavigate("students")}>Explore students <ArrowUpRight size={16} /></button></div>
        <div className="banner-art" aria-hidden="true"><div className="art-sun" /><div className="art-arch"><div className="art-window"><span /><span /><span /><span /></div></div><div className="art-book art-book-one" /><div className="art-book art-book-two" /><div className="art-stem stem-one" /><div className="art-stem stem-two" /><span className="art-sparkle sparkle-one">✳</span><span className="art-sparkle sparkle-two">✦</span></div>
      </section>
      <div className="section-title-row"><div><span className="eyebrow">AT A GLANCE</span><h2>AcademicHub, by the numbers</h2></div><span className="updated-chip"><span className="date-dot" /> Live snapshot</span></div>
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

function HODOverview({
  summary,
  reports,
  students,
  courses,
  teachers,
  attendanceThreshold,
  onAttendanceThresholdChange,
  onViewStudent,
  onNavigate,
}: {
  summary: HODDashboard | null;
  reports: PrincipalReportData | null;
  students: Student[];
  courses: Course[];
  teachers: Teacher[];
  attendanceThreshold: number;
  onAttendanceThresholdChange: (threshold: number) => void;
  onViewStudent: (studentId: number) => void;
  onNavigate: (page: Page) => void;
}) {
  const stats = [
    { label: "Department students", value: summary?.total_students ?? "—", icon: Users },
    { label: "Department courses", value: summary?.total_courses ?? "—", icon: BookOpen },
    { label: "Teachers", value: summary?.total_teachers ?? "—", icon: GraduationCap },
    { label: "Enrollments", value: summary?.total_enrollments ?? "—", icon: ClipboardList },
    { label: "Attendance records", value: summary?.total_attendance ?? "—", icon: CalendarCheck },
    { label: "Marks recorded", value: summary?.total_marks ?? "—", icon: Award },
    { label: "Course results", value: summary?.total_results ?? "—", icon: ClipboardList },
  ];
  const lowAttendance = reports
    ? students.flatMap((student) => {
        const records = reports.attendance.filter((record) => record.student_id === student.id);
        if (!records.length) return [];
        const attended = records.filter((record) => record.status === "present" || record.status === "late").length;
        const percentage = attended / records.length * 100;
        return percentage < attendanceThreshold
          ? [{ student, records: records.length, percentage }]
          : [];
      }).sort((left, right) => left.percentage - right.percentage)
    : [];
  const courseSummaries = courses.map((course) => {
    const marks = reports?.marks.filter((mark) => mark.course_id === course.id) ?? [];
    const results = reports?.results.filter((result) => result.course_id === course.id) ?? [];
    const attendance = reports?.attendance.filter((record) => record.course_id === course.id) ?? [];
    const average = marks.length
      ? marks.reduce((sum, mark) => sum + mark.score / mark.max_score * 100, 0) / marks.length
      : null;
    const passRate = results.length
      ? results.filter((result) => result.grade !== "F").length / results.length * 100
      : null;
    const attendanceRate = attendance.length
      ? attendance.filter((record) => record.status === "present" || record.status === "late").length / attendance.length * 100
      : null;
    return { course, average, passRate, attendanceRate };
  });

  return (
    <div className="overview-stack">
      <section className="welcome-banner">
        <div className="banner-copy">
          <span className="eyebrow">DEPARTMENT DASHBOARD</span>
          <h2>{summary?.department_name ?? "Department overview"}</h2>
          <p>Read-only view of department students, teaching staff, and academic performance.</p>
          <button className="button button-banner" onClick={() => onNavigate("students")}>View students <ArrowUpRight size={16} /></button>
        </div>
        <div className="banner-art" aria-hidden="true"><div className="art-sun" /><div className="art-arch"><div className="art-window"><span /><span /><span /><span /></div></div><div className="art-book art-book-one" /><div className="art-book art-book-two" /><div className="art-stem stem-one" /><div className="art-stem stem-two" /></div>
      </section>
      <section className="stat-grid">
        {stats.map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <div className="stat-icon stat-blue"><Icon size={19} /></div>
            <span className="stat-label">{label}</span>
            <div className="stat-value">{value}</div>
            <div className="stat-meta">Assigned department only</div>
          </article>
        ))}
      </section>
      <section className="data-card">
        <div className="table-toolbar">
          <div><h2>Department teachers <span className="count-pill">{teachers.length}</span></h2><p>Teachers assigned to your department.</p></div>
          <button className="button button-quiet" onClick={() => onNavigate("teachers")}>View teachers <ArrowUpRight size={15} /></button>
        </div>
        {teachers.length ? (
          <div className="table-scroll"><table>
            <thead><tr><th>Name</th><th>Email</th></tr></thead>
            <tbody>{teachers.slice(0, 8).map((teacher) => (
              <tr key={teacher.id}><td>{teacher.name}</td><td>{teacher.email}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <p className="principal-empty-report">No teachers are assigned to this department.</p>}
      </section>
      <section className="data-card">
        <div className="table-toolbar">
          <div><h2>Low attendance <span className="count-pill">{lowAttendance.length}</span></h2><p>Students below the selected attendance threshold.</p></div>
          <label className="threshold-control"><span>Threshold</span>
            <input aria-label="Low attendance threshold percentage" type="number" min="0" max="100" value={attendanceThreshold}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value >= 0 && value <= 100) onAttendanceThresholdChange(value);
              }} />
            <span>%</span>
          </label>
        </div>
        {lowAttendance.length ? (
          <div className="table-scroll"><table>
            <thead><tr><th>Student</th><th>Attendance</th><th>Records</th><th>Details</th></tr></thead>
            <tbody>{lowAttendance.map(({ student, records, percentage }) => (
              <tr key={student.id}>
                <td><div className="table-main"><b>{fullName(student)}</b><small>#{student.id} · {student.email}</small></div></td>
                <td><span className="status-pill status-absent">{percentage.toFixed(1)}%</span></td>
                <td>{records}</td>
                <td><button className="button button-small button-quiet" onClick={() => onViewStudent(student.id)}><Eye size={14} /> View details</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="principal-empty-report">{reports ? "No students are below the attendance threshold." : "Attendance report is loading."}</p>}
      </section>
      <section className="data-card">
        <div className="table-toolbar"><div><h2>Course-wise academic performance</h2><p>Attendance, marks, and grade summaries for department courses.</p></div></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Course</th><th>Average marks</th><th>Pass rate</th><th>Attendance</th></tr></thead>
          <tbody>{courseSummaries.map(({ course, average, passRate, attendanceRate }) => (
            <tr key={course.id}>
              <td><div className="table-main"><b>{course.title}</b><small>{course.code}</small></div></td>
              <td>{average == null ? "No marks" : `${average.toFixed(1)}%`}</td>
              <td>{passRate == null ? "No results" : `${passRate.toFixed(1)}%`}</td>
              <td>{attendanceRate == null ? "No records" : `${attendanceRate.toFixed(1)}%`}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
    </div>
  );
}

function TeacherOverview({
  summary,
  courses,
  students,
  reports,
  onNavigate,
}: {
  summary: TeacherDashboard | null;
  courses: Course[];
  students: Student[];
  reports: PrincipalReportData | null;
  onNavigate: (page: Page) => void;
}) {
  const stats = [
    { label: "Assigned courses", value: summary?.total_courses ?? "—", icon: BookOpen },
    { label: "Enrolled students", value: summary?.total_students ?? "—", icon: Users },
    { label: "Enrollments", value: summary?.total_enrollments ?? "—", icon: GraduationCap },
    { label: "Attendance records", value: summary?.total_attendance ?? "—", icon: CalendarCheck },
    { label: "Marks recorded", value: summary?.total_marks ?? "—", icon: ClipboardList },
    { label: "Course results", value: summary?.total_results ?? "—", icon: Award },
  ];
  return (
    <div className="overview-stack">
      <section className="welcome-banner">
        <div className="banner-copy">
          <span className="eyebrow">TEACHER DASHBOARD</span>
          <h2>Your courses, your students.</h2>
          <p>Manage attendance and marks for students enrolled in your assigned courses.</p>
          <button className="button button-banner" onClick={() => onNavigate("courses")}>View assigned courses <ArrowUpRight size={16} /></button>
        </div>
        <div className="banner-art" aria-hidden="true"><div className="art-sun" /><div className="art-arch"><div className="art-window"><span /><span /><span /><span /></div></div><div className="art-book art-book-one" /><div className="art-book art-book-two" /><div className="art-stem stem-one" /><div className="art-stem stem-two" /></div>
      </section>
      <section className="stat-grid">
        {stats.map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <div className="stat-icon stat-blue"><Icon size={19} /></div>
            <span className="stat-label">{label}</span>
            <div className="stat-value">{value}</div>
            <div className="stat-meta">Assigned courses only</div>
          </article>
        ))}
      </section>
      <section className="data-card">
        <div className="table-toolbar">
          <div><h2>Assigned courses <span className="count-pill">{courses.length}</span></h2><p>Students and academic records are limited to these courses.</p></div>
        </div>
        {courses.length ? (
          <div className="table-scroll"><table>
            <thead><tr><th>Course</th><th>Department ID</th><th>Enrolled students</th><th>Actions</th></tr></thead>
            <tbody>{courses.map((course) => {
              const enrolled = reports?.enrollments
                .filter((item) => item.course_id === course.id)
                .map((item) => students.find((student) => student.id === item.student_id))
                .filter((student): student is Student => student !== undefined) ?? [];
              return (
                <tr key={course.id}>
                  <td><div className="table-main"><b>{course.title}</b><small>{course.code}</small></div></td>
                  <td>{course.department_id ?? "—"}</td>
                  <td>{enrolled.length}</td>
                  <td>
                    <div className="row-actions">
                      <button className="button button-small button-quiet" onClick={() => onNavigate("attendance")}>Attendance</button>
                      <button className="button button-small button-quiet" onClick={() => onNavigate("marks")}>Marks</button>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <p className="principal-empty-report">No courses are assigned to this teacher account.</p>}
      </section>
      <section className="principal-shortcuts">
        {([
          ["students", Users],
          ["attendance", CalendarCheck],
          ["marks", ClipboardList],
          ["results", Award],
        ] as const).map(([target, Icon]) => (
          <button className="principal-shortcut" key={target} onClick={() => onNavigate(target)}>
            <Icon size={18} /><span>{PAGE_INFO[target].title}</span><ArrowUpRight size={15} />
          </button>
        ))}
      </section>
    </div>
  );
}

function PrincipalOverview({
  summary,
  reports,
  students,
  courses,
  attendanceThreshold,
  onAttendanceThresholdChange,
  onViewStudent,
  onNavigate,
}: {
  summary: PrincipalDashboard | null;
  reports: PrincipalReportData | null;
  students: Student[];
  courses: Course[];
  attendanceThreshold: number;
  onAttendanceThresholdChange: (threshold: number) => void;
  onViewStudent: (studentId: number) => void;
  onNavigate: (page: Page) => void;
}) {
  const studentById = (studentId: number) => students.find((student) => student.id === studentId);
  const courseById = (courseId: number) => courses.find((course) => course.id === courseId);
  const stats = [
    { label: "Total students", value: summary?.total_students ?? "—", icon: Users, color: "sage" },
    { label: "Total courses", value: summary?.total_courses ?? "—", icon: BookOpen, color: "blue" },
    { label: "Attendance records", value: summary?.total_attendance ?? "—", icon: CalendarCheck, color: "peach" },
    { label: "Marks recorded", value: summary?.total_marks ?? "—", icon: ClipboardList, color: "lavender" },
    { label: "Course results", value: summary?.total_results ?? "—", icon: Award, color: "sage" },
    { label: "Course enrollments", value: reports?.enrollments.length ?? "—", icon: GraduationCap, color: "blue" },
  ];
  const attendanceRate = reports && reports.attendance.length > 0
    ? Math.round(
        reports.attendance.filter((item) => item.status === "present" || item.status === "late").length
          / reports.attendance.length * 100,
      )
    : null;
  const averageMark = reports && reports.marks.length > 0
    ? reports.marks.reduce((total, item) => total + item.score / item.max_score * 100, 0)
      / reports.marks.length
    : null;
  const passRate = reports && reports.results.length > 0
    ? reports.results.filter((item) => item.grade !== "F").length / reports.results.length * 100
    : null;
  const pendingFees = reports
    ? reports.fees.reduce((total, item) => total + Number(item.pending_fee), 0)
    : null;
  const lowAttendanceStudents = reports
    ? students.flatMap((student) => {
        const records = reports.attendance.filter((item) => item.student_id === student.id);
        if (records.length === 0) return [];
        const attended = records.filter((item) => item.status === "present" || item.status === "late").length;
        const percentage = attended / records.length * 100;
        return percentage < attendanceThreshold ? [{ student, records: records.length, percentage }] : [];
      }).sort((left, right) => left.percentage - right.percentage)
    : [];
  const coursePerformance = courses.map((course) => {
    const courseMarks = reports?.marks.filter((item) => item.course_id === course.id) ?? [];
    const courseResults = reports?.results.filter((item) => item.course_id === course.id) ?? [];
    const courseAttendance = reports?.attendance.filter((item) => item.course_id === course.id) ?? [];
    const average = courseMarks.length
      ? courseMarks.reduce((total, item) => total + item.score / item.max_score * 100, 0) / courseMarks.length
      : null;
    const passRate = courseResults.length
      ? courseResults.filter((item) => item.grade !== "F").length / courseResults.length * 100
      : null;
    const attendanceRate = courseAttendance.length
      ? courseAttendance.filter((item) => item.status === "present" || item.status === "late").length / courseAttendance.length * 100
      : null;
    return { course, average, passRate, attendanceRate, assessments: courseMarks.length, results: courseResults.length };
  });

  function exportAttendance() {
    if (!reports) return;
    downloadCsv("attendance-report.csv",
      ["Student ID", "Student", "Email", "Course code", "Course", "Date", "Status"],
      reports.attendance.map((record) => {
        const student = studentById(record.student_id);
        const course = courseById(record.course_id);
        return [
          String(record.student_id),
          fullName(student),
          student?.email ?? "",
          course?.code ?? "",
          course?.title ?? "",
          record.attendance_date,
          record.status,
        ];
      }),
    );
  }

  function exportMarks() {
    if (!reports) return;
    downloadCsv("marks-report.csv",
      ["Student ID", "Student", "Email", "Course code", "Course", "Assessment", "Score", "Maximum score", "Percentage"],
      reports.marks.map((mark) => {
        const student = studentById(mark.student_id);
        const course = courseById(mark.course_id);
        return [
          String(mark.student_id),
          fullName(student),
          student?.email ?? "",
          course?.code ?? "",
          course?.title ?? "",
          mark.assessment_name,
          String(mark.score),
          String(mark.max_score),
          `${(mark.score / mark.max_score * 100).toFixed(2)}%`,
        ];
      }),
    );
  }

  function exportResults() {
    if (!reports) return;
    downloadCsv("results-report.csv",
      ["Student ID", "Student", "Email", "Course code", "Course", "Assessments", "Average percentage", "Grade"],
      reports.results.map((result) => {
        const student = studentById(result.student_id);
        return [
          String(result.student_id),
          fullName(student),
          student?.email ?? "",
          result.course_code,
          result.course_title,
          String(result.assessment_count),
          `${result.average_percentage.toFixed(2)}%`,
          result.grade,
        ];
      }),
    );
  }

  return (
    <div className="overview-stack">
      <section className="welcome-banner">
        <div className="banner-copy">
          <span className="eyebrow">PRINCIPAL DASHBOARD</span>
          <h2>Campus at a glance.</h2>
          <p>A read-only view of student records and academic performance.</p>
          <button className="button button-banner" onClick={() => onNavigate("students")}>View student records <ArrowUpRight size={16} /></button>
        </div>
        <div className="banner-art" aria-hidden="true"><div className="art-sun" /><div className="art-arch"><div className="art-window"><span /><span /><span /><span /></div></div><div className="art-book art-book-one" /><div className="art-book art-book-two" /><div className="art-stem stem-one" /><div className="art-stem stem-two" /><span className="art-sparkle sparkle-one">✳</span><span className="art-sparkle sparkle-two">✦</span></div>
      </section>
      <div className="section-title-row">
        <div><span className="eyebrow">ACADEMIC OVERVIEW</span><h2>Campus, by the numbers</h2></div>
        <span className="updated-chip"><span className="date-dot" /> Read-only snapshot</span>
      </div>
      <section className="stat-grid principal-stat-grid">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon stat-${color}`}><Icon size={19} /></div>
            <span className="stat-label">{label}</span>
            <div className="stat-value">{value}</div>
            <div className="stat-meta">Current total</div>
          </article>
        ))}
      </section>
      <div className="section-title-row">
        <div><span className="eyebrow">ACADEMIC PERFORMANCE</span><h2>Learning and attendance report</h2></div>
      </div>
      <section className="stat-grid principal-report-grid">
        {[
          { label: "Attendance rate", value: attendanceRate == null ? "—" : `${attendanceRate}%`, hint: "Present or late records" },
          { label: "Average marks", value: averageMark == null ? "—" : `${averageMark.toFixed(1)}%`, hint: "Across recorded assessments" },
          { label: "Course pass rate", value: passRate == null ? "—" : `${passRate.toFixed(1)}%`, hint: "Results graded A–D" },
          { label: "Pending fees", value: pendingFees == null ? "—" : formatCurrency(pendingFees), hint: reports?.fees.length ? `${reports.fees.length} fee assignments` : "No fee assignments" },
        ].map((report) => (
          <article className="stat-card" key={report.label}>
            <span className="stat-label">{report.label}</span>
            <div className="stat-value">{report.value}</div>
            <div className="stat-meta">{report.hint}</div>
          </article>
        ))}
      </section>
      <section className="data-card">
        <div className="table-toolbar">
          <div>
            <h2>Low attendance <span className="count-pill">{lowAttendanceStudents.length}</span></h2>
            <p>Students with recorded attendance below the selected threshold.</p>
          </div>
          <label className="threshold-control">
            <span>Threshold</span>
            <input
              aria-label="Low attendance threshold percentage"
              type="number"
              min="0"
              max="100"
              step="1"
              value={attendanceThreshold}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value >= 0 && value <= 100) onAttendanceThresholdChange(value);
              }}
            />
            <span>%</span>
          </label>
        </div>
        {lowAttendanceStudents.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Student</th><th>Attendance</th><th>Records</th><th>Details</th></tr></thead>
              <tbody>
                {lowAttendanceStudents.map(({ student, records, percentage }) => (
                  <tr key={student.id}>
                    <td><div className="table-main"><b>{fullName(student)}</b><small>#{student.id} · {student.email}</small></div></td>
                    <td><span className="status-pill status-absent">{percentage.toFixed(1)}%</span></td>
                    <td>{records}</td>
                    <td><button className="button button-small button-quiet" onClick={() => onViewStudent(student.id)}><Eye size={14} /> View details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="principal-empty-report">
            {reports ? "No students are below the attendance threshold." : "Attendance report is loading."}
          </p>
        )}
      </section>
      <section className="data-card">
        <div className="table-toolbar">
          <div><h2>Course-wise academic performance</h2><p>Real attendance and assessment data for each course.</p></div>
        </div>
        {coursePerformance.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Course</th><th>Assessments</th><th>Average marks</th><th>Pass rate</th><th>Attendance</th></tr></thead>
              <tbody>
                {coursePerformance.map(({ course, average, assessments, passRate, attendanceRate }) => (
                  <tr key={course.id}>
                    <td><div className="table-main"><b>{course.title}</b><small>{course.code}</small></div></td>
                    <td>{assessments}</td>
                    <td>{average == null ? "No marks" : `${average.toFixed(1)}%`}</td>
                    <td>{passRate == null ? "No results" : `${passRate.toFixed(1)}%`}</td>
                    <td>{attendanceRate == null ? "No records" : `${attendanceRate.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="principal-empty-report">No courses are available.</p>
        )}
      </section>
      <section className="principal-export-card">
        <div><span className="eyebrow">DOWNLOAD REPORTS</span><h2>Export academic records</h2><p>Download the latest read-only records as CSV files.</p></div>
        <div className="principal-export-actions">
          <button className="button button-quiet" disabled={!reports} onClick={exportAttendance}><Download size={15} /> Attendance CSV</button>
          <button className="button button-quiet" disabled={!reports} onClick={exportMarks}><Download size={15} /> Marks CSV</button>
          <button className="button button-quiet" disabled={!reports} onClick={exportResults}><Download size={15} /> Results CSV</button>
        </div>
      </section>
      <div className="section-title-row">
        <div><span className="eyebrow">READ-ONLY RECORDS</span><h2>Explore campus information</h2></div>
      </div>
      <section className="principal-shortcuts">
        {([
          ["students", Users],
          ["courses", BookOpen],
          ["attendance", CalendarCheck],
          ["marks", ClipboardList],
          ["results", Award],
          ["fees", CreditCard],
        ] as const).map(([target, Icon]) => (
          <button className="principal-shortcut" key={target} onClick={() => onNavigate(target)}>
            <Icon size={18} />
            <span>{PAGE_INFO[target].title}</span>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </section>
    </div>
  );
}

function PrincipalStudentDetails({
  student,
  reports,
  courses,
  showFees = true,
  onClose,
}: {
  student: Student;
  reports: PrincipalReportData;
  courses: Course[];
  showFees?: boolean;
  onClose: () => void;
}) {
  const enrollments = reports.enrollments.filter((item) => item.student_id === student.id);
  const attendance = reports.attendance.filter((item) => item.student_id === student.id);
  const marks = reports.marks.filter((item) => item.student_id === student.id);
  const results = reports.results.filter((item) => item.student_id === student.id);
  const fees = reports.fees.filter((item) => item.student_id === student.id);
  const courseLabel = (courseId: number) => {
    const course = courses.find((item) => item.id === courseId);
    return course ? `${course.code} · ${course.title}` : `Course #${courseId}`;
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal principal-student-modal" role="dialog" aria-modal="true" aria-labelledby="principal-student-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">READ-ONLY STUDENT RECORD</span>
            <h2 id="principal-student-title">{fullName(student)}</h2>
            <p>Student #{student.id} · {student.email}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close student details" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="principal-detail-content">
          <section className="principal-detail-section">
            <h3>Profile</h3>
            <div className="principal-profile-summary">
              <div><span>Student ID</span><b>#{student.id}</b></div>
              <div><span>Email</span><b>{student.email}</b></div>
              <div><span>Joined</span><b>{formatDate(student.created_at)}</b></div>
            </div>
          </section>
          <section className="principal-detail-section">
            <h3>Enrolled courses <span className="count-pill">{enrollments.length}</span></h3>
            {enrollments.length ? (
              <div className="principal-detail-list">
                {enrollments.map((enrollment) => (
                  <div key={enrollment.id}>
                    <b>Course #{enrollment.course_id}</b>
                    <span>Enrolled {formatDate(enrollment.enrolled_at)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="principal-empty-report">No course enrollments.</p>}
          </section>
          <section className="principal-detail-section">
            <h3>Attendance <span className="count-pill">{attendance.length}</span></h3>
            {attendance.length ? (
              <div className="table-scroll"><table>
                <thead><tr><th>Course</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>{attendance.map((record) => (
                  <tr key={record.id}><td>{courseLabel(record.course_id)}</td><td>{formatDate(record.attendance_date)}</td><td>{titleCase(record.status)}</td></tr>
                ))}</tbody>
              </table></div>
            ) : <p className="principal-empty-report">No attendance records.</p>}
          </section>
          <section className="principal-detail-section">
            <h3>Marks <span className="count-pill">{marks.length}</span></h3>
            {marks.length ? (
              <div className="table-scroll"><table>
                <thead><tr><th>Course</th><th>Assessment</th><th>Score</th><th>Recorded</th></tr></thead>
                <tbody>{marks.map((mark) => (
                  <tr key={mark.id}>
                    <td>{courseLabel(mark.course_id)}</td>
                    <td>{mark.assessment_name}</td>
                    <td>{mark.score} / {mark.max_score} ({(mark.score / mark.max_score * 100).toFixed(1)}%)</td>
                    <td>{formatDate(mark.created_at)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <p className="principal-empty-report">No marks recorded.</p>}
          </section>
          <section className="principal-detail-section">
            <h3>Results <span className="count-pill">{results.length}</span></h3>
            {results.length ? (
              <div className="table-scroll"><table>
                <thead><tr><th>Course</th><th>Assessments</th><th>Average</th><th>Grade</th></tr></thead>
                <tbody>{results.map((result) => (
                  <tr key={`${result.student_id}-${result.course_id}`}>
                    <td>{result.course_code} · {result.course_title}</td>
                    <td>{result.assessment_count}</td>
                    <td>{result.average_percentage.toFixed(1)}%</td>
                    <td>{result.grade}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <p className="principal-empty-report">No results recorded.</p>}
          </section>
          {showFees && <section className="principal-detail-section">
            <h3>Fees <span className="count-pill">{fees.length}</span></h3>
            {fees.length ? (
              <div className="table-scroll"><table>
                <thead><tr><th>Course</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead>
                <tbody>{fees.map((fee) => (
                  <tr key={fee.id}>
                    <td>{fee.course_code} · {fee.course_title}</td>
                    <td>{formatCurrency(fee.total_fee)}</td>
                    <td>{formatCurrency(fee.paid_fee)}</td>
                    <td>{formatCurrency(fee.pending_fee)}</td>
                    <td>{fee.status}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <p className="principal-empty-report">No fee assignments available.</p>}
          </section>}
        </div>
        <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Close</button></div>
      </section>
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

function DataTable({ page, rows, students, courses, departments, teachers, enrollments, isAdmin, isPrincipal, canManageAcademicRecords, onViewStudent, onEdit, onDelete, onRecordPayment }: {
  page: Page;
  rows: Row[];
  students: Student[];
  courses: Course[];
  departments: Department[];
  teachers: Teacher[];
  enrollments: Enrollment[];
  isAdmin: boolean;
  isPrincipal: boolean;
  canManageAcademicRecords: boolean;
  onViewStudent: (studentId: number) => void;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  onRecordPayment: (row: FeeAssignment) => void;
}) {
  const studentLabel = (id: unknown) => {
    const student = students.find((item) => item.id === Number(id));
    return student ? (
      <div className="table-main">
        <b>{fullName(student)}</b>
        <small>Student #{student.id} · {student.email}</small>
      </div>
    ) : "Unknown student";
  };
  const courseLabel = (id: unknown) => {
    const course = courses.find((item) => item.id === Number(id));
    return course ? `${course.code} · ${course.title}` : "Unknown course";
  };
  const departmentLabel = (id: unknown) =>
    departments.find((department) => department.id === Number(id))?.name ?? "Unassigned";
  const teacherLabel = (id: unknown) =>
    teachers.find((teacher) => teacher.id === Number(id))?.name ?? "Unknown teacher";
  const columns: { key: string; label: string; render?: (row: Row) => ReactNode }[] =
    page === "students" ? [
      { key: "first_name", label: "Student", render: (row) => <div className="table-person"><span className="person-avatar">{String(recordValue(row, "first_name") ?? "")[0]}{String(recordValue(row, "last_name") ?? "")[0]}</span><span><b>{String(recordValue(row, "first_name") ?? "")} {String(recordValue(row, "last_name") ?? "")}</b><small>Student #{String(recordValue(row, "id") ?? "")}</small></span></div> },
      { key: "email", label: "Email address" },
      ...(isPrincipal ? [{ key: "courses", label: "Courses", render: (row: Row) => {
        const courseNames = enrollments
          .filter((item) => item.student_id === Number(recordValue(row, "id")))
          .map((item) => courseLabel(item.course_id));
        return courseNames.length ? courseNames.join(", ") : "No courses enrolled";
      } }] : []),
      { key: "created_at", label: "Joined", render: (row) => formatDate(recordValue(row, "created_at")) },
      ...(isPrincipal ? [{ key: "details", label: "Details", render: (row: Row) => (
        <button className="button button-small button-quiet" onClick={() => onViewStudent(Number(recordValue(row, "id")))}>
          <Eye size={14} /> View details
        </button>
      ) }] : []),
    ] : page === "courses" ? [
      { key: "code", label: "Course code", render: (row) => <span className="course-code">{String(recordValue(row, "code") ?? "")}</span> },
      { key: "title", label: "Course title", render: (row) => <div className="table-main"><b>{String(recordValue(row, "title") ?? "")}</b><small>{String(recordValue(row, "description") || "No description added")}</small></div> },
      { key: "department_id", label: "Department", render: (row) => departmentLabel(recordValue(row, "department_id")) },
      { key: "course_fee", label: "Course fee", render: (row) => recordValue(row, "course_fee") == null ? "Not set" : formatCurrency(String(recordValue(row, "course_fee"))) },
      ...(isPrincipal ? [{ key: "students", label: "Enrolled students", render: (row: Row) => {
        const courseStudents = enrollments
          .filter((item) => item.course_id === Number(recordValue(row, "id")))
          .map((item) => students.find((student) => student.id === item.student_id))
          .filter((student): student is Student => student !== undefined);
        return courseStudents.length
          ? <div className="fee-payment-history">{courseStudents.map((student) => <span key={student.id}>{fullName(student)} · #{student.id} · {student.email}</span>)}</div>
          : "No students enrolled";
      } }] : []),
    ] : page === "departments" ? [
      { key: "name", label: "Department" },
    ] : page === "teachers" ? [
      { key: "name", label: "Teacher" },
      { key: "email", label: "Email address" },
      { key: "department_id", label: "Department", render: (row) => departmentLabel(recordValue(row, "department_id")) },
    ] : page === "teacher-courses" ? [
      { key: "teacher_id", label: "Teacher", render: (row) => teacherLabel(recordValue(row, "teacher_id")) },
      { key: "course_id", label: "Course", render: (row) => courseLabel(recordValue(row, "course_id")) },
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
      ...(isAdmin || isPrincipal ? [{ key: "student_name", label: "Student", render: (row: Row) => studentLabel(recordValue(row, "student_id")) }] : []),
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
      ...(isAdmin || isPrincipal ? [{ key: "student_id", label: "Student", render: (row: Row) => studentLabel(recordValue(row, "student_id")) }] : []),
      { key: "assessment_count", label: "Assessments" },
      { key: "average_percentage", label: "Average", render: (row) => <span className="score-value">{String(recordValue(row, "average_percentage") ?? "—")}%</span> },
      { key: "grade", label: "Grade", render: (row) => <span className={`grade-pill grade-${String(recordValue(row, "grade") ?? "")}`}>{String(recordValue(row, "grade") ?? "")}</span> },
    ];

  const showActions = page !== "results" && (
    (isAdmin && (page !== "teacher-courses" || rows.length > 0))
    || (canManageAcademicRecords && (page === "attendance" || page === "marks"))
  );
  return <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{showActions && <th className="actions-column">Actions</th>}</tr></thead><tbody>
    {rows.map((row) => <tr className={page === "timetable" && recordValue(row, "weekday") === currentWeekday() ? "timetable-row-today" : ""} key={String(recordValue(row, "id") ?? `${recordValue(row, "student_id")}-${recordValue(row, "course_id")}`)}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : String(recordValue(row, column.key) ?? "—")}</td>)}{showActions && <td><div className="row-actions">{page === "fees" ? <button className="button button-small button-primary" disabled={Number(recordValue(row, "pending_fee")) <= 0} onClick={() => onRecordPayment(row as FeeAssignment)}>Record payment</button> : page === "teacher-courses" ? <button className="button button-small button-danger" onClick={() => onDelete(row)}>Remove</button> : canManageAcademicRecords && !isAdmin ? <button className="button button-small button-quiet" onClick={() => onEdit(row)}>Edit</button> : <><button className="button button-small button-quiet" onClick={() => onEdit(row)}>Edit</button><button className="button button-small button-danger" onClick={() => onDelete(row)}>Delete</button></>}</div></td>}</tr>)}
  </tbody></table></div>;
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <section className="empty-state"><div className="empty-illustration"><BookOpen size={27} strokeWidth={1.5} /><span>✳</span></div><h2>{title}</h2><p>{text}</p>{action && onAction && <button className="button button-primary" onClick={onAction}><Plus size={16} />{action}</button>}</section>;
}

export default App;
