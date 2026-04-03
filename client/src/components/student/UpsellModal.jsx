import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { CourseCard } from '@/components/cards/CourseCard';
import { Icon } from '@/components/ui/Icon';

const UpsellModal = ({ isOpen, onClose, course, certificateCourse, professionalCourse }) => {
    // If no course references are available, don't break, just show generic
    const hasCert = !!certificateCourse;
    const hasProf = !!professionalCourse;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2 text-indigo-700">
                    <Icon name="Unlock" size={24} />
                    <span>Unlock Full Access</span>
                </div>
            }
            className="max-w-4xl"
        >
            <div className="space-y-6">
                <div className="text-center space-y-2">
                    <p className="text-slate-600 text-lg">
                        You've reached the limit for the free previews in <strong>{course?.title || 'this course'}</strong>.
                    </p>
                    <p className="text-slate-500">
                        To unlock the remaining modules and get a certificate, please upgrade your enrollment to one of the premium courses below.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    {/* Certificate Course Option */}
                    {hasCert && (
                        <div className="flex flex-col relative w-full h-full pb-0 mb-0">
                             <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full z-10 whitespace-nowrap shadow-sm border border-yellow-200 uppercase tracking-widest">
                                Popular Choice
                            </div>
                            <div className="h-full border-2 border-transparent">
                                <CourseCard course={certificateCourse} type="certification" />
                            </div>
                        </div>
                    )}
                    
                    {/* Professional Course Option */}
                    {hasProf && (
                        <div className="flex flex-col relative w-full h-full pb-0 mb-0">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full z-10 whitespace-nowrap shadow-sm border border-purple-200 uppercase tracking-widest">
                                Mastery Program
                            </div>
                            <div className="h-full border-2 border-purple-300 rounded-xl overflow-hidden relative shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                                <CourseCard course={professionalCourse} type="professional" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export { UpsellModal };
