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
import api from '@/lib/api';

const CertificatesPage = () => {
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCertificates = async () => {
            try {
                const response = await api.get('/admin/certificates');
                setCertificates(response.data);
            } catch (error) {
                console.error("Failed to fetch certificates:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCertificates();
    }, []);

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
                                        No certificates issued yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                certificates.map((cert) => (
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
