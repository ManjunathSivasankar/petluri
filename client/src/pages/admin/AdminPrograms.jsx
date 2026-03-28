import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/Table';
import { Card, CardContent } from '@/components/ui/Card';
import api from '@/lib/api';
import { validateProgram } from '@/utils/programValidation';
import { getCoursePrefix } from '@/utils/courseHelpers'; // Ensure this helper is available

const AssetStatus = ({ program }) => {
    const hasCert = !!program.certificateTemplate;
    const hasOffer = !!program.internshipOfferTemplate;
    const hasInternCert = !!program.internshipCertificateTemplate;

    if (!hasCert && !hasOffer && !hasInternCert) return null;

    return (
        <div className="flex items-center gap-1.5 mt-1">
            {hasCert && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100" title="Course Certificate Configured">
                    <Icon name="Award" size={10} /> CERT
                </span>
            )}
            {hasOffer && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100" title="Internship Offer Letter Configured">
                    <Icon name="FileText" size={10} /> OFFER
                </span>
            )}
            {hasInternCert && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100" title="Internship Certificate Configured">
                    <Icon name="Award" size={10} /> INTERN-CERT
                </span>
            )}
        </div>
    );
};

const AdminPrograms = () => {
    const navigate = useNavigate();
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchPrograms = async () => {
            try {
                const response = await api.get('/admin/courses');
                // Backend returns array directly
                setPrograms(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                console.error("Failed to fetch programs", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPrograms();
    }, []);

    const handlePublish = async (programId) => {
        if (!window.confirm("Are you sure you want to publish this program? It will be visible to students.")) return;

        try {
            // We send status: 'published' which triggers backend validation too
            await api.put(`/admin/courses/${programId}`, { status: 'published' });
            // Update local state
            setPrograms(prev => prev.map(p => p._id === programId ? { ...p, isPublished: true, status: 'published' } : p));
            alert("Program published successfully!");
        } catch (error) {
            console.error("Failed to publish program", error);
            alert(`Failed to publish program: ${error.response?.data?.message || error.message}`);
        }
    };

    const handleUnpublish = async (programId) => {
        if (!window.confirm("Are you sure you want to revert this program to draft? It will be hidden from students.")) return;

        try {
            await api.put(`/admin/courses/${programId}`, { status: 'draft' });
            // Update local state
            setPrograms(prev => prev.map(p => p._id === programId ? { ...p, isPublished: false, status: 'draft' } : p));
        } catch (error) {
            console.error("Failed to unpublish program", error);
            alert("Failed to revert program to draft.");
        }
    };

    const handleDelete = async (programId) => {
        if (!window.confirm("Are you sure you want to delete this program? This action cannot be undone.")) return;

        try {
            await api.delete(`/admin/courses/${programId}`);
            setPrograms(prev => prev.filter(p => p._id !== programId));
        } catch (error) {
            console.error("Failed to delete program", error);
            alert("Failed to delete program.");
        }
    };

    const filteredPrograms = programs.filter(program =>
        program.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Programs</h1>
                    <p className="text-sm text-slate-500">Manage all courses and internships.</p>
                </div>
                <Button onClick={() => navigate('/admin/programs/create')}>
                    <Icon name="Plus" size={16} className="mr-2" />
                    Create New Program
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Icon name="Search" className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <Input
                        placeholder="Search programs..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Programs Lists */}
            <div className="space-y-8">
                {/* 1. Completed/Running Programs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                            <Icon name="CheckCircle" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Published Programs</h2>
                            <p className="text-sm text-slate-500">Active programs visible to students</p>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <ProgramTable
                                programs={filteredPrograms.filter(p => p.isPublished)}
                                loading={loading}
                                emptyMessage="No published programs found."
                                navigate={navigate}
                                showPublish={false}
                                showUnpublish={true}
                                onPublish={handlePublish}
                                onUnpublish={handleUnpublish}
                                onDelete={handleDelete}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* 2. Drafting Programs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg">
                            <Icon name="FileEdit" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Draft Programs</h2>
                            <p className="text-sm text-slate-500">Programs currently being created or modified</p>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <ProgramTable
                                programs={filteredPrograms.filter(p => !p.isPublished)}
                                loading={loading}
                                emptyMessage="No draft programs found."
                                navigate={navigate}
                                showPublish={true}
                                showUnpublish={false}
                                onPublish={handlePublish}
                                onUnpublish={handleUnpublish}
                                onDelete={handleDelete}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

// Reusable Table Component
const ProgramTable = ({ programs, loading, emptyMessage, navigate, showPublish, showUnpublish, onPublish, onUnpublish, onDelete }) => (
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Videos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {loading ? (
                <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        Loading programs...
                    </TableCell>
                </TableRow>
            ) : programs.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        {emptyMessage}
                    </TableCell>
                </TableRow>
            ) : (
                programs.map((program) => {
                    const { isReady } = validateProgram(program);

                    // Video coverage stats
                    const modules = program.modules || [];
                    const totalModules = modules.length;
                    const modulesWithVideo = modules.filter(mod =>
                        (mod.content || []).some(c => c.type === 'video' && c.url)
                    );
                    const videosUploaded = modulesWithVideo.length;
                    const b2Count = modulesWithVideo.filter(mod =>
                        (mod.content || []).some(c => c.type === 'video' && c.storageProvider === 'backblaze')
                    ).length;
                    const allReady = totalModules > 0 && videosUploaded === totalModules;

                    return (
                        <TableRow key={program._id}>
                            <TableCell className="font-mono font-bold text-[12px] text-slate-600 px-4 py-3">
                                {program.programId || program.programCode || 'N/A'}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-900">{program.title}</span>
                                    </div>
                                    <AssetStatus program={program} />
                                    {!isReady && !program.isPublished && (
                                        <span className="text-[10px] text-red-500 font-medium flex items-center gap-1 mt-0.5">
                                            <Icon name="AlertCircle" size={10} /> Missing Details
                                        </span>
                                    )}
                                    {program.isPublished && program.status === 'draft' && (
                                        <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-0.5">
                                            <Icon name="RefreshCw" size={10} className="animate-pulse" /> Update Pending
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="capitalize">{program.type}</Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">{program.level}</TableCell>
                            <TableCell className="text-slate-600 font-medium">
                                {program.price ? `₹${program.price}` : 'Free'}
                            </TableCell>
                            {/* Video status */}
                            <TableCell>
                                {program.type === 'internship' || totalModules === 0 ? (
                                    <span className="text-xs text-slate-400">—</span>
                                ) : (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                            allReady ? 'bg-green-100 text-green-700' :
                                            videosUploaded > 0 ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-50 text-red-500'
                                        }`}>
                                            <Icon name={allReady ? 'CheckCircle' : 'AlertCircle'} size={10} />
                                            {videosUploaded}/{totalModules} modules
                                        </span>
                                        {b2Count > 0 && (
                                            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100" title={`${b2Count} on Backblaze B2`}>
                                                <Icon name="Cloud" size={9} /> {b2Count} B2
                                            </span>
                                        )}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>
                                <Badge className={program.isPublished ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}>
                                    {program.isPublished ? 'Published' : 'Draft'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right px-4">
                                <div className="flex justify-end gap-2">
                                    {showPublish && !program.isPublished && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={`h-8 border-green-200 hover:bg-green-50 ${isReady ? 'text-green-600' : 'text-slate-400 border-slate-200 bg-slate-50'}`}
                                                onClick={() => isReady && onPublish(program._id)}
                                                disabled={!isReady}
                                                title={isReady ? "Publish Program" : "Complete pending details to publish"}
                                            >
                                                <Icon name="UploadCloud" size={14} className="mr-1" />
                                                Publish
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => navigate(`/admin/programs/edit/${program._id}`)}
                                                title="Edit Program"
                                            >
                                                <Icon name="Edit" size={16} className="text-slate-500 hover:text-blue-600" />
                                            </Button>
                                        </>
                                    )}

                                    {showUnpublish && program.isPublished && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                                onClick={() => navigate(`/admin/programs/edit/${program._id}`)}
                                                title="Edit Live Program"
                                            >
                                                <Icon name="Edit" size={14} className="mr-1" />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                                                onClick={() => onUnpublish(program._id)}
                                                title="Revert to Draft (Unpublish)"
                                            >
                                                <Icon name="WifiOff" size={14} className="mr-1" />
                                                Unpublish
                                            </Button>
                                        </>
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onDelete(program._id)}
                                        title="Delete Program"
                                    >
                                        <Icon name="Trash2" size={16} className="text-red-500 hover:bg-red-50" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })
            )}
        </TableBody>
    </Table>
);

export default AdminPrograms;
