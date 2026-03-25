import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';

const VerifyCertificate = () => {
    const { id } = useParams();
    const [verificationData, setVerificationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const verify = async () => {
            try {
                // We use the public route /api/courses/verify/:id
                const { data } = await api.get(`/courses/verify/${id}`);
                setVerificationData(data);
            } catch (err) {
                console.error('Verification failed:', err);
                setError(err.response?.data?.message || 'Certificate not found or invalid');
            } finally {
                setLoading(false);
            }
        };

        verify();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Verifying Credential...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Petluri Verification Service</h1>
                <p className="text-slate-500">Official digital credential verification</p>
            </div>

            <Card className="max-w-md w-full overflow-hidden shadow-xl border-none">
                {error ? (
                    <CardContent className="p-8 text-center">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                            <Icon name="XCircle" size={48} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Verification Failed</h2>
                        <p className="text-slate-600 mb-8">{error}</p>
                        <Button className="w-full" onClick={() => window.location.href = '/'}>
                            Go to Homepage
                        </Button>
                    </CardContent>
                ) : (
                    <CardContent className="p-0">
                        <div className="bg-green-600 p-8 text-center text-white">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icon name="CheckCircle" size={48} />
                            </div>
                            <h2 className="text-2xl font-bold">Verified Credential</h2>
                            <p className="opacity-90">This certificate is authentic and valid.</p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Recipient Name</label>
                                <p className="text-xl font-bold text-slate-900">{verificationData.studentName}</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Course Name</label>
                                <p className="text-lg font-semibold text-slate-800">{verificationData.courseTitle}</p>
                            </div>

                            <div className="flex justify-between">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Issue Date</label>
                                    <p className="font-medium text-slate-700">{new Date(verificationData.issueDate).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Certificate ID</label>
                                    <p className="font-mono font-medium text-slate-700">{id}</p>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100">
                                <Button variant="outline" className="w-full" onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${verificationData.pdfUrl}`, '_blank')}>
                                    <Icon name="Download" size={16} className="mr-2" />
                                    View Digital Copy
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>
            
            <p className="mt-8 text-sm text-slate-400">
                &copy; {new Date().getFullYear()} Petluri Edutech. All rights reserved.
            </p>
        </div>
    );
};

export default VerifyCertificate;
