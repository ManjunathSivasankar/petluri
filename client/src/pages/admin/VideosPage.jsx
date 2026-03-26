import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import api from '@/lib/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || api.defaults.baseURL;
const BACKEND_BASE_URL = (API_BASE_URL || '').replace(/\/api\/?$/, '');

const resolveVideoUrl = (rawUrl = '') => {
    if (!rawUrl) return '';
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    const normalizedPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${BACKEND_BASE_URL}${normalizedPath}`;
};

const formatBytes = (bytes = 0) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = Number(bytes);
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
};

const VideosPage = () => {
    const [courses, setCourses] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadingModuleId, setUploadingModuleId] = useState('');
    const [fileByModule, setFileByModule] = useState({});

    const fetchCourses = async () => {
        const { data } = await api.get('/admin/courses');
        setCourses(data || []);
        if (!selectedCourseId && data?.length > 0) {
            setSelectedCourseId(data[0]._id);
        }
    };

    const fetchSelectedCourse = async (courseId) => {
        if (!courseId) return;
        const { data } = await api.get(`/admin/courses/${courseId}`);
        setSelectedCourse(data);
    };

    const fetchVideos = async (courseId) => {
        if (!courseId) return;
        const { data } = await api.get('/admin/videos', { params: { courseId } });
        setVideos(data || []);
    };

    const refreshPageData = async (courseId) => {
        try {
            setLoading(true);
            await Promise.all([fetchSelectedCourse(courseId), fetchVideos(courseId)]);
        } catch (error) {
            console.error('Failed to load videos:', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourses().catch((error) => {
            console.error('Failed to fetch courses:', error.response?.data || error.message);
        });
    }, []);

    useEffect(() => {
        if (selectedCourseId) {
            refreshPageData(selectedCourseId);
        }
    }, [selectedCourseId]);

    const moduleRows = useMemo(() => {
        if (!selectedCourse?.modules) return [];
        return selectedCourse.modules.map((mod) => {
            const existingVideo = (mod.content || []).find((item) => item.type === 'video');
            return {
                moduleId: mod._id,
                moduleTitle: mod.title,
                existingVideo
            };
        });
    }, [selectedCourse]);

    const handleUpload = async (moduleId) => {
        const file = fileByModule[moduleId];
        if (!file) {
            alert('Please select a video file first');
            return;
        }

        try {
            setUploadingModuleId(moduleId);
            const formData = new FormData();
            formData.append('video', file);
            formData.append('courseId', selectedCourseId);
            formData.append('moduleId', moduleId);
            formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

            await api.post('/admin/videos/upload', formData);
            await refreshPageData(selectedCourseId);
            setFileByModule((prev) => ({ ...prev, [moduleId]: undefined }));
        } catch (error) {
            console.error('Video upload failed:', error.response?.data || error.message);
            alert(error?.response?.data?.message || 'Video upload failed');
        } finally {
            setUploadingModuleId('');
        }
    };

    const handleDeleteVideo = async (moduleId) => {
        if (!window.confirm('Delete this module video? This will also delete from storage bucket/local disk.')) return;

        try {
            await api.delete(`/admin/videos/${selectedCourseId}/${moduleId}`);
            await refreshPageData(selectedCourseId);
        } catch (error) {
            console.error('Video delete failed:', error.response?.data || error.message);
            alert(error?.response?.data?.message || 'Delete failed');
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Video Management</h1>
                <p className="text-sm text-slate-500">Course-wise module video upload, playback, and deletion.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row gap-3 md:items-center">
                <label className="text-sm font-medium text-slate-700">Select Course</label>
                <select
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                >
                    {courses.map((course) => (
                        <option key={course._id} value={course._id}>{course.title}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Module</TableHead>
                            <TableHead>Current Video</TableHead>
                            <TableHead>File Size</TableHead>
                            <TableHead>Upload Date</TableHead>
                            <TableHead>Upload/Replace</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading modules...</TableCell>
                            </TableRow>
                        ) : moduleRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">No modules found for this course.</TableCell>
                            </TableRow>
                        ) : (
                            moduleRows.map((row) => {
                                const listedVideo = videos.find((v) => String(v.moduleId) === String(row.moduleId));
                                const videoMeta = listedVideo || row.existingVideo;
                                const videoUrl = resolveVideoUrl(listedVideo?.url || row.existingVideo?.url);
                                const pendingFile = fileByModule[row.moduleId];
                                const displayedSize = videoMeta?.fileSizeBytes || pendingFile?.size || 0;

                                return (
                                    <TableRow key={row.moduleId}>
                                        <TableCell className="font-medium text-slate-900">{row.moduleTitle}</TableCell>
                                        <TableCell>{videoMeta?.title || '-'}</TableCell>
                                        <TableCell>{formatBytes(displayedSize)}</TableCell>
                                        <TableCell>
                                            {videoMeta?.uploadedAt ? new Date(videoMeta.uploadedAt).toLocaleString() : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="file"
                                                    accept="video/*"
                                                    className="max-w-xs"
                                                    onChange={(e) => setFileByModule((prev) => ({
                                                        ...prev,
                                                        [row.moduleId]: e.target.files?.[0]
                                                    }))}
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleUpload(row.moduleId)}
                                                    disabled={uploadingModuleId === row.moduleId}
                                                >
                                                    {uploadingModuleId === row.moduleId ? 'Uploading...' : 'Upload'}
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={!videoUrl}
                                                    onClick={() => videoUrl && window.open(videoUrl, '_blank')}
                                                >
                                                    <Icon name="Play" size={16} className="text-blue-600" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={!videoUrl}
                                                    onClick={() => handleDeleteVideo(row.moduleId)}
                                                >
                                                    <Icon name="Trash2" size={16} className="text-red-600" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default VideosPage;
