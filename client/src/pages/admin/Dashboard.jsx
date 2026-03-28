import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/cards/StatCard';
import LiveBoard from '@/components/dashboard/LiveBoard';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import api from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalEnrollments: 0,
        enrollmentStats: {},
        totalActiveCourses: 0,
        totalHours: 0,
        topCourses: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/admin/dashboard-stats');
                setStats(response.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const cards = [
        {
            title: 'Total Students',
            value: stats.totalStudents,
            icon: 'Users',
            onClick: () => navigate('/admin/students')
        },
        {
            title: 'Total Enrollments',
            value: stats.totalEnrollments,
            icon: 'GraduationCap',
            onClick: () => navigate('/admin/enrollments')
        },
        {
            title: 'Active Programs',
            value: stats.totalActiveCourses,
            icon: 'BookOpen',
            onClick: () => navigate('/admin/programs')
        },
        {
            title: 'Draft Programs',
            value: stats.totalDraftCourses || 0,
            icon: 'FileEdit',
            onClick: () => navigate('/admin/programs')
        },
    ];

    const formatTimeAgo = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                    <p className="text-sm text-slate-500">Overview of your platform's performance.</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((stat, idx) => (
                    <StatCard
                        key={idx}
                        {...stat}
                        className="shadow-sm border border-slate-200"
                    />
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Live Board (2 Columns) */}
                <LiveBoard stats={stats} />

                {/* Top Courses (1 Column) */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Top Courses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats.topCourses && stats.topCourses.length > 0 ? (
                                stats.topCourses.map((course, idx) => (
                                    <div key={idx} className="flex items-center justify-between pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="h-8 w-8 min-w-[2rem] rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-brand-blue">
                                                {idx + 1}
                                            </div>
                                            <p className="text-sm font-medium text-slate-900 truncate" title={course.title}>
                                                {course.title}
                                            </p>
                                        </div>
                                        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                                            {course.count}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-4">No data available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Global Identity System Guide */}
                <Card className="col-span-1 border-blue-100 bg-blue-50/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-700">
                            <Icon name="ShieldCheck" size={18} />
                            Global Identity System (IDS)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-500">STUDENTS:</span>
                                <code className="bg-white px-2 py-0.5 rounded border border-blue-100 font-mono font-bold text-blue-600">PES2601</code>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-500">PROGRAMS:</span>
                                <code className="bg-white px-2 py-0.5 rounded border border-blue-100 font-mono font-bold text-blue-600">PEI01 / PEC02</code>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-500">CONTENT:</span>
                                <code className="bg-white px-2 py-0.5 rounded border border-blue-100 font-mono font-bold text-blue-600">PEI01-M1-V1</code>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-500">CREDENTIALS:</span>
                                <code className="bg-white px-2 py-0.5 rounded border border-blue-100 font-mono font-bold text-blue-600">PECPEI01S2601</code>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed pt-2 border-t border-blue-100">
                            The IDS is mandatory and auto-generated for absolute traceability and 100% verification across the LMS.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Video Activity Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon name="Activity" className="text-blue-500" size={20} />
                        Recent Video Activity
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/admin/videos')}>
                        View Video Library
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {stats.recentVideos && stats.recentVideos.length > 0 ? (
                            stats.recentVideos.map((vid, idx) => (
                                <div key={idx} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all group">
                                    <div className="flex justify-between items-start mb-2">
                                        <code className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 uppercase">
                                            {vid.videoId}
                                        </code>
                                        <span className="text-[9px] font-medium text-slate-400 group-hover:text-slate-600">
                                            {formatTimeAgo(vid.uploadedAt)}
                                        </span>
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-0.5" title={vid.title}>
                                        {vid.title}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 truncate mb-1">
                                        {vid.courseTitle}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-400">SIZE:</span>
                                        <span className="text-[9px] font-mono font-bold text-slate-600 px-1 rounded bg-white">
                                            {vid.size}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-8 text-center text-slate-400 text-sm">
                                No recent video activity found.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminDashboard;
