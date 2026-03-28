import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pagination } from '@/components/ui/Pagination';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';

const StudentManagement = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const response = await api.get('/admin/students');
                setStudents(response.data.data || []);
            } catch (error) {
                console.error("Failed to fetch students:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, []);

    const filteredStudents = students.filter(s => 
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.studentId || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Student Directory</h2>
                    <p className="text-sm text-slate-500">View and manage all registered students.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Icon name="Search" className="absolute left-3 top-2.5 text-slate-400" size={14} />
                        <Input 
                            placeholder="Search by ID, name, email..." 
                            className="pl-9 w-64 h-9 text-xs"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="sm"><Icon name="Download" size={14} className="mr-2" /> Export CSV</Button>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead className="w-[120px]">Student ID</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Institution</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">Loading student directory...</TableCell></TableRow>
                        ) : filteredStudents.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No students found matching your search.</TableCell></TableRow>
                        ) : (
                            filteredStudents.map((student) => (
                                <TableRow key={student._id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-mono font-bold text-[12px] text-slate-600">
                                        {student.studentId || 'N/A'}
                                    </TableCell>
                                    <TableCell className="font-semibold text-slate-900 uppercase">{student.name}</TableCell>
                                    <TableCell className="text-slate-500">{student.email}</TableCell>
                                    <TableCell className="text-slate-600 truncate max-w-[200px]" title={student.collegeName}>
                                        {student.collegeName || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="bg-green-50 text-green-700 border-green-100">
                                            {student.status || 'Active'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Icon name="MoreHorizontal" size={16} className="text-slate-400" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-slate-500">Showing {filteredStudents.length} of {students.length} students</p>
                <Pagination currentPage={1} totalPages={1} onPageChange={() => { }} className="justify-end" />
            </div>
        </div>
    );
};

export default StudentManagement;
