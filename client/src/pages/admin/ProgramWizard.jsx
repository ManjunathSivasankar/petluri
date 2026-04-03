import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Icon } from '@/components/ui/Icon';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import api from '@/lib/api';
import ModuleEditor from '@/components/admin/ModuleEditor';
import ProgramValidator from '@/components/admin/ProgramValidator';
import { validateProgram } from '@/utils/programValidation';
import { useNavigate, useParams } from 'react-router-dom';

const ProgramWizard = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // Get course ID from URL
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [quizzes, setQuizzes] = useState([]);
    const [highlightModule, setHighlightModule] = useState(null);
    const [publishedCourses, setPublishedCourses] = useState([]);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'certification',
        level: 'Beginner',
        duration: '',
        price: '',
        programCode: '', // READ ONLY
        image: '', // Course Banner URL
        certificateTemplate: '', // Certificate Background URL
        internshipTemplate: '', // Internship Template URL (legacy)
        internshipOfferTemplate: '', // Internship Offer Letter Template URL
        internshipCertificateTemplate: '', // Internship Completion Certificate Template URL
        startDate: '', // Internship start date
        endDate: '',   // Internship end date
        modules: [{ title: 'Introduction', description: '', content: [] }], // Default module
        status: 'draft', // Default status
        upsell: { isEnabled: false, triggerType: 'video', triggerCondition: 2, certificateCourseId: '', professionalCourseId: '' }
    });

    // Validation Status
    const validationStatus = useMemo(() => validateProgram(formData), [formData]);

    // Fetch Course Data for Edit Mode
    useEffect(() => {
        const fetchCourseData = async () => {
            if (!id) return; // Only fetch if in edit mode

            try {
                setLoading(true);
                const res = await api.get(`/admin/courses/${id}`);
                const course = res.data;

                // Populate form data
                setFormData({
                    title: course.title || '',
                    description: course.description || '',
                    type: course.type || 'certification',
                    level: course.level || 'Beginner',
                    duration: course.duration || '',
                    price: course.price || '',
                    programCode: course.programCode || '',
                    image: course.image || '',
                    certificateTemplate: course.certificateTemplate || '',
                    internshipTemplate: course.internshipTemplate || '',
                    internshipOfferTemplate: course.internshipOfferTemplate || '',
                    internshipCertificateTemplate: course.internshipCertificateTemplate || '',
                    startDate: course.startDate ? course.startDate.split('T')[0] : '',
                    endDate: course.endDate ? course.endDate.split('T')[0] : '',
                    modules: course.modules || [],
                    status: course.status || (course.isPublished ? 'published' : 'draft'), // fallback for legacy
                    upsell: course.upsell || { isEnabled: false, triggerType: 'video', triggerCondition: 2, certificateCourseId: '', professionalCourseId: '' }
                });
            } catch (error) {
                console.error("Failed to fetch course details", error);
                alert("Failed to load course details.");
                navigate('/admin/programs');
            } finally {
                setLoading(false);
            }
        };

        fetchCourseData();
    }, [id, navigate]);

    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const res = await api.get('/admin/quizzes');
                setQuizzes(res.data);
            } catch (error) {
                console.error("Failed to fetch quizzes", error);
            }
        };
        fetchQuizzes();
    }, []);

    // Fetch Published Courses for Upsell Configuration
    useEffect(() => {
        const fetchPublishedCourses = async () => {
            try {
                const res = await api.get('/admin/courses');
                const allCourses = Array.isArray(res.data) ? res.data : [];
                // Only show published courses, and exclude the current course itself
                setPublishedCourses(allCourses.filter(c => c.isPublished && c._id !== id));
            } catch (error) {
                console.error("Failed to fetch published courses", error);
            }
        };
        fetchPublishedCourses();
    }, [id]);
    
    // URL Parameter Deep Linking
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const step = params.get('step');
        const module = params.get('module');
        
        if (step) setCurrentStep(parseInt(step));
        if (module) setHighlightModule(parseInt(module));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Auto-calculate internship duration
    useEffect(() => {
        if (formData.type === 'internship' && formData.startDate && formData.endDate) {
            const start = new Date(formData.startDate);
            const end = new Date(formData.endDate);
            if (!isNaN(start) && !isNaN(end) && end > start) {
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let durationStr = '';
                if (diffDays >= 30) {
                    const months = Math.round(diffDays / 30);
                    durationStr = `${months} Month${months > 1 ? 's' : ''}`;
                } else {
                    const weeks = Math.round(diffDays / 7);
                    durationStr = `${weeks} Week${weeks > 1 ? 's' : ''}`;
                }
                
                if (formData.duration !== durationStr) {
                    setFormData(prev => ({ ...prev, duration: durationStr }));
                }
            }
        }
    }, [formData.startDate, formData.endDate, formData.type]);

    const handleValueChange = (name, value) => {
        setFormData(prev => {
            const updates = { [name]: value };
            if (name === 'type' && value === 'free') {
                updates.price = 0;
            }
            return { ...prev, ...updates };
        });
    };

    const handleUpsellChange = (name, value) => {
        setFormData(prev => ({
            ...prev,
            upsell: {
                ...prev.upsell,
                [name]: value
            }
        }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await api.post('/admin/upload-image', formData);
            setFormData(prev => ({ ...prev, image: response.data.url }));
        } catch (error) {
            console.error("Image upload failed", error);
            alert("Failed to upload image.");
        }
    };

    const steps = ['Program Details', 'Curriculum & Content', 'Certification', 'Preview & Publish'];

    const handleNext = () => {
        // Basic Step 1 Validation
        if (currentStep === 0) {
            if (!formData.title || !formData.description) {
                alert("Please fill in Title and Description to proceed.");
                return;
            }
        }
        setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    };
    const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 0));

    const handleSubmit = async (targetStatus) => {
        setLoading(true);

        // Sanitize Data
        const sanitizedData = { ...formData }; // Clone
        sanitizedData.status = targetStatus;

        // 1. Handle Price
        if (!sanitizedData.price || isNaN(sanitizedData.price)) {
            sanitizedData.price = 0;
        } else {
            sanitizedData.price = Number(sanitizedData.price);
        }

        // 2. Handle Modules (QuizId)
        sanitizedData.modules = sanitizedData.modules.map(module => ({
            ...module,
            content: module.content.map(item => {
                const cleanItem = { ...item };
                if (cleanItem.type === 'quiz' && (!cleanItem.quizId || cleanItem.quizId === "")) {
                    delete cleanItem.quizId; // Remove if empty to avoid CastError
                }
                if (cleanItem.type === 'video') {
                    delete cleanItem.quizId; // Videos don't need quizId
                }
                return cleanItem;
            })
        }));

        // 3. Handle Upsell ObjectIds
        if (sanitizedData.upsell) {
            if (!sanitizedData.upsell.certificateCourseId) delete sanitizedData.upsell.certificateCourseId;
            if (!sanitizedData.upsell.professionalCourseId) delete sanitizedData.upsell.professionalCourseId;
        }

        try {
            if (id) {
                // Update existing course
                await api.put(`/admin/courses/${id}`, sanitizedData);
                alert(`Program ${targetStatus === 'published' ? 'Published' : 'Saved as Draft'} successfully!`);
            } else {
                // Create new course
                await api.post('/admin/courses', sanitizedData);
                alert(`Program ${targetStatus === 'published' ? 'Published' : 'Created as Draft'} successfully!`);
            }
            navigate('/admin/programs');
        } catch (error) {
            console.error("Failed to save program", error, error.response?.data);
            alert(`Failed to save program: ${error.response?.data?.message || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">{id ? 'Edit Program Details' : 'New Program Details'}</h2>
            </div>

            <div className="space-y-2">
                <Label htmlFor="title">Program Title <span className="text-red-500">*</span></Label>
                <Input id="title" name="title" value={formData.title} onChange={handleChange} placeholder="e.g., Full Stack Web Development" />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
                <TextArea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Detailed description..." className="min-h-[100px]" />
            </div>

            <div className="space-y-2">
                <Label htmlFor="image">Course Banner Image</Label>
                <div className="flex gap-4 items-center">
                    <Input id="image" type="file" onChange={handleImageUpload} accept="image/*" className="max-w-md" />
                    {formData.image && (
                        <div className="relative h-20 w-32 rounded overflow-hidden border border-slate-200">
                            <img src={formData.image} alt="Preview" className="h-full w-full object-cover" />
                        </div>
                    )}
                </div>
            </div>

            {id && (
                <div className="space-y-2">
                    <Label>Program Code (Auto-generated)</Label>
                    <Input value={formData.programCode} disabled className="bg-slate-100" />
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label>Program Type <span className="text-red-500">*</span></Label>
                    <select
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
                        value={formData.type}
                        onChange={(e) => handleValueChange('type', e.target.value)}
                    >
                        <option value="free">Free Course</option>
                        <option value="certification">Certification Program</option>
                        <option value="professional">Professional Masterclass</option>
                        <option value="internship">Internship Program</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <Label>Difficulty Level <span className="text-red-500">*</span></Label>
                    <select
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
                        value={formData.level}
                        onChange={(e) => handleValueChange('level', e.target.value)}
                    >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formData.type === 'internship' ? (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Internship Start Date <span className="text-red-500">*</span></Label>
                            <Input id="startDate" name="startDate" type="date" value={formData.startDate} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">Internship End Date <span className="text-red-500">*</span></Label>
                            <Input id="endDate" name="endDate" type="date" value={formData.endDate} onChange={handleChange} />
                        </div>
                    </>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="duration">Duration <span className="text-red-500">*</span></Label>
                        <Input id="duration" name="duration" value={formData.duration} onChange={handleChange} placeholder="e.g., 40 Hours" />
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="price">Price (₹) {formData.type !== 'free' && <span className="text-red-500">*</span>}</Label>
                    <Input
                        id="price"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        placeholder={formData.type === 'free' ? "Free" : "e.g., 4999"}
                        disabled={formData.type === 'free'}
                    />
                </div>
            </div>
            
            {/* Upsell Configuration */}
            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-md font-bold text-slate-800">Upsell Configuration (Optional)</h3>
                        <p className="text-xs text-slate-600">Suggest advanced courses after a student reaches a certain point in this program.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="upsellEnabled"
                            checked={formData.upsell?.isEnabled || false}
                            onChange={(e) => handleUpsellChange('isEnabled', e.target.checked)}
                            className="w-4 h-4 text-brand-blue rounded border-gray-300 focus:ring-brand-blue"
                        />
                        <Label htmlFor="upsellEnabled">Enable Upsell</Label>
                    </div>
                </div>

                {formData.upsell?.isEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-blue-100">
                        <div className="space-y-2">
                            <Label>Trigger Type</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                                value={formData.upsell.triggerType}
                                onChange={(e) => handleUpsellChange('triggerType', e.target.value)}
                            >
                                <option value="video">After X Videos Completed</option>
                                <option value="module">After X Modules Completed</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Trigger Condition (X)</Label>
                            <Input
                                type="number"
                                min="1"
                                value={formData.upsell.triggerCondition}
                                onChange={(e) => handleUpsellChange('triggerCondition', Number(e.target.value))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Certificate Course Upsell</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                                value={formData.upsell.certificateCourseId}
                                onChange={(e) => handleUpsellChange('certificateCourseId', e.target.value)}
                            >
                                <option value="">-- Select Course (Optional) --</option>
                                {publishedCourses.filter(c => c.type === 'certification').map(c => (
                                    <option key={c._id} value={c._id}>{c.title} ({c.programCode})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Professional Course Upsell</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                                value={formData.upsell.professionalCourseId}
                                onChange={(e) => handleUpsellChange('professionalCourseId', e.target.value)}
                            >
                                <option value="">-- Select Course (Optional) --</option>
                                {publishedCourses.filter(c => c.type === 'professional').map(c => (
                                    <option key={c._id} value={c._id}>{c.title} ({c.programCode})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-4">            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 text-sm text-blue-700">
                <Icon name="Info" size={20} className="mt-0.5 shrink-0" />
                <p>Organize your course into modules. You can add videos (upload) and quizzes (select existing) to each module.</p>
            </div>
            <ModuleEditor
                courseId={id}
                modules={formData.modules}
                setModules={(newModules) => handleValueChange('modules', newModules)}
                highlightModule={highlightModule}
                programCode={formData.programCode}
                courseTitle={formData.title}
                quizzes={quizzes}
                onQuizCreated={(newQuiz) => setQuizzes(prev => [...prev, newQuiz])}
            />

        </div>
    );

    const handleCertificateUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Enforce PDF only
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Only PDF files are allowed for certificate templates. Please upload a PDF.');
            e.target.value = '';
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Use the dedicated PDF-only template upload endpoint
            const response = await api.post('/admin/upload-template', formData);
            setFormData(prev => ({ ...prev, certificateTemplate: response.data.url }));
        } catch (error) {
            console.error("Certificate upload failed", error);
            alert(error.response?.data?.message || 'Failed to upload certificate template.');
        }
    };
    const handleInternshipOfferUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Only PDF files are allowed for internship templates. Please upload a PDF.');
            e.target.value = '';
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post('/admin/upload-template', formData);
            setFormData(prev => ({ ...prev, internshipOfferTemplate: response.data.url }));
        } catch (error) {
            console.error("Internship offer upload failed", error);
            alert(error.response?.data?.message || 'Failed to upload internship offer template.');
        }
    };
    const handleInternshipTemplateUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Only PDF files are allowed for internship templates. Please upload a PDF.');
            e.target.value = '';
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post('/admin/upload-template', formData);
            setFormData(prev => ({ ...prev, internshipCertificateTemplate: response.data.url }));
        } catch (error) {
            console.error("Internship template upload failed", error);
            alert(error.response?.data?.message || 'Failed to upload internship template.');
        }
    };
    const renderStep3 = () => (
        <div className="space-y-6">

            {/* Generic Completion Certificate - only for non-internship programs */}
            {formData.type !== 'internship' && (
            <div className="border rounded-lg p-6 bg-slate-50 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-yellow-100 p-2 rounded text-yellow-700">
                        <Icon name="Award" size={24} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800">Completion Certificate</h3>
                        <p className="text-xs text-slate-500">Upload a custom certificate background (PNG/JPG).</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="certificate">Certificate Background Image</Label>
                    <div className="flex flex-col gap-4">
                        <Input
                            id="certificate"
                            type="file"
                            onChange={handleCertificateUpload}
                            accept="application/pdf,.pdf"
                            className="max-w-md"
                        />
                        <p className="text-xs text-slate-500 mt-1">Upload a fillable PDF with form fields: student_name, course_name, completion_date, certificate_id</p>
                        {formData.certificateTemplate && (
                            <div className="relative w-full max-w-md aspect-[1.414/1] rounded overflow-hidden border border-slate-200 shadow-sm">
                                <img src={formData.certificateTemplate} alt="Certificate Preview" className="h-full w-full object-contain bg-white" />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                                    <p className="text-xl font-serif text-slate-400 font-bold rotate-[-15deg] uppercase border-4 border-slate-200 p-4 rounded-xl">
                                        Certificate Preview
                                    </p>
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-slate-500">
                            The student's name and QR code will be automatically overlaid on this image.
                        </p>
                    </div>
                </div>
            </div>
            )}

            {/* Internship Templates - only for internship programs */}
            {formData.type === 'internship' && (
                <>
                    {/* Internship Offer Letter */}
                    <div className="border rounded-lg p-6 bg-blue-50 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-blue-100 p-2 rounded text-blue-700">
                                <Icon name="FileText" size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">Internship Offer Letter Template</h3>
                                <p className="text-xs text-slate-500">Generated automatically when a student enrolls/pays for this internship.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="internship-offer-template">Offer Letter PDF Template</Label>
                            <div className="flex flex-col gap-4">
                                <Input
                                    id="internship-offer-template"
                                    type="file"
                                    onChange={handleInternshipOfferUpload}
                                    accept="application/pdf,.pdf"
                                    className="max-w-md"
                                />
                                <p className="text-xs text-slate-500 mt-1">Fillable PDF with placeholders: <code>student_name</code>, <code>offer_id</code>, <code>year&amp;dept</code>, <code>college_name</code></p>
                                {formData.internshipOfferTemplate && (
                                    <div className="p-3 bg-white border rounded border-blue-100 flex items-center justify-between">
                                        <div className="truncate flex-1 font-mono text-xs text-blue-600">
                                            {formData.internshipOfferTemplate.split('/').pop()}
                                        </div>
                                        <Badge variant="success">Uploaded</Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Internship Completion Certificate */}
                    <div className="border rounded-lg p-6 bg-slate-50 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-yellow-100 p-2 rounded text-yellow-700">
                                <Icon name="Award" size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">Internship Completion Certificate Template</h3>
                                <p className="text-xs text-slate-500">Generated when enrollment is marked as "Completed" in the admin panel.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="internship-certificate-template">Completion Certificate PDF Template</Label>
                            <div className="flex flex-col gap-4">
                                <Input
                                    id="internship-certificate-template"
                                    type="file"
                                    onChange={handleInternshipTemplateUpload}
                                    accept="application/pdf,.pdf"
                                    className="max-w-md"
                                />
                                <p className="text-xs text-slate-500 mt-1">Fillable PDF with placeholders: <code>student_name</code>, <code>college_name</code>, <code>student_id</code></p>
                                {formData.internshipCertificateTemplate && (
                                    <div className="p-3 bg-white border rounded border-yellow-100 flex items-center justify-between">
                                        <div className="truncate flex-1 font-mono text-xs text-yellow-600">
                                            {formData.internshipCertificateTemplate.split('/').pop()}
                                        </div>
                                        <Badge variant="success">Uploaded</Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    const renderStep4 = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Main Validation & Summary */}
            <div className="lg:col-span-2 space-y-6">
                <div className="text-left">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Review & Publish</h3>
                    <p className="text-slate-500">Check the validation status below. Validation issues must be resolved before publishing.</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-lg space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500 block">Title</span>
                            <span className="font-medium text-slate-900">{formData.title}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Type</span>
                            <span className="font-medium text-slate-900 capitalize">{formData.type}</span>
                        </div>
                        {formData.type === 'internship' ? (
                            <>
                                <div>
                                    <span className="text-slate-500 block">Dates</span>
                                    <span className="font-medium text-slate-900">{formData.startDate} to {formData.endDate}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Duration (Calculated)</span>
                                    <span className="font-medium text-slate-900">{formData.duration}</span>
                                </div>
                            </>
                        ) : (
                            <div>
                                <span className="text-slate-500 block">Duration</span>
                                <span className="font-medium text-slate-900">{formData.duration}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-slate-500 block">Pricing</span>
                            <span className="font-medium text-slate-900">{formData.price ? `₹${formData.price}` : 'Free'}</span>
                        </div>
                    </div>
                </div>

                {/* Validation Status */}
                {validationStatus.isReady ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-3">
                        <Icon name="CheckCircle" size={24} />
                        <div>
                            <h4 className="font-bold">Good to go!</h4>
                            <p className="text-sm">This program meets all requirements and is ready to be published.</p>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-center gap-3">
                        <Icon name="AlertTriangle" size={24} />
                        <div>
                            <h4 className="font-bold">Incomplete Draft</h4>
                            <p className="text-sm">Please resolve the issues in the checklist to enable publishing.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar Validator */}
            <div className="lg:col-span-1">
                <ProgramValidator formData={formData} />
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto pb-24 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">{id ? 'Edit Program' : 'Create New Program'}</h1>
                <Button variant="outline" onClick={() => navigate('/admin/programs')}>Cancel</Button>
            </div>

            {/* Stepper */}
            <div className="relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10" />
                <div className="flex justify-between">
                    {steps.map((stepLabel, idx) => {
                        const isCompleted = idx < currentStep;
                        const isActive = idx === currentStep;
                        return (
                            <div key={idx} className="flex flex-col items-center gap-2 bg-white px-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${isCompleted ? 'bg-green-500 text-white' :
                                    isActive ? 'bg-brand-blue text-white ring-4 ring-blue-50' :
                                        'bg-slate-100 text-slate-400'
                                    }`}>
                                    {isCompleted ? <Icon name="Check" size={14} /> : idx + 1}
                                </div>
                                <span className={`text-xs font-medium ${isActive ? 'text-brand-blue' : 'text-slate-500'}`}>{stepLabel}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <Card className="min-h-[400px]">
                <CardHeader>
                    <CardTitle>{steps[currentStep]}</CardTitle>
                </CardHeader>
                <CardContent>
                    {currentStep === 0 && renderStep1()}
                    {currentStep === 1 && renderStep2()}
                    {currentStep === 2 && renderStep3()}
                    {currentStep === 3 && renderStep4()}
                </CardContent>
            </Card>

            {/* Sticky/Fixed Footer Actions for easier access */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-50">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0}>
                        <Icon name="ChevronLeft" size={16} className="mr-2" /> Previous
                    </Button>

                    <div className="flex gap-3">
                        {/* Always show Save Draft */}
                        <Button
                            variant="secondary"
                            onClick={() => handleSubmit('draft')}
                            disabled={loading}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800"
                        >
                            <Icon name="Save" size={16} className="mr-2" />
                            Save as Draft
                        </Button>

                        {/* Next or Publish */}
                        {currentStep === steps.length - 1 ? (
                            <Button
                                onClick={() => handleSubmit('published')}
                                disabled={loading || !validationStatus.isReady}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {loading ? 'Publishing...' : 'Publish Live'}
                                <Icon name="UploadCloud" size={16} className="ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={handleNext}>
                                Next Step <Icon name="ChevronRight" size={16} className="ml-2" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgramWizard;
