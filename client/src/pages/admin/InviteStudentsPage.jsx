import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { PROGRAM_STYLES, PROGRAM_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const InviteStudentsPage = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        mobile: '',
        institution: '',
        regNo: '',
        department: '',
        year: '',
        city: '',
        state: '',
        pincode: '',
        program: '',
        type: PROGRAM_TYPES.INTERNSHIP
    });

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const response = await api.get('/admin/students');
                setHistory(response.data.data || []);
            } catch (error) {
                console.error("Failed to fetch students:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStudents();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleInvite = async () => {
        try {
            await api.post('/admin/create-student', formData);
            alert(`Invitation sent to ${formData.email}!`);

            const response = await api.get('/admin/students');
            setHistory(response.data.data || []);

            setFormData({
                fullName: '',
                email: '',
                mobile: '',
                institution: '',
                regNo: '',
                department: '',
                year: '',
                city: '',
                state: '',
                pincode: '',
                program: '',
                type: PROGRAM_TYPES.INTERNSHIP
            });
        } catch (error) {
            console.error("Failed to invite student:", error);
            alert("Failed to send invitation. Please try again.");
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Page Header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Icon name="UserPlus" className="text-orange-500" size={24} />
                    <h1 className="text-2xl font-bold text-slate-800">Invite Student</h1>
                </div>
                <p className="text-sm text-slate-500">Add new users directly to programs.</p>
            </div>

            {/* Invite Form Section */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                    <Icon name="Mail" className="text-orange-500" size={20} />
                    <h2 className="text-lg font-semibold text-slate-800">Invite Student</h2>
                </div>

                <div className="space-y-6">
                    <p className="text-xs text-slate-500 -mt-4">Manually invite a student to a program. They will receive an email with login credentials.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-700">Full Name</label>
                            <Input name="fullName" placeholder="John Doe" value={formData.fullName} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-700">Email Address</label>
                            <Input name="email" placeholder="student@example.com" value={formData.email} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-700">Mobile Number</label>
                            <Input name="mobile" placeholder="1234567890" value={formData.mobile} onChange={handleChange} />
                        </div>
                    </div>

                    {/* Academic Details */}
                    <div className="bg-slate-50 p-4 rounded-md border border-slate-100 mt-2">
                        <h3 className="text-sm font-bold text-slate-700 mb-4">Academic Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-600">Institution Name</label>
                                <Input name="institution" placeholder="College/University" value={formData.institution} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-600">Register/Roll No</label>
                                <Input name="regNo" placeholder="123456" value={formData.regNo} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-600">Department</label>
                                <Input name="department" placeholder="Ex: CSE" value={formData.department} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-600">Year</label>
                                <Input name="year" placeholder="Ex: 3rd Year" value={formData.year} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    {/* Address Info */}
                    <div className="bg-slate-50 p-4 rounded-md border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-700 mb-4">Address Info</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-600">City</label>
                                <Input name="city" placeholder="City" value={formData.city} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-600">State</label>
                                <Input name="state" placeholder="State" value={formData.state} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-600">Pincode</label>
                                <Input name="pincode" placeholder="560001" value={formData.pincode} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    {/* Program Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-700">Select Program</label>
                            <Select name="program" value={formData.program} onChange={handleChange}>
                                <option value="">Choose a program...</option>
                                <option>Full Stack Web Development</option>
                                <option>React JS Internship</option>
                                <option>Introduction to Python</option>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-700">Program Type</label>
                            <Select name="type" value={formData.type} onChange={handleChange}>
                                {Object.values(PROGRAM_TYPES).map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white w-32" onClick={handleInvite}>
                            Send Invite
                        </Button>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm mt-8">
                <div className="flex items-center gap-2 mb-6">
                    <Icon name="History" className="text-slate-400" size={20} />
                    <h2 className="text-lg font-semibold text-slate-800">Invited Students History</h2>
                    <div className="ml-auto w-64">
                        <Input placeholder="Search by name or email..." className="text-xs h-9 bg-slate-50 border-slate-200" icon="Search" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-100">
                            <tr>
                                <th className="p-3 pl-4">Name</th>
                                <th className="p-3">Email</th>
                                <th className="p-3">Program</th>
                                <th className="p-3">Invited Date</th>
                                <th className="p-3 text-right pr-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-slate-500">Loading students...</td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-slate-500">No students found.</td>
                                </tr>
                            ) : (
                                history.map((row) => {
                                    const dbType = row.type ? row.type.toLowerCase() : '';
                                    const styleKey = Object.keys(PROGRAM_STYLES).find(k => k.toLowerCase().includes(dbType)) || PROGRAM_TYPES.PROFESSIONAL;
                                    const typeStyle = PROGRAM_STYLES[styleKey] || PROGRAM_STYLES[PROGRAM_TYPES.PROFESSIONAL];
                                    const dateDisplay = row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-GB') : (row.date || '-');

                                    return (
                                        <tr key={row._id || row.id}>
                                            <td className="p-3 pl-4 font-bold text-slate-700 uppercase">{row.name}</td>
                                            <td className="p-3 text-slate-500">{row.email}</td>
                                            <td className="p-3">
                                                <span className={cn(
                                                    "px-2 py-1 rounded border",
                                                    typeStyle.bg,
                                                    typeStyle.text,
                                                    typeStyle.border
                                                )}>
                                                    {row.program || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-500">{dateDisplay}</td>
                                            <td className="p-3 text-right pr-4">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-600 border border-green-100">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> {row.status || 'Invited'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InviteStudentsPage;
