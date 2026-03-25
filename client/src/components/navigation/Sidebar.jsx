import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

import { useAuth } from '@/context/AuthContext';

const Sidebar = ({ menuItems, title, titleSub, logoHref = "/", isOpen = false, onClose }) => {
    const { logout } = useAuth();

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to log out?")) {
            logout();
        }
    };

    return (
        <>
            {/* Backdrop for mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/50 z-40 md:hidden animate-in fade-in duration-200"
                    onClick={onClose}
                />
            )}

            <div className={cn(
                "h-screen w-64 bg-white border-r border-slate-200 flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out md:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
            {/* Sidebar Header */}
            <div className="h-20 flex items-center justify-center px-4 border-b border-slate-100">
                <Link to={logoHref} className="flex items-center justify-center w-full h-full">
                    <img src="/logo.jpg" alt={title} className="h-12 w-auto object-contain" />
                </Link>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-blue-50 text-brand-blue"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <Icon
                                    name={item.icon}
                                    size="sm"
                                    className={isActive ? "text-brand-blue" : "text-slate-400 group-hover:text-slate-500"}
                                />
                                {item.name}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Sidebar Footer (Logout) */}
            <div className="p-4 border-t border-slate-100">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50"
                    onClick={handleLogout}
                >
                    <Icon name="LogOut" className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </div>
    </>
    );
};

export { Sidebar };
