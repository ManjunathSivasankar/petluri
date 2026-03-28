import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { PROGRAM_STYLES, PROGRAM_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const ReportsPage = () => {
    const [enrollments, setEnrollments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCourseId, setSelectedCourseId] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [performanceFilter, setPerformanceFilter] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [enrRes, courseRes] = await Promise.all([
                    api.get('/admin/enrollments'),
                    api.get('/admin/courses')
                ]);
                setEnrollments(enrRes.data || []);
                setCourses(courseRes.data || []);
            } catch (error) {
                console.error("Failed to fetch reports data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredEnrollments = enrollments.filter(enr => {
        const matchesSearch = (enr.userId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (enr.userId?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCourse = selectedCourseId === 'all' || enr.courseId?._id === selectedCourseId;
        const matchesStatus = selectedStatus === 'all' || enr.status === selectedStatus;
        
        let matchesPerformance = true;
        if (performanceFilter === 'top') matchesPerformance = (enr.completionPercentage || 0) >= 90;
        if (performanceFilter === 'risk') matchesPerformance = (enr.completionPercentage || 0) <= 50;

        return matchesSearch && matchesCourse && matchesStatus && matchesPerformance;
    });

    const exportToCSV = () => {
        const headers = ["Student Name", "Email", "Program", "Type", "Quiz Passed", "Quiz Failed", "Total Attempts", "Progress", "Status"];
        const rows = filteredEnrollments.map(enr => [
            enr.userId?.name || 'Unknown',
            enr.userId?.email || 'N/A',
            enr.courseId?.title || 'Unknown',
            enr.courseId?.type || 'N/A',
            enr.quizTracking?.passed || 0,
            enr.quizTracking?.failed || 0,
            enr.quizTracking?.totalAttempts || 0,
            `${enr.completionPercentage || 0}%`,
            enr.status
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `student_reports_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Icon name="BarChart3" className="text-brand-blue" size={24} />
                        <h1 className="text-2xl font-bold text-slate-900">Student Reports</h1>
                    </div>
                    <p className="text-sm text-slate-500">Track attendance, assessment scores, and overall progress.</p>
                </div>
                <Button 
                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-100" 
                    onClick={exportToCSV}
                    disabled={filteredEnrollments.length === 0}
                >
                    <Icon name="Download" size={16} className="mr-2" />
                    Export CSV
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex-1 relative">
                    <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input 
                        placeholder="Search student or email..." 
                        className="pl-10 h-11 border-slate-200 focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                    <Select 
                        className="w-full md:w-60 h-11 border-slate-200"
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                    >
                        <option value="all">Program: All</option>
                        {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                    </Select>
                    <Select 
                        className="w-full md:w-44 h-11 border-slate-200"
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                        <option value="all">Status: All</option>
                        <option value="enrolled">Enrolled</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                    </Select>
                    <Select 
                        className="w-full md:w-48 h-11 border-slate-200"
                        value={performanceFilter}
                        onChange={(e) => setPerformanceFilter(e.target.value)}
                    >
                        <option value="all">Performance: All</option>
                        <option value="top">Top Performers (&gt;90%)</option>
                        <option value="risk">At Risk (&lt;50%)</option>
                    </Select>
                </div>
            </div>

            {/* Reports Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="p-4">Student Name</th>
                                <th className="p-4">Program</th>
                                <th className="p-4">Quiz Status</th>
                                <th className="p-4 w-40">Overall Progress</th>
                                <th className="p-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Icon name="Loader2" className="animate-spin text-blue-500" size={32} />
                                            <p className="text-slate-500 font-medium">Loading reports data...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEnrollments.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-60">
                                            <Icon name="Inbox" size={48} className="text-slate-300" />
                                            <p className="text-slate-500 font-medium">No results match your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredEnrollments.map((enr) => {
                                    const type = enr.courseId?.type || PROGRAM_TYPES.PROFESSIONAL;
                                    const typeStyle = PROGRAM_STYLES[type] || PROGRAM_STYLES[PROGRAM_TYPES.PROFESSIONAL];
                                    const quiz = enr.quizTracking || { passed: 0, totalAttempts: 0 };
                                    
                                    return (
                                        <tr key={enr._id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                                    {enr.userId?.name || 'Unknown'}
                                                </div>
                                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <Icon name="Mail" size={10} />
                                                    {enr.userId?.email || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-slate-800 font-medium mb-1.5">{enr.courseId?.title || 'Unknown Course'}</div>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                                    typeStyle?.bg || 'bg-slate-50',
                                                    typeStyle?.text || 'text-slate-700',
                                                    typeStyle?.border || 'border-slate-200'
                                                )}>
                                                    {type}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[11px] font-mono font-bold",
                                                            quiz.passed > 0 ? "bg-green-50 text-green-700 border border-green-100" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {quiz.passed} Passed
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">/ {quiz.totalAttempts} Attempts</span>
                                                    </div>
                                                    {quiz.latestResults?.length > 0 && (
                                                        <div className="text-[9px] text-slate-400 italic">
                                                            Last attempt: {new Date(quiz.latestResults[0].attemptedAt).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn("h-full rounded-full transition-all duration-1000",
                                                                enr.completionPercentage === 100 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" :
                                                                enr.completionPercentage < 40 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" : 
                                                                "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                                                        )}
                                                            style={{ width: `${enr.completionPercentage || 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[11px] text-slate-600 font-bold w-10">{enr.completionPercentage || 0}%</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                                    enr.status === 'completed' ? "bg-green-50 text-green-700 border-green-200" :
                                                    enr.status === 'pending' ? "bg-orange-50 text-orange-700 border-orange-200" :
                                                    "bg-blue-50 text-blue-700 border-blue-200"
                                                )}>
                                                    {enr.status || 'Enrolled'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Footer summary */}
                {!loading && filteredEnrollments.length > 0 && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                        <p className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">
                            Showing {filteredEnrollments.length} Enrollment Records
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportsPage;
