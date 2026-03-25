import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { loadRazorpay } from '@/components/utils/loadRazorpay';
import { useNavigate } from 'react-router-dom';

const EnrollmentFormModal = ({ isOpen, onClose, course, initialUser = null }) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        collegeName: '',
        collegeDetails: '',
        personalAddress: ''
    });

    const [loadingEmailCheck, setLoadingEmailCheck] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialUser) {
            setFormData({
                name: initialUser.name || '',
                email: initialUser.email || '',
                phone: initialUser.phone || '',
                collegeName: initialUser.collegeName || '',
                collegeDetails: initialUser.collegeDetails || '',
                personalAddress: initialUser.personalAddress || ''
            });
        }
    }, [initialUser]);

    const handleEmailBlur = async () => {
        if (!formData.email || initialUser) return;

        setLoadingEmailCheck(true);
        try {
            const res = await api.post('/auth/check-email', { email: formData.email });
            if (res.data.exists) {
                const user = res.data.user;
                setFormData(prev => ({
                    ...prev,
                    name: user.name || prev.name,
                    phone: user.phone || prev.phone,
                    collegeName: user.collegeName || prev.collegeName,
                    collegeDetails: user.collegeDetails || prev.collegeDetails,
                    personalAddress: user.personalAddress || prev.personalAddress
                }));
            }
        } catch (error) {
            console.error("Failed to check email", error);
        } finally {
            setLoadingEmailCheck(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setEnrolling(true);

        try {
            if (course.price <= 0) {
                // Handle free course
                const res = await api.post('/payments/enroll-free', {
                    courseId: course._id,
                    userDetails: formData
                });

                if (res.data.success) {
                    alert("Enrolled successfully in free course! Check your email for login details if you're a new user.");
                    onClose();
                    navigate('/login');
                }
                return;
            }

            // Handle paid course with Razorpay
            const res = await loadRazorpay();
            if (!res) {
                throw new Error('Razorpay SDK failed to load. Are you online?');
            }

            // Create Order
            const orderRes = await api.post('/payments/create-order', { courseId: course._id });

            if (!orderRes.data || !orderRes.data.id) {
                throw new Error("Server error. Could not create order.");
            }

            const { amount, id: order_id, currency } = orderRes.data;

            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'dummy_key', // Ensure this is available in frontend env
                amount: amount.toString(),
                currency: currency,
                name: 'Petluri Edutech',
                description: `Enrollment for ${course.title}`,
                order_id: order_id,
                handler: async function (response) {
                    try {
                        const verifyRes = await api.post('/payments/verify', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            courseId: course._id,
                            userDetails: formData
                        });

                        if (verifyRes.data.success) {
                            alert("Enrollment Successful! Check email for credentials if you are a new user.");
                            onClose();
                            navigate('/login');
                        } else {
                            setError("Payment verification failed.");
                        }
                    } catch (error) {
                        console.error("Verification Error", error);
                        setError("Payment verification failed on server.");
                    }
                },
                prefill: {
                    name: formData.name,
                    email: formData.email,
                    contact: formData.phone
                },
                theme: {
                    color: '#2563EB'
                }
            };

            const paymentObject = new window.Razorpay(options);
            paymentObject.on('payment.failed', function (response) {
                setError("Payment Failed. Reason: " + response.error.description);
            });
            paymentObject.open();

        } catch (error) {
            console.error("Enrollment error", error);
            const serverError = error.response?.data?.error || error.response?.data?.message || error.message;
            setError(serverError || "An unexpected error occurred.");
        } finally {
            setEnrolling(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                    <X size={24} />
                </button>

                <CardHeader className="border-b border-slate-100 pb-4">
                    <CardTitle className="text-xl text-slate-900">Enroll in Course</CardTitle>
                    <CardDescription>
                        {course.title} - <span className="font-semibold text-blue-600">{course.price ? `₹${course.price}` : 'Free'}</span>
                    </CardDescription>
                </CardHeader>

                <CardContent className="pt-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    onBlur={handleEmailBlur}
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="your.email@example.com"
                                    disabled={loadingEmailCheck}
                                />
                                {loadingEmailCheck && (
                                    <Loader2 className="absolute right-3 top-2.5 h-5 w-5 animate-spin text-blue-500" />
                                )}
                            </div>
                            {!initialUser && <p className="text-xs text-slate-500">We'll fetch your details if you already have an account.</p>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Phone Number <span className="text-red-500">*</span></label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                pattern="[0-9]{10}"
                                title="Please enter a valid 10-digit phone number"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="10-digit phone number"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">College Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="collegeName"
                                value={formData.collegeName}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="University Name"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">College Details (Degree, Year) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="collegeDetails"
                                value={formData.collegeDetails}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. B.Tech Computer Science, 3rd Year"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Personal Address <span className="text-red-500">*</span></label>
                            <textarea
                                name="personalAddress"
                                value={formData.personalAddress}
                                onChange={handleChange}
                                required
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder="Your full residential address"
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2.5"
                            disabled={enrolling || loadingEmailCheck}
                        >
                            {enrolling ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                `Proceed to Pay ${course.price ? `₹${course.price}` : 'Free'}`
                            )}
                        </Button>
                    </form>
                </CardContent>
            </div>
        </div>
    );
};

export default EnrollmentFormModal;
