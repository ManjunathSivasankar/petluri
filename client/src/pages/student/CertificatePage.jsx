import React, { useState, useEffect } from 'react';
import { CertificateCard } from '@/components/cards/CertificateCard';
import api from '@/lib/api';

const CertificatePage = () => {
    const [certificates, setCertificates] = useState([]);
    const [internshipDocs, setInternshipDocs] = useState({ offers: [], certificates: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('certificates');

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [certRes, internRes] = await Promise.allSettled([
                    api.get('/student/certificates'),
                    api.get('/student/internship-documents')
                ]);
                if (certRes.status === 'fulfilled') setCertificates(certRes.value.data);
                if (internRes.status === 'fulfilled') setInternshipDocs(internRes.value.data);
            } catch (error) {
                console.error('Failed to fetch documents:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const handleDownload = async (cert) => {
        try {
            const response = await api.get(`/student/certificates/${cert._id}/download`, { responseType: 'blob' });
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

    const handleDownloadInternshipCert = async (cert) => {
        try {
            const response = await api.get(`/student/internship-certificates/${cert._id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${cert.certificateId || 'internship-certificate'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Internship cert download failed:', error);
            alert('Failed to download internship certificate.');
        }
    };

    const handleDownloadOffer = (offer) => {
        const backendBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001';
        window.open(backendBase + offer.pdfUrl, '_blank');
    };

    const handleVerify = (certId) => {
        window.open(`/verify-certificate/${certId}`, '_blank');
    };

    const hasInternshipDocs = internshipDocs.offers.length > 0 || internshipDocs.certificates.length > 0;

    if (loading) return <div className="p-8 text-center text-slate-500">Loading your documents...</div>;

    return (
        <div className="max-w-4xl">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">My Certificates</h1>
                <p className="text-slate-500">View and download your earned credentials.</p>
            </div>

            {/* Tabs - only show if there are internship docs */}
            {hasInternshipDocs && (
                <div className="flex gap-2 border-b border-slate-200 mb-6">
                    {[
                        { id: 'certificates', label: 'Certificates' },
                        { id: 'offers', label: 'Internship Offer Letters' },
                        { id: 'internship-certs', label: 'Internship Certificates' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Regular Certificates */}
            {(activeTab === 'certificates' || !hasInternshipDocs) && (
                <div className="grid gap-6">
                    {certificates.length > 0 ? (
                        certificates.map((cert) => (
                            <CertificateCard
                                key={cert._id}
                                title={cert.courseTitle || cert.courseId?.title}
                                issueDate={new Date(cert.generatedDate).toLocaleDateString()}
                                certificateId={cert.certificateId}
                                onDownload={() => handleDownload(cert)}
                                onVerify={() => handleVerify(cert.certificateId)}
                            />
                        ))
                    ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-500">You haven't earned any certificates yet. Complete a course to get certified!</p>
                        </div>
                    )}
                </div>
            )}

            {/* Internship Offer Letters */}
            {activeTab === 'offers' && (
                <div className="grid gap-6">
                    {internshipDocs.offers.length > 0 ? (
                        internshipDocs.offers.map(offer => (
                            <div key={offer._id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="font-semibold text-slate-900">{offer.courseTitle || offer.courseId?.title}</p>
                                    <p className="text-xs text-slate-500 mt-1">Offer ID: {offer.offerId}</p>
                                    <p className="text-xs text-slate-400">Issued: {new Date(offer.issuedDate).toLocaleDateString()}</p>
                                </div>
                                <button
                                    onClick={() => handleDownloadOffer(offer)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    ↓ Download Offer Letter
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-500">No internship offer letters yet.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Internship Completion Certificates */}
            {activeTab === 'internship-certs' && (
                <div className="grid gap-6">
                    {internshipDocs.certificates.length > 0 ? (
                        internshipDocs.certificates.map(cert => (
                            <div key={cert._id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="font-semibold text-slate-900">{cert.courseTitle || cert.courseId?.title}</p>
                                    <p className="text-xs text-slate-500 mt-1">Certificate ID: {cert.certificateId}</p>
                                    <p className="text-xs text-slate-400">Issued: {new Date(cert.issuedDate).toLocaleDateString()}</p>
                                </div>
                                <button
                                    onClick={() => handleDownloadInternshipCert(cert)}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    ↓ Download Certificate
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-500">No internship completion certificates yet. Complete your internship to earn one!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CertificatePage;
