export type Role = "admin" | "student" | "principal" | "hod" | "teacher";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type SportsLevel = "district" | "state" | "national";

export interface User {
  id: number;
  email: string;
  role: Role;
  student_id: number | null;
  department_id: number | null;
  teacher_id: number | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Student {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

export interface Course {
  id: number;
  code: string;
  title: string;
  description: string | null;
  course_fee: number | string | null;
  department_id: number | null;
}

export interface Department {
  id: number;
  name: string;
}

export interface Teacher {
  id: number;
  name: string;
  email: string;
  department_id: number;
}

export interface TeacherCourse {
  id: number;
  teacher_id: number;
  course_id: number;
}

export interface Enrollment {
  id: number;
  student_id: number;
  course_id: number;
  enrolled_at: string;
}

export interface Attendance {
  id: number;
  student_id: number;
  course_id: number;
  attendance_date: string;
  status: AttendanceStatus;
}

export interface Mark {
  id: number;
  student_id: number;
  course_id: number;
  assessment_name: string;
  score: number;
  max_score: number;
  created_at: string;
}

export interface Notice {
  id: number;
  title: string;
  description: string;
  notice_date: string;
}

export type TimetableWeekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

export interface TimetableEntry {
  id: number;
  course_id: number;
  weekday: TimetableWeekday;
  start_time: string;
  end_time: string;
  classroom_number: string;
  course_code: string;
  course_title: string;
}

export type FeeStatus = "Paid" | "Partial" | "Pending";
export type PaymentMethod = "cash" | "card" | "upi" | "bank_transfer";

export interface FeePayment {
  id: number;
  amount: number | string;
  payment_date: string;
  payment_method: PaymentMethod;
  idempotency_key: string | null;
}

export interface FeeAssignment {
  id: number;
  student_id: number;
  course_id: number;
  student_name: string;
  course_code: string;
  course_title: string;
  total_fee: number | string;
  paid_fee: number | string;
  pending_fee: number | string;
  status: FeeStatus;
  payments: FeePayment[];
}

export interface SportsAchievement {
  id: number;
  student_id: number;
  sport_name: string;
  level: SportsLevel;
  event_name: string | null;
  competition_name: string | null;
  achievement_date: string;
  result: string | null;
}

export interface SportsSportSummary {
  sport_name: string;
  athlete_count: number;
  achievement_count: number;
}

export interface SportsRecentAchievement extends SportsAchievement {
  student_name: string;
}

export interface SportsDashboard {
  total_athletes: number;
  total_achievements: number;
  district_athletes: number;
  state_athletes: number;
  national_athletes: number;
  district_achievements: number;
  state_achievements: number;
  national_achievements: number;
  sport_breakdown: SportsSportSummary[];
  recent_achievements: SportsRecentAchievement[];
}

export interface CourseResult {
  student_id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  assessment_count: number;
  average_percentage: number;
  grade: string;
}

export interface AdminDashboard {
  total_students: number;
  total_courses: number;
  total_enrollments: number;
  attendance_records_today: number;
  total_assessments: number;
}

export interface StudentDashboard {
  student_id: number;
  enrolled_courses: number;
  attendance_records: number;
  attendance_percentage: number;
  assessments_recorded: number;
  average_percentage: number | null;
}

export interface PrincipalDashboard {
  total_students: number;
  total_courses: number;
  total_attendance: number;
  total_marks: number;
  total_results: number;
}

export interface HODDashboard {
  department_id: number;
  department_name: string;
  total_students: number;
  total_courses: number;
  total_teachers: number;
  total_enrollments: number;
  total_attendance: number;
  total_marks: number;
  total_results: number;
}

export interface TeacherDashboard {
  total_courses: number;
  total_students: number;
  total_enrollments: number;
  total_attendance: number;
  total_marks: number;
  total_results: number;
}

export type Entity =
  | Student
  | Course
  | Enrollment
  | Attendance
  | Mark
  | Notice
  | FeeAssignment
  | TimetableEntry
  | SportsAchievement
  | CourseResult
  | Department
  | Teacher
  | TeacherCourse;
