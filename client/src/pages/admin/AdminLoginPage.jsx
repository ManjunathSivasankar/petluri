import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const AdminLoginPage = () => {
    const navigate = useNavigate();
    const { login, user } = useAuth();

    React.useEffect(() => {
        if (user && user.role === 'admin') {
            navigate('/admin/dashboard');
        }
    }, [user, navigate]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            const data = await login(email, password);

            if (data.role !== 'admin') {
                setError('Access Denied: This portal is for Administrators only.');
                setLoading(false);
                return;
            }

            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Invalid Credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="w-full max-w-md shadow-xl border-slate-100 bg-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center mb-6">
                        <img src="/logo.jpg" alt="Petluri Edutech" className="h-28 w-auto object-contain" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-bold text-slate-900">Administration Portal</CardTitle>
                        <CardDescription className="text-red-600 font-medium mt-1">Restricted Access</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4 flex items-center gap-2 border border-red-100">
                            <Icon name="AlertTriangle" size="sm" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Admin Email</label>
                            <Input
                                name="email"
                                placeholder="admin@petluri.com"
                                type="email"
                                required
                                disabled={loading}
                                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Password</label>
                            <Input
                                name="password"
                                placeholder="••••••••"
                                type="password"
                                required
                                disabled={loading}
                                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 text-base mt-2 bg-slate-900 hover:bg-slate-800 text-white border-0"
                        >
                            {loading ? 'Authenticating...' : 'Access Dashboard'}
                        </Button>
                    </form>

                    <div className="mt-8 text-center border-t border-slate-50 pt-4">
                        <p className="text-xs text-slate-500">
                            Authorized personnel only. Use of this system is monitored.
                        </p>
                        <a href="/" className="inline-block mt-2 text-xs text-brand-blue hover:text-blue-700">Return to Public Site</a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminLoginPage;
