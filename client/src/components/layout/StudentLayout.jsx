import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/navigation/Sidebar';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { useAuth } from '@/context/AuthContext';
import { Menu } from 'lucide-react';

const studentMenuItems = [
    { name: 'Dashboard', path: '/student/dashboard', icon: 'LayoutDashboard' },
    { name: 'My Courses', path: '/student/courses', icon: 'Book' },
    { name: 'My Certificates', path: '/student/certificates', icon: 'Award' },
    { name: 'Explore Courses', path: '/courses/free', icon: 'Search' },
    { name: 'Profile', path: '/student/profile', icon: 'User' },
];

const StudentLayout = () => {
    const { user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    
    // Get initials from name
    const getInitials = (name) => {
        if (!name) return 'S';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar
                menuItems={studentMenuItems}
                title="Petluri"
                titleSub="STUDENT"
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden w-full transition-all duration-300">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button 
                            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg md:text-xl font-semibold text-slate-800 truncate">Student Portal</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* User Profile Snippet */}
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-medium text-slate-900">{user?.name || 'Loading...'}</p>
                                <p className="text-xs text-slate-500 capitalize">{user?.role || 'Student'}</p>
                            </div>
                            <div className="h-10 w-10 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                {getInitials(user?.name)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto p-8">
                    <Breadcrumb />
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default StudentLayout;
