import React, { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const FeatureCard = ({ icon, title, description }) => (
    <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Icon name={icon} className="text-brand-blue" size="lg" />
            </div>
            <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-slate-600 leading-relaxed">
                {description}
            </p>
        </CardContent>
    </Card>
);

const LandingPage = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && user) {
            navigate(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
        }
    }, [user, loading, navigate]);

    if (loading) return null; // Prevents flash of landing page content while checking auth

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section */}
            <section className="relative py-20 lg:py-32 bg-brand-blue text-white overflow-hidden">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                    <div className="absolute -top-20 -right-20 w-96 h-96 bg-brand-yellow rounded-full blur-[100px] opacity-20" />
                    <div className="absolute bottom-0 left-20 w-72 h-72 bg-white rounded-full blur-[100px] opacity-10" />
                </div>

                <div className="container mx-auto px-4 relative z-10 text-center">
                    <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium rounded-full inline-flex">
                        🚀 Launch your career today
                    </Badge>
                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight">
                        Master Real-World Skills <br className="hidden md:block" />
                        with <span className="text-brand-yellow">Petluri Edutech</span>
                    </h1>
                    <p className="text-lg md:text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
                        The professional Learning Management System designed for your success. Access top-tier certification and professional courses today.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Link to="/courses/professional">
                            <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 shadow-xl shadow-brand-blue/20">
                                Explore Courses
                            </Button>
                        </Link>
                        <Link to="/login">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8 bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white">
                                Student Login
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 bg-slate-50">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Why Choose Petluri?</h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">We provide a seamless learning experience with industry-standard curriculum and verifiable certifications.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon="BookOpen"
                            title="Expert-Led Courses"
                            description="Learn from industry professionals with curriculum designed for real-world application."
                        />
                        <FeatureCard
                            icon="Award"
                            title="Recognized Certificates"
                            description="Earn certificates that add value to your resume and can be instantly verified online."
                        />
                        <FeatureCard
                            icon="MonitorPlay"
                            title="Interactive Learning"
                            description="Engage with high-quality video lessons, quizzes, and practical assignments."
                        />
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
