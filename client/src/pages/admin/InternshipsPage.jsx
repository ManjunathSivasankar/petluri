import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell
} from '@/components/ui/Table';
import api from '@/lib/api';

const InternshipsPage = () => {
    const [activeTab, setActiveTab] = useState('offers');
    const [offers, setOffers] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [offersRes, certRes] = await Promise.all([
                    api.get('/admin/internships/offers'),
                    api.get('/admin/internships/certificates')
                ]);
                setOffers(offersRes.data);
                setCertificates(certRes.data);
            } catch (error) {
                console.error('Failed to fetch internship documents:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleDownloadCertificate = async (cert) => {
        try {
            const response = await api.get(`/admin/internships/certificates/${cert._id}/download`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${cert.certificateId || 'internship-certificate'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download. Please try again.');
        }
    };

    const handleDownloadOffer = async (offer) => {
        try {
            // Direct download via static file URL
            const link = document.createElement('a');
            link.href = offer.pdfUrl;
            link.setAttribute('download', `${offer.offerId || 'offer-letter'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download. Please try again.');
        }
    };

    const tabs = [
        { id: 'offers', label: 'Offer Letters', icon: 'FileText' },
        { id: 'certificates', label: 'Completion Certificates', icon: 'Award' }
    ];

    return (
        <div className="space-y-6 pb-20">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Internship Documents</h1>
                <p className="text-sm text-slate-500">Manage internship offer letters and completion certificates.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Icon name={tab.icon} size={16} />
                        {tab.label}
                        <Badge className={`ml-1 text-xs ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                            {tab.id === 'offers' ? offers.length : certificates.length}
                        </Badge>
                    </button>
                ))}
            </div>

            {/* Offers Tab */}
            {activeTab === 'offers' && (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Offer ID</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Course</TableHead>
                                    <TableHead>Issued Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">Loading...</TableCell>
                                    </TableRow>
                                ) : offers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                            No internship offer letters issued yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    offers.map((offer) => (
                                        <TableRow key={offer._id}>
                                            <TableCell className="font-mono text-xs font-bold text-slate-600">
                                                {offer.offerId}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-slate-900">{offer.studentName}</div>
                                                <div className="text-xs text-slate-500">{offer.userId?.email}</div>
                                            </TableCell>
                                            <TableCell className="text-slate-600">{offer.courseTitle}</TableCell>
                                            <TableCell className="text-slate-600">
                                                {new Date(offer.issuedDate).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDownloadOffer(offer)} title="Download Offer Letter">
                                                    <Icon name="Download" size={16} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Certificates Tab */}
            {activeTab === 'certificates' && (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Certificate ID</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Course</TableHead>
                                    <TableHead>Issued Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">Loading...</TableCell>
                                    </TableRow>
                                ) : certificates.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                            No internship completion certificates issued yet.
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
                                            <TableCell className="text-slate-600">{cert.courseTitle}</TableCell>
                                            <TableCell className="text-slate-600">
                                                {new Date(cert.issuedDate).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDownloadCertificate(cert)} title="Download Certificate">
                                                    <Icon name="Download" size={16} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default InternshipsPage;
