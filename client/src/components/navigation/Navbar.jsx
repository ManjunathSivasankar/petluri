import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { Menu, X, User, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const Navbar = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const navLinks = [
        { name: "Free Courses", path: "/courses/free" },
        { name: "Certification", path: "/courses/certification" },
        { name: "Internships", path: "/internships" },
        { name: "Professional", path: "/courses/professional" },
        { name: "About", path: "/about" },
    ];

    const getLogoLink = () => {
        if (!user) return "/";
        return user.role === 'admin' ? "/admin/dashboard" : "/student/dashboard";
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to log out?")) {
            logout();
            navigate('/login');
        }
    };

    return (
        <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link to={getLogoLink()} className="flex items-center gap-2 group">
                    <img src="/logo.jpg" alt="Petluri Edutech" className="h-12 w-auto object-contain" />
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            to={link.path}
                            className="text-sm font-medium text-slate-600 hover:text-brand-blue transition-colors"
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>

                {/* CTA & Mobile Menu Toggle */}
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-3">
                        {user ? (
                            <>
                                <Link to={user.role === 'admin' ? "/admin/dashboard" : "/student/profile"}>
                                    <Button variant="ghost" size="sm" className="gap-2 text-slate-600">
                                        <User size={18} />
                                        <span>Profile</span>
                                    </Button>
                                </Link>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="gap-2 text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                    onClick={handleLogout}
                                >
                                    <LogOut size={18} />
                                    <span>Logout</span>
                                </Button>
                            </>
                        ) : (
                            <Link to="/login">
                                <Button variant="default" className="shadow-none px-6">Login</Button>
                            </Link>
                        )}
                    </div>

                    <button
                        className="md:hidden p-2 text-slate-600"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t border-slate-100 bg-white py-4 px-4 flex flex-col gap-2 shadow-lg absolute w-full left-0 animate-in slide-in-from-top duration-200">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            to={link.path}
                            className="text-sm font-medium text-slate-600 py-3 px-2 hover:bg-slate-50 rounded-lg"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {link.name}
                        </Link>
                    ))}
                    <div className="border-t border-slate-100 mt-2 pt-4 flex flex-col gap-2">
                        {user ? (
                            <>
                                <Link 
                                    to={user.role === 'admin' ? "/admin/dashboard" : "/student/profile"}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center gap-3 py-3 px-2 text-slate-600 font-medium"
                                >
                                    <User size={20} />
                                    <span>My Profile</span>
                                </Link>
                                <button
                                    onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                                    className="flex items-center gap-3 py-3 px-2 text-red-600 font-medium"
                                >
                                    <LogOut size={20} />
                                    <span>Logout</span>
                                </button>
                            </>
                        ) : (
                            <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="default" className="w-full h-11">Login</Button>
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};
