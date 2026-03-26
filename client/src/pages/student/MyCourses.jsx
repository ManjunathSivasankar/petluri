import React, { useEffect, useState } from 'react';
import { CourseCard } from '@/components/cards/CourseCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import api from '@/lib/api';

const MyCourses = () => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const { data } = await api.get('/student/courses');
                setCourses(data);
            } catch (error) {
                console.error('Failed to fetch enrolled courses:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCourses();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading your courses...</div>;
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-8">My Enrolled Courses</h1>

            {courses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(course => (
                        <div key={course._id} className="relative group">
                            <CourseCard course={course} type="free" isEnrolled={true} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No courses found</h3>
                    <p className="text-slate-500 mb-6">You haven't enrolled in any courses yet.</p>
                    <button 
                        onClick={() => window.location.href = '/courses'}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Browse Courses
                    </button>
                </div>
            )}
        </div>
    );
};

export default MyCourses;
