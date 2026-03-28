import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const LoginPage = () => {
    const navigate = useNavigate();
    const { user, sendOtp, loginWithOtp } = useAuth();
    
    // Step 1: email, Step 2: otp
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef([]);

    useEffect(() => {
        if (user && user.role === 'student') {
            navigate('/student/dashboard');
        }
    }, [user, navigate]);

    useEffect(() => {
        let timer;
        if (resendTimer > 0) {
            timer = setInterval(() => setResendTimer(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [resendTimer]);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await sendOtp(email);
            setStep(2);
            setResendTimer(60);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send OTP. Is your email registered?');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        if (isNaN(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.substring(value.length - 1);
        setOtp(newOtp);

        // Move to next input
        if (value && index < 5) {
            otpRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1].focus();
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        const otpString = otp.join('');
        if (otpString.length < 6) return;
        
        setError('');
        setLoading(true);

        try {
            const data = await loginWithOtp(email, otpString);
            if (data.role !== 'student') {
                setError('Access denied. This portal is for students only.');
                setLoading(false);
                return;
            }
            navigate('/student/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid or expired OTP code.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 py-12 px-4">
            <Card className="w-full max-w-md shadow-2xl border-none ring-1 ring-slate-200">
                <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-6">
                        <img src="/logo.jpg" alt="Petluri Edutech" className="h-24 w-auto object-contain hover:scale-105 transition-transform" />
                    </div>
                    <CardTitle className="text-3xl font-extrabold text-slate-900 tracking-tight">Student Access</CardTitle>
                    <CardDescription className="text-slate-500 font-medium">
                        {step === 1 ? 'Enter your email to receive a login code' : `Enter the 6-digit code sent to ${email}`}
                    </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-6">
                    {error && (
                        <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl mb-6 flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-1">
                            <Icon name="AlertCircle" size={20} className="shrink-0" />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleSendOtp} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                                <Input 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="yourname@example.com" 
                                    type="email" 
                                    required 
                                    className="h-12 rounded-xl border-slate-200 focus:ring-blue-500 text-lg shadow-sm"
                                    disabled={loading} 
                                />
                            </div>
                            <Button type="submit" disabled={loading || !email} className="w-full h-12 text-lg font-bold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95">
                                {loading ? 'Sending Code...' : 'Get Login Code'}
                            </Button>
                            <p className="text-center text-sm text-slate-400 mt-6">
                                New here? <span className="text-blue-600 font-semibold cursor-default">Access is granted after enrollment.</span>
                            </p>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <div className="flex justify-between gap-2">
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={el => otpRefs.current[index] = el}
                                        type="text"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:border-blue-500 focus:outline-none bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-50/50"
                                        disabled={loading}
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </div>
                            
                            <Button 
                                type="submit" 
                                disabled={loading || otp.join('').length < 6} 
                                className="w-full h-12 text-lg font-bold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                            >
                                {loading ? 'Verifying...' : 'Login to Dashboard'}
                            </Button>

                            <div className="flex flex-col items-center gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                                    disabled={loading}
                                >
                                    Change email address
                                </button>
                                
                                <div className="text-sm text-slate-500">
                                    {resendTimer > 0 ? (
                                        <span>Resend code in <strong className="text-slate-900">{resendTimer}s</strong></span>
                                    ) : (
                                        <button 
                                            type="button" 
                                            onClick={handleSendOtp}
                                            className="text-blue-600 font-bold hover:underline"
                                            disabled={loading}
                                        >
                                            Resend Verification Code
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginPage;
