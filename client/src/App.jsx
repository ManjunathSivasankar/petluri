import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/layout/PublicLayout';
import StudentLayout from '@/components/layout/StudentLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import LandingPage from '@/pages/public/LandingPage';
import CourseListingPage from '@/pages/public/CourseListingPage';
import CourseDetailPage from '@/pages/public/CourseDetailPage';
import LoginPage from '@/pages/public/LoginPage';
import StudentDashboard from '@/pages/student/Dashboard';
import MyCourses from '@/pages/student/MyCourses';
import LearningPage from '@/pages/student/LearningPage';
import QuizPage from '@/pages/student/QuizPage';
import CertificatePage from '@/pages/student/CertificatePage';
import ProfilePage from '@/pages/student/ProfilePage';
import VerifyCertificate from '@/pages/public/VerifyCertificate';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminLoginPage from '@/pages/admin/AdminLoginPage';
import ProgramWizard from '@/pages/admin/ProgramWizard';
import AdminPrograms from '@/pages/admin/AdminPrograms';
import StudentManagement from '@/pages/admin/StudentManagement';
import EnrollmentsPage from '@/pages/admin/EnrollmentsPage';
import InviteStudentsPage from '@/pages/admin/InviteStudentsPage';
import QuizManagementPage from '@/pages/admin/QuizManagementPage';
import QuizEditorPage from '@/pages/admin/QuizEditorPage';
import ReportsPage from '@/pages/admin/ReportsPage';
import CertificatesPage from '@/pages/admin/CertificatesPage';
import InternshipsPage from '@/pages/admin/InternshipsPage';
import VideosPage from '@/pages/admin/VideosPage';
import ProtectedRoute from '@/components/navigation/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="verify-certificate/:id" element={<VerifyCertificate />} />

        {/* Placeholder Routes - Will be implemented next */}
        <Route path="/courses/free" element={<CourseListingPage title="Free Courses" subtitle="Start learning today with our high-quality free courses." type="free" />} />
        <Route path="/courses/certification" element={<CourseListingPage title="Certification Courses" subtitle="Get certified and boost your career credentials." type="certification" />} />
        <Route path="/courses/professional" element={<CourseListingPage title="In-depth professional training for career transformation." subtitle="In-depth professional training for career transformation." type="professional" />} />
        <Route path="/internships" element={<CourseListingPage title="Internships" subtitle="Gain practical experience with our internship programs." type="internship" />} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/verify" element={<div className="min-h-[50vh] flex items-center justify-center text-slate-500">Certificate Verification Module (Coming Soon)</div>} />
        <Route path="/about" element={<div className="min-h-[50vh] flex items-center justify-center text-slate-500">About Page (Coming Soon)</div>} />

        {/* Login Pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/forgot-password" element={<div className="min-h-[50vh] flex items-center justify-center text-slate-500">Forgot Password Module (Coming Soon)</div>} />
      </Route>

      {/* Student Zone */}
      {/* Student Zone */}
      <Route path="/student" element={
        <ProtectedRoute allowedRoles={['student']}>
          <StudentLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/student/dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="courses" element={<MyCourses />} />
        <Route path="learning/:id" element={<LearningPage />} />
        <Route path="quizzes/:courseId" element={<QuizPage />} />
        <Route path="certificates" element={<CertificatePage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Admin Zone */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="programs" element={<AdminPrograms />} />
        <Route path="programs/create" element={<ProgramWizard />} />
        <Route path="programs/edit/:id" element={<ProgramWizard />} />
        <Route path="students" element={<InviteStudentsPage />} />
        <Route path="enrollments" element={<EnrollmentsPage />} />
        <Route path="quizzes" element={<QuizManagementPage />} />
        <Route path="videos" element={<VideosPage />} />
        <Route path="quizzes/create" element={<QuizEditorPage />} />
        <Route path="quizzes/edit/:id" element={<QuizEditorPage />} />
        <Route path="certificates" element={<CertificatesPage />} />
        <Route path="internships" element={<InternshipsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
