import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const LoginPage = () => {
    const navigate = useNavigate();
    const { login, user } = useAuth();

    React.useEffect(() => {
        if (user && user.role === 'student') {
            navigate('/student/dashboard');
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

            if (data.role !== 'student') {
                setError('This login page is for Students only.');
                setLoading(false);
                return;
            }

            navigate('/student/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="w-full max-w-md shadow-xl border-slate-100">
                <CardHeader className="text-center space-y-2">
                    <div className="flex justify-center mb-6">
                        <img src="/logo.jpg" alt="Petluri Edutech" className="h-28 w-auto object-contain" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900">Student Login</CardTitle>
                    <CardDescription>Sign in to continue your learning journey</CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4 flex items-center gap-2">
                            <Icon name="AlertCircle" size="sm" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Email Address</label>
                            <Input name="email" placeholder="student@example.com" type="email" required disabled={loading} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-slate-700">Password</label>
                                <Link to="/forgot-password" className="text-xs text-brand-blue hover:underline">Forgot password?</Link>
                            </div>
                            <Input name="password" placeholder="••••••••" type="password" required disabled={loading} />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full h-11 text-base mt-2">
                            {loading ? 'Logging in...' : 'Start Learning'}
                        </Button>
                        <p className="text-center text-xs text-slate-500 mt-4">
                            Don't have an account? <span className="text-brand-blue">It will be created automatically upon enrollment.</span>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginPage;
