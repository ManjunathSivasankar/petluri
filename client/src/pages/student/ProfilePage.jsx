import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

const ProfilePage = () => {
    const { user } = useAuth();

    if (!user) return <div className="p-8">Loading profile...</div>;

    // Split name for the grid if possible
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-900 mb-8">My Profile</h1>

            <Card className="border-none shadow-md">
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">First Name</label>
                            <Input defaultValue={firstName} readOnly className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Last Name</label>
                            <Input defaultValue={lastName} readOnly className="bg-slate-50" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Email Address</label>
                        <Input defaultValue={user.email} disabled className="bg-slate-50" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Role</label>
                        <Input defaultValue={user.role} disabled className="bg-slate-50 capitalize" />
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                        <p>Account managed by Petluri Edutech</p>
                        <Button variant="outline" size="sm" onClick={() => alert('Profile editing coming soon!')}>Request Change</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ProfilePage;
