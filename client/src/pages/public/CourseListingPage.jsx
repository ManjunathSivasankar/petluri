import React, { useState, useEffect } from 'react';
import { CourseCard } from '@/components/cards/CourseCard';
import PageHero from '@/components/cards/PageHero';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import api from '@/lib/api';
import EnrollmentFormModal from '@/components/EnrollmentFormModal';
import { useAuth } from '@/context/AuthContext';

const CourseListingPage = ({ title, subtitle, type = 'professional' }) => {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
    const [selectedCourseForEnrollment, setSelectedCourseForEnrollment] = useState(null);

    const handleEnrollClick = (course) => {
        setSelectedCourseForEnrollment(course);
        setIsEnrollModalOpen(true);
    };

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                // Fetch all courses and filter by type client-side
                const response = await api.get('/courses');
                // Backend returns array directly. Check if array, else default to empty
                const allCourses = Array.isArray(response.data) ? response.data :
                    (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];

                console.log(`[DEBUG] Fetched ${allCourses.length} courses total.`);
                console.log(`[DEBUG] Filtering for type: '${type}'`);

                // Filter matches the logic seen in App.jsx routing
                // Case-insensitive comparison just in case
                const filtered = allCourses.filter(c => {
                    const match = c.type && c.type.toLowerCase() === type.toLowerCase();
                    if (c.type && c.isPublished) {
                        console.log(`[DEBUG] Course: ${c.title}, Type: '${c.type}', Match: ${match}`);
                    }
                    return match;
                });

                console.log(`[DEBUG] Filtered ${filtered.length} courses for ${type}`);
                setCourses(filtered);
            } catch (error) {
                console.error("Failed to fetch courses:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCourses();
    }, [type]);

    // Configuration for PageHero based on route type
    const heroConfig = {
        internship: {
            title: "Industry Internships",
            description: "Gain real world experience working on live projects with mentorship.",
            badge: "Career Launchpad",
            variant: "primary", // Purple
            iconName: "Briefcase"
        },
        free: {
            title: "Free Courses",
            description: "Start learning today with our high-quality free courses.",
            badge: "Community Access",
            variant: "blue",
            iconName: "BookOpen"
        },
        certification: {
            title: "Certification Courses",
            description: "Get certified and boost your career credentials.",
            badge: "Verified Skills",
            variant: "green",
            iconName: "Award"
        },
        professional: {
            title: title || "Professional Training",
            description: subtitle || "In-depth professional training for career transformation.",
            badge: "Career Pro",
            variant: "dark",
            iconName: "TrendingUp"
        }
    };

    const currentHero = heroConfig[type] || heroConfig.professional;

    return (
        <div className="py-8 bg-slate-50 min-h-screen">
            <div className="container mx-auto px-4">

                {/* New Page Hero */}
                <PageHero
                    title={currentHero.title}
                    description={currentHero.description}
                    badge={currentHero.badge}
                    variant={currentHero.variant}
                    iconName={currentHero.iconName}
                />

                {/* Filter Toolbar */}
                {type === 'internship' ? (
                    // Specific UI for Internships (Tabs + Filters) as per design
                    <div className="flex flex-col xl:flex-row gap-6 mb-8 items-center justify-between">
                        <div className="bg-white p-1 rounded-lg border border-slate-200 inline-flex shadow-sm">
                            <button className="px-4 py-2 text-sm font-medium rounded-md bg-purple-100 text-purple-700 transition-colors">All Internships</button>
                            <button className="px-4 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 transition-colors">Ongoing</button>
                            <button className="px-4 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 transition-colors">Upcoming</button>
                            <button className="px-4 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 transition-colors">Closed / Past</button>
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                            <Select className="w-40 h-10 bg-white shadow-sm border-slate-200">
                                <option>Registration: All</option>
                                <option>Open</option>
                                <option>Closed</option>
                            </Select>
                            <Select className="w-40 h-10 bg-white shadow-sm border-slate-200">
                                <option>Start Time: Any</option>
                                <option>This Month</option>
                                <option>Next Month</option>
                            </Select>
                            <Select className="w-40 h-10 bg-white shadow-sm border-slate-200">
                                <option>Duration: Any</option>
                                <option>1-3 Months</option>
                                <option>3-6 Months</option>
                            </Select>
                        </div>
                    </div>
                ) : (
                    // Standard Filters for other pages
                    <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                        <div className="relative w-full md:w-96">
                            <Icon name="Search" className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <Input placeholder="Search courses..." className="pl-10" />
                        </div>
                        <div className="flex w-full md:w-auto gap-4">
                            <Select className="w-full md:w-48">
                                <option value="">All Levels</option>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </Select>
                            <Select className="w-full md:w-48">
                                <option value="">All Durations</option>
                                <option value="short">Short (&lt; 5h)</option>
                                <option value="medium">Medium (5-20h)</option>
                                <option value="long">Long (20h+)</option>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Course Grid */}
                {loading ? (
                    <div className="text-center py-20">
                        <p className="text-slate-500">Loading courses...</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {courses.map((course) => (
                                <CourseCard key={course._id} course={course} type={type} onEnrollClick={handleEnrollClick} />
                            ))}
                        </div>

                        {/* Empty State */}
                        {courses.length === 0 && (
                            <div className="text-center py-20">
                                <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon name="Search" className="text-slate-400" size={32} />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900">No courses found</h3>
                                <p className="text-slate-500">Try adjusting your search or filters.</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {selectedCourseForEnrollment && (
                <EnrollmentFormModal
                    isOpen={isEnrollModalOpen}
                    onClose={() => {
                        setIsEnrollModalOpen(false);
                        setSelectedCourseForEnrollment(null);
                    }}
                    course={selectedCourseForEnrollment}
                    initialUser={user}
                />
            )}
        </div>
    );
};

export default CourseListingPage;
