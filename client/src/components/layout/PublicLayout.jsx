import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/navigation/Navbar';

const PublicLayout = () => {
    return (
        <div className="min-h-screen flex flex-col bg-white font-sans text-slate-900">
            <Navbar />
            <main className="flex-1 w-full">
                <Outlet />
            </main>
            <footer className="border-t border-slate-100 bg-slate-50 pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6 lg:px-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                        {/* Column 1: Brand & Contact */}
                        <div className="space-y-4">
                            <img src="/logo.jpg" alt="Petluri Edutech" className="h-14 w-auto object-contain mix-blend-multiply" />
                            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                                Empower your career with industry-standard certification and professional training.
                                Learn today, lead tomorrow.
                            </p>
                            <div className="space-y-2 pt-2">
                                <p className="text-sm font-medium text-slate-700">Contact Us</p>
                                <p className="text-sm text-slate-500">support@petluri.com</p>
                                <p className="text-sm text-slate-500">+91 98765 43210</p>
                            </div>
                        </div>

                        {/* Column 2: Quick Links */}
                        <div className="md:ml-auto">
                            <h4 className="font-semibold text-slate-900 mb-6">Quick Links</h4>
                            <ul className="space-y-3">
                                <li>
                                    <a href="/" className="text-sm text-slate-500 hover:text-brand-blue transition-colors">Home</a>
                                </li>
                                <li>
                                    <a href="/courses/free" className="text-sm text-slate-500 hover:text-brand-blue transition-colors">Free Courses</a>
                                </li>
                                <li>
                                    <a href="/courses/certification" className="text-sm text-slate-500 hover:text-brand-blue transition-colors">Certifications</a>
                                </li>
                                <li>
                                    <a href="/internships" className="text-sm text-slate-500 hover:text-brand-blue transition-colors">Internships</a>
                                </li>
                                 <li>
                                     <a href="/about" className="text-sm text-slate-500 hover:text-brand-blue transition-colors">About Us</a>
                                 </li>
                                 <li>
                                     <a href="/admin/login" className="text-sm text-slate-400 hover:text-brand-blue transition-colors">Admin Portal</a>
                                 </li>
                             </ul>
                        </div>

                        {/* Column 3: Verify Certificate */}
                        <div className="md:ml-auto">
                            <h4 className="font-semibold text-slate-900 mb-6">Credential Check</h4>
                            <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm max-w-xs">
                                <p className="text-sm text-slate-500 mb-4">
                                    Employers and institutions can verify student certificates here.
                                </p>
                                <a
                                    href="/verify"
                                    className="block w-full text-center bg-slate-900 text-white font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                    Verify Certificate
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-slate-500">
                            © 2026 Petluri Edutech. All rights reserved.
                        </p>
                        <div className="flex gap-6">
                            <a href="#" className="text-sm text-slate-400 hover:text-slate-600">Privacy Policy</a>
                            <a href="#" className="text-sm text-slate-400 hover:text-slate-600">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PublicLayout;
