import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { 
    Table, 
    TableHeader, 
    TableBody, 
    TableRow, 
    TableHead, 
    TableCell 
} from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import api from '@/lib/api';

const CertificatesPage = () => {
    const [certificates, setCertificates] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProgram, setSelectedProgram] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCertificates = async () => {
            try {
                const [certRes, progRes] = await Promise.all([
                    api.get('/admin/certificates'),
                    api.get('/admin/courses')
                ]);
                setCertificates(certRes.data);
                // Extract unique non-internship program details for filtering
                const uniqueProgs = progRes.data
                    .filter(p => p.type !== 'internship')
                    .map(p => ({ title: p.title, code: p.programCode || p.programId }))
                    .sort((a, b) => a.title.localeCompare(b.title));
                setPrograms(uniqueProgs);
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCertificates();
    }, []);

    const filteredCertificates = certificates.filter(cert => {
        // Exclude internship programs from the certificate log list
        if (cert.courseId?.type === 'internship') return false;

        const query = searchTerm.toLowerCase();
        const matchesQuery = (
            (cert.studentName || '').toLowerCase().includes(query) ||
            (cert.certificateId || '').toLowerCase().includes(query) ||
            (cert.courseTitle || '').toLowerCase().includes(query) ||
            (cert.userId?.email || '').toLowerCase().includes(query)
        );
        const matchesProgram = selectedProgram === '' || cert.courseTitle === selectedProgram;
        return matchesQuery && matchesProgram;
    });

    const handleDownload = async (cert) => {
        try {
            const response = await api.get(`/admin/certificates/${cert._id}/download`, {
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${cert.certificateId || 'certificate'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download certificate. Please try again.');
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Certificate Log</h1>
                <p className="text-sm text-slate-500">History of all issued digital credentials.</p>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input 
                                placeholder="Search by Student Name, ID, or Course..." 
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-64">
                            <Select 
                                value={selectedProgram}
                                onChange={(e) => setSelectedProgram(e.target.value)}
                            >
                                <option value="">All Programs</option>
                                {programs.map(prog => (
                                    <option key={prog.code} value={prog.title}>
                                        {prog.code} - {prog.title}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Certificate ID</TableHead>
                                <TableHead>Student</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Issue Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        Loading certificates...
                                    </TableCell>
                                </TableRow>
                            ) : certificates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        No certificates found matching your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCertificates.map((cert) => (
                                    <TableRow key={cert._id}>
                                        <TableCell className="font-mono text-xs font-bold text-slate-600">
                                            {cert.certificateId}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium text-slate-900">{cert.studentName}</div>
                                            <div className="text-xs text-slate-500">{cert.userId?.email}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {cert.courseTitle}
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {new Date(cert.generatedDate).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleDownload(cert)}>
                                                    <Icon name="Download" size={16} />
                                                </Button>
                                                <Button asChild variant="ghost" size="icon">
                                                    <a href={`/verify-certificate/${cert.certificateId}`} target="_blank" rel="noreferrer">
                                                        <Icon name="CheckSquare" size={16} />
                                                    </a>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default CertificatesPage;
