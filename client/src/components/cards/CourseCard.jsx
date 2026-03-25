import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

const CourseCard = ({ course, type = 'professional', onEnrollClick, isEnrolled = false }) => {
    const { title, description, duration, level, image, price } = course;
    const navigate = useNavigate();

    // Derived or Default Data (Mocking missing fields based on UI requirement)
    // In a real scenario, these should come from the backend.
    const courseCode = course.courseCode || "EDZ-2026-cOU-463";
    const mode = course.mode || "Hybrid";
    const startDate = course.startDate || "06/02/2026";
    const endDate = course.endDate || "04/03/2026";

    // Status Logic
    const status = isEnrolled ? (course.progress === 100 ? "Completed" : "In Progress") : "Available";
    const statusColor = status === "Completed" ? "bg-green-100 text-green-700" : (isEnrolled ? "bg-blue-100 text-blue-700" : "bg-indigo-100 text-indigo-700");

    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full flex flex-col border border-slate-200 rounded-xl bg-white relative">

            <CardContent className="p-6 flex flex-col h-full relative z-10">
                {/* 1. Top Badges */}
                <div className="flex items-center gap-3 mb-4">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                        {type}
                    </Badge>
                    <Badge variant="secondary" className={`${statusColor} hover:${statusColor} border-none px-3 py-1 text-xs font-semibold`}>
                        {status}
                    </Badge>
                </div>

                {/* 2. Course Code */}
                <div className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wide">
                    {courseCode}
                </div>

                {/* 3. Title */}
                <h3 className="text-xl font-bold text-slate-900 mb-3 leading-tight line-clamp-2">
                    {title}
                </h3>

                {/* 4. Description */}
                <p className="text-sm text-slate-500 mb-6 line-clamp-2 leading-relaxed">
                    {description || "Join this comprehensive program to master in-demand skills and boost your career prospects."}
                </p>

                {/* 5. Metadata Icons - Grid Layout */}
                <div className="grid grid-cols-1 gap-y-3 mb-6 mt-auto">
                    {/* Duration */}
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                            <Icon name="Clock" size={18} />
                        </div>
                        <span className="font-medium">{duration || "4 Weeks"}</span>
                    </div>

                    {/* Mode */}
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                            <Icon name="Home" size={18} />
                        </div>
                        <span className="font-medium">{mode}</span>
                    </div>

                    {/* Price if not enrolled */}
                    {!isEnrolled && (
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                            <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                                <Icon name="CreditCard" size={18} />
                            </div>
                            <span className="font-bold text-slate-900">{price ? `₹${price}` : 'Free'}</span>
                        </div>
                    )}

                    {/* Progress if enrolled */}
                    {isEnrolled && (
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                            <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                                <Icon name="BarChart" size={18} />
                            </div>
                            <span className="font-medium">Progress: {course.progress || 0}%</span>
                        </div>
                    )}
                </div>

                {/* 6. Button */}
                <div className="mt-2 flex gap-3">
                    {isEnrolled ? (
                        <Link to={`/student/learning/${course._id}`} className="flex-1">
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-lg text-base shadow-sm transition-all hover:shadow-md flex items-center justify-between px-6"
                            >
                                Continue Learning
                                <Icon name="PlayCircle" size={20} />
                            </Button>
                        </Link>
                    ) : onEnrollClick ? (
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-lg text-base shadow-sm transition-all hover:shadow-md"
                            onClick={(e) => {
                                e.preventDefault();
                                onEnrollClick(course);
                            }}
                        >
                            Enroll Now
                        </Button>
                    ) : (
                        <Link to={`/courses/${course._id}`} className="flex-1">
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-lg text-base shadow-sm transition-all hover:shadow-md flex items-center justify-between px-6"
                            >
                                View Details
                                <Icon name="ChevronRight" size={20} />
                            </Button>
                        </Link>
                    )}
                </div>

            </CardContent>
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
        </Card>
    );
};

export { CourseCard };
