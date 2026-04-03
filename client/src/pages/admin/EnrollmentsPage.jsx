import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { PROGRAM_STYLES, PROGRAM_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import CredentialsModal from '@/components/admin/CredentialsModal';

const EnrollmentsPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState('all');
    const [loading, setLoading] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [selectedEnrollmentDetails, setSelectedEnrollmentDetails] = useState(null);
    const [credentialsModal, setCredentialsModal] = useState({
        isOpen: false,
        studentId: null,
        studentEmail: null
    });

    useEffect(() => {
        const fetchEnrollments = async () => {
            try {
                const [enrollmentRes, courseRes] = await Promise.all([
                    api.get('/admin/enrollments'),
                    api.get('/admin/courses')
                ]);
                setEnrollments(enrollmentRes.data || []);
                setCourses(courseRes.data || []);
            } catch (error) {
                console.error("Failed to fetch enrollments:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEnrollments();
    }, []);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedRows(enrollments.map(enr => enr._id));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedRows(prev =>
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };

    const handleOpenCredentials = (studentId, studentEmail) => {
        if (!studentId) return;
        setCredentialsModal({
            isOpen: true,
            studentId,
            studentEmail
        });
    };

    const handleStatusChange = async (enrollmentId, newStatus) => {
        const confirmMsg = newStatus === 'completed' 
            ? 'Mark this course as completed and issue certificate?' 
            : `Change status to ${newStatus}?`;
            
        if (!window.confirm(confirmMsg)) return;
        try {
            await api.put(`/admin/enrollments/${enrollmentId}/status`, { status: newStatus });
            // Refresh list
            const response = await api.get('/admin/enrollments');
            setEnrollments(response.data || []);
        } catch (error) {
            console.error("Failed to update status:", error);
            alert('Failed to update status');
        }
    };

    const handleViewMonitoring = async (enrollmentId) => {
        try {
            setLoadingDetails(true);
            const { data } = await api.get(`/admin/enrollments/${enrollmentId}/details`);
            setSelectedEnrollmentDetails(data);
        } catch (error) {
            console.error('Failed to fetch enrollment details:', error);
            alert('Unable to load detailed progress view');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleExportExcel = async () => {
        if (!selectedCourseId || selectedCourseId === 'all') {
            alert('Please select a specific course to export.');
            return;
        }

        try {
            const response = await api.get(`/admin/enrollments/export/${selectedCourseId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `course-enrollments-${selectedCourseId}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export enrollments');
        }
    };

    const copyTableData = () => {
        // Implement copy logic based on displayed data
        alert('Table data copied to clipboard!');
    };

    // Filter logic (simple client-side for now)
    const filteredEnrollments = enrollments.filter(enr =>
        ((enr.userId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (enr.userId?.email || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
        (selectedCourseId === 'all' || enr.courseId?._id === selectedCourseId)
    );

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Student Enrollments</h1>
                    <p className="text-sm text-slate-500">Manage all student enrollments, payments, and certificates.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={copyTableData}>
                        <Icon name="Copy" size={16} className="mr-2" />
                        Copy Data
                    </Button>
                    <Button onClick={handleExportExcel}>
                        <Icon name="Download" size={16} className="mr-2" />
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Icon name="Search" className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <Input
                        placeholder="Search by name, email..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select className="w-full md:w-72" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                    <option value="all">Course: All</option>
                    {courses.map(course => (
                        <option key={course._id} value={course._id}>{course.title}</option>
                    ))}
                </Select>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium uppercase text-xs border-b border-slate-200">
                            <tr>
                                <th className="p-4 w-4">
                                    <input type="checkbox" onChange={handleSelectAll} checked={selectedRows.length === enrollments.length && enrollments.length > 0} />
                                </th>
                                <th className="p-4 min-w-[120px]">Enrollment ID</th>
                                <th className="p-4 min-w-[120px]">Student ID</th>
                                <th className="p-4 min-w-[150px]">Name</th>
                                <th className="p-4 min-w-[200px]">Email</th>
                                <th className="p-4 min-w-[150px]">Phone</th>
                                <th className="p-4 min-w-[180px]">College/Corporate</th>
                                <th className="p-4 min-w-[200px]">Program</th>
                                <th className="p-4 min-w-[120px]">Type</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Certification</th>
                                <th className="p-4">Internship</th>
                                <th className="p-4">Progress</th>
                                <th className="p-4">Completion</th>
                                <th className="p-4">Feedback</th>
                                <th className="p-4 min-w-[100px]">Date</th>
                                <th className="p-4 min-w-[220px] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={15} className="text-center py-8 text-slate-500">Loading enrollments...</td>
                                </tr>
                            ) : filteredEnrollments.length === 0 ? (
                                <tr>
                                    <td colSpan={15} className="text-center py-8 text-slate-500">No enrollments found.</td>
                                </tr>
                            ) : (
                                filteredEnrollments.map((row) => {
                                    const type = row.courseId?.type || PROGRAM_TYPES.PROFESSIONAL;
                                    const typeStyle = PROGRAM_STYLES[type] || PROGRAM_STYLES[PROGRAM_TYPES.PROFESSIONAL];
                                    const dateObj = row.paymentDetails?.createdAt || row.createdAt;
                                    const dateDisplay = dateObj ? new Date(dateObj).toLocaleDateString('en-GB') : '-';

                                    const studentId = row.userId?.studentId || 'N/A';
                                    const amountStr = row.paymentDetails?.amount ? `₹${row.paymentDetails.amount}` : (row.courseId?.price ? `₹${row.courseId.price}` : 'Free');
                                    let statusStr = row.paymentDetails?.status || row.status || 'unknown';
                                    if (statusStr === 'successful') statusStr = 'Paid';
                                    if (statusStr === 'created') statusStr = 'Pending Payment';

                                    return (
                                        <tr key={row._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRows.includes(row._id)}
                                                    onChange={() => handleSelectRow(row._id)}
                                                />
                                            </td>
                                            <td className="p-4 font-mono text-sm text-blue-600 font-bold">{row.enrollmentId || 'N/A'}</td>
                                            <td className="p-4 font-mono text-sm text-slate-600">{studentId}</td>
                                            <td className="p-4 font-semibold text-slate-900">{row.userId?.name || 'Unknown'}</td>
                                            <td className="p-4 text-slate-700">{row.userId?.email || 'N/A'}</td>
                                            <td className="p-4 text-slate-700">{row.userId?.phone || '-'}</td>
                                            <td className="p-4 text-slate-600 truncate max-w-[180px]" title={row.userId?.collegeName}>{row.userId?.collegeName || '-'}</td>
                                            <td className="p-4 text-slate-600 font-medium">{row.courseId?.title || 'Unknown Course'}</td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    "inline-flex items-center px-2 py-1 rounded text-xs font-medium border uppercase tracking-wider",
                                                    typeStyle.bg,
                                                    typeStyle.text,
                                                    typeStyle.border
                                                )}>
                                                    {type}
                                                </span>
                                            </td>
                                            <td className="p-4 font-medium text-slate-900">{amountStr}</td>
                                            <td className="p-4">
                                                <select
                                                    className={cn(
                                                        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none",
                                                        row.status === 'completed' ? "bg-green-100 text-green-800" :
                                                            row.status === 'pending' ? "bg-yellow-100 text-yellow-800" :
                                                                row.status === 'enrolled' ? "bg-blue-100 text-blue-800" :
                                                                    "bg-slate-100 text-slate-800"
                                                    )}
                                                    value={row.status || 'enrolled'}
                                                    onChange={(e) => handleStatusChange(row._id, e.target.value)}
                                                >
                                                    <option value="enrolled">Enrolled</option>
                                                    <option value="pending">Pending</option>
                                                    <option value="completed">Completed</option>
                                                </select>
                                            </td>
                                            <td className="p-4">
                                                {row.certificate ? (
                                                    <Badge variant="success" className="text-[10px]">Issued</Badge>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">Pending</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    {row.internshipOffer && <Badge variant="secondary" className="text-[10px] w-fit">Offer Sent</Badge>}
                                                    {row.internshipCertificate && <Badge variant="success" className="text-[10px] w-fit">Cert Issued</Badge>}
                                                    {!row.internshipOffer && !row.internshipCertificate && <span className="text-slate-400 text-xs">N/A</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 font-semibold text-slate-700">{row.completionPercentage || 0}%</td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold",
                                                    row.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                                                )}>
                                                    {row.status === 'completed' ? 'Completed' : 'Not Completed'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs">
                                                {row.feedback?.submitted ? `Submitted (${row.feedback?.rating || '-'}/5)` : 'Pending'}
                                            </td>
                                            <td className="p-4 text-slate-600">{dateDisplay}</td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Row specific complete button removed in favor of status dropdown */}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 text-xs h-8"
                                                        onClick={() => handleOpenCredentials(row.userId?._id, row.userId?.email)}
                                                    >
                                                        <Icon name="Key" size={14} className="mr-1" />
                                                        Credentials
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs h-8"
                                                        onClick={() => handleViewMonitoring(row._id)}
                                                    >
                                                        <Icon name="BarChart3" size={14} className="mr-1" />
                                                        Monitor
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Static for now) */}
                <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-sm text-slate-500">Showing {filteredEnrollments.length} enrollments</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled>Previous</Button>
                        <Button variant="outline" size="sm" disabled>Next</Button>
                    </div>
                </div>
            </div>

            {selectedEnrollmentDetails && (
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Enrollment Monitoring Details</h2>
                            <p className="text-sm text-slate-500">
                                {selectedEnrollmentDetails.student?.name} ({selectedEnrollmentDetails.student?.studentId || 'No ID'}) | {selectedEnrollmentDetails.student?.email}
                            </p>
                        </div>
                        {loadingDetails && <span className="text-xs text-slate-500">Loading...</span>}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div className="rounded-md border border-slate-200 p-3">
                            <p className="text-xs text-slate-500">Selected Course</p>
                            <p className="font-semibold text-slate-900">{selectedEnrollmentDetails.selectedEnrollment?.courseId?.title}</p>
                            <p className="text-sm text-slate-600 mt-1">Progress: {selectedEnrollmentDetails.selectedEnrollment?.completionPercentage || 0}%</p>
                            <p className="text-sm text-slate-600">Status: {selectedEnrollmentDetails.selectedEnrollment?.status}</p>
                        </div>
                        <div className="rounded-md border border-slate-200 p-3">
                            <p className="text-xs text-slate-500">Quiz Tracking</p>
                            <p className="text-sm text-slate-700">Attempts: {selectedEnrollmentDetails.selectedEnrollment?.quizTracking?.totalAttempts || 0}</p>
                            <p className="text-sm text-green-700">Passed: {selectedEnrollmentDetails.selectedEnrollment?.quizTracking?.passed || 0}</p>
                            <p className="text-sm text-red-700">Failed: {selectedEnrollmentDetails.selectedEnrollment?.quizTracking?.failed || 0}</p>
                        </div>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-800 mb-2">All Courses Taken By Student</h3>
                    <div className="overflow-x-auto border border-slate-100 rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                <tr>
                                    <th className="p-3 text-left">Course</th>
                                    <th className="p-3 text-left">Type</th>
                                    <th className="p-3 text-left">Progress</th>
                                    <th className="p-3 text-left">Status</th>
                                    <th className="p-3 text-left">Completion</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(selectedEnrollmentDetails.studentCourseProgress || []).map(item => (
                                    <tr key={item.enrollmentId} className="border-t border-slate-100">
                                        <td className="p-3 font-medium text-slate-800">{item.courseTitle}</td>
                                        <td className="p-3 text-slate-600">{item.courseType}</td>
                                        <td className="p-3 text-slate-700">{item.completionPercentage}%</td>
                                        <td className="p-3 text-slate-700">{item.status}</td>
                                        <td className="p-3 text-slate-700">{item.completionStatus}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <CredentialsModal
                isOpen={credentialsModal.isOpen}
                onClose={() => setCredentialsModal({ ...credentialsModal, isOpen: false })}
                studentId={credentialsModal.studentId}
                studentEmail={credentialsModal.studentEmail}
            />
        </div>
    );
};

export default EnrollmentsPage;
