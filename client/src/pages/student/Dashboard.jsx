import React, { useEffect, useState } from 'react';
import { StatCard } from '@/components/cards/StatCard';
import { CourseCard } from '@/components/cards/CourseCard';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

const StudentDashboard = () => {
    const { user } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const { data } = await api.get('/student/dashboard');
                setDashboardData(data);
            } catch (error) {
                console.error('Failed to fetch dashboard:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading your dashboard...</div>;
    }

    const { stats, enrolledCourses } = dashboardData || {
        stats: { totalEnrolled: 0, completed: 0, certificates: 0 },
        enrolledCourses: []
    };

    const statCards = [
        { title: 'Enrolled Courses', value: stats.totalEnrolled, icon: 'BookOpen', color: 'blue' },
        { title: 'Completed', value: stats.completed, icon: 'CheckCircle', color: 'green' },
        { title: 'Certificates', value: stats.certificates, icon: 'Award', color: 'amber' },
        { title: 'Learning Hours', value: stats.totalEnrolled * 2, icon: 'Clock', color: 'slate' }, // Mock stat for hours
    ];

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name || 'Student'}! 👋</h2>
                <p className="text-slate-500">Pick up where you left off.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat) => (
                    <StatCard key={stat.title} {...stat} className="border-none shadow-md" />
                ))}
            </div>

            {/* Continue Learning */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Continue Learning</h3>
                    <Button variant="link" onClick={() => window.location.href = '/student/courses'}>View All Courses</Button>
                </div>

                {enrolledCourses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {enrolledCourses.map((course) => (
                            <div key={course._id} className="h-full">
                                <CourseCard course={course} type={course.courseId?.type || 'professional'} isEnrolled={true} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-slate-500 mb-4">You are not enrolled in any courses yet.</p>
                        <Button onClick={() => window.location.href = '/courses/free'}>Explore Courses</Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentDashboard;
