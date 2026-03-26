import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/navigation/Sidebar';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Menu } from 'lucide-react';

const adminMenuItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: 'LayoutDashboard' },
    { name: 'Programs', path: '/admin/programs', icon: 'LayoutList' },
    { name: 'Invite', path: '/admin/students', icon: 'UserPlus' },
    { name: 'Enrollments', path: '/admin/enrollments', icon: 'CreditCard' },
    { name: 'Quizzes', path: '/admin/quizzes', icon: 'BrainCircuit' },
    { name: 'Videos', path: '/admin/videos', icon: 'Video' },
    { name: 'Certificates', path: '/admin/certificates', icon: 'Award' },
    { name: 'Internships', path: '/admin/internships', icon: 'FileText' },
    { name: 'Reports', path: '/admin/reports', icon: 'BarChart3' },
    { name: 'Settings', path: '/admin/settings', icon: 'Settings' },
];

const AdminLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    return (
        <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
            <Sidebar
                menuItems={adminMenuItems}
                title="Petluri"
                titleSub="ADMIN"
                logoHref="/admin/dashboard"
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden w-full transition-all duration-300">
                {/* Admin Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <button 
                            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">Admin Console</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Admin Profile Snippet */}
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-medium text-slate-900">Admin User</p>
                                <p className="text-xs text-slate-500">Super Admin</p>
                            </div>
                            <div className="h-10 w-10 bg-brand-yellow/20 rounded-full flex items-center justify-center text-brand-yellow font-bold border border-brand-yellow/50">
                                AD
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto p-8 bg-slate-50/50">
                    <Breadcrumb />
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
