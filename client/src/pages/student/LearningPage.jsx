import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoCard } from '@/components/cards/VideoCard';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { UpsellModal } from '@/components/student/UpsellModal';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import api from '@/lib/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || api.defaults.baseURL || 'http://localhost:5001/api';
const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const resolveVideoUrl = (rawUrl) => {
    if (!rawUrl) return '';
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

    const normalizedPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    let url = `${BACKEND_BASE_URL}${normalizedPath}`;

    // If it's a proxy URL, append the auth token for the native video player
    if (normalizedPath.startsWith('/api')) {
        const token = localStorage.getItem('token');
        if (token) {
            url += (url.includes('?') ? '&' : '?') + `token=${token}`;
        }
    }

    return url;
};

const isDirectVideoFile = (url = '') => {
    return /\.(mp4|webm|ogg|mov|mkv|avi)(\?.*)?$/i.test(url) ||
        url.includes('/uploads/videos/') ||
        url.includes('/api/student/video/stream/') ||
        url.includes('/api/admin/videos/stream/');
};

const LearningPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [courseData, setCourseData] = useState(null);
    const [enrollmentProgress, setEnrollmentProgress] = useState(null);
    const [activeVideo, setActiveVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [progressSummary, setProgressSummary] = useState(null);
    const [feedbackState, setFeedbackState] = useState({ required: false, submitted: false, rating: 5, comments: '' });
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [watchedSeconds, setWatchedSeconds] = useState(0);
    const [isUpsellModalOpen, setIsUpsellModalOpen] = useState(false);
    const [securityWarning, setSecurityWarning] = useState('');

    const playerContainerRef = useRef(null);
    const maxPlayedRef = useRef(0);
    const lastSyncAtRef = useRef(0);

    // Security measures
    useEffect(() => {
        const handleContextMenu = (e) => e.preventDefault();
        const handleKeyDown = (e) => {
            if (e.ctrlKey && (e.key === 's' || e.key === 'p' || e.key === 'u')) {
                e.preventDefault();
                setSecurityWarning('Action restricted for content protection.');
            }
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                setSecurityWarning('Screenshots are discouraged.');
            }
        };

        const handleBlur = () => {
            // VideoPlayer handles its own pause logic if needed, 
            // but we can still broadcast a global pause if we had a ref.
            // For now, let's keep it simple.
        };

        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    useEffect(() => {
        if (securityWarning) {
            const timer = setTimeout(() => setSecurityWarning(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [securityWarning]);

    useEffect(() => {
        const fetchCourseContent = async () => {
            try {
                const { data } = await api.get(`/student/course/${id}`);
                setCourseData(data.course);
                setEnrollmentProgress(data.progress);
                setProgressSummary(data.progressSummary || null);
                setFeedbackState({
                    required: Boolean(data.feedback?.required),
                    submitted: Boolean(data.feedback?.submitted),
                    rating: data.feedback?.rating || 5,
                    comments: data.feedback?.comments || ''
                });

            } catch (error) {
                console.error('Failed to fetch course content:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCourseContent();
    }, [id]);

    const handleSubmitFeedback = async () => {
        try {
            setSubmittingFeedback(true);
            const { data } = await api.post('/student/feedback/submit', {
                courseId: id,
                rating: feedbackState.rating,
                comments: feedbackState.comments
            });

            setFeedbackState(prev => ({
                ...prev,
                required: false,
                submitted: true
            }));
            if (data.progressSummary) {
                setProgressSummary(data.progressSummary);
            }
            alert('Feedback submitted. Your certificate is now unlocked.');
        } catch (error) {
            console.error('Feedback submission failed:', error);
            alert(error?.response?.data?.message || 'Failed to submit feedback');
        } finally {
            setSubmittingFeedback(false);
        }
    };

    const modulePlaylist = useMemo(() => {
        if (!courseData || !courseData.modules) return [];

        const items = [];
        courseData.modules.forEach((mod, mIdx) => {
            if (mod.content) {
                mod.content.forEach((contentItem) => {
                    if (contentItem.type === 'video' || contentItem.type === 'quiz') {
                        items.push({
                            ...contentItem,
                            moduleId: mod._id,
                            moduleTitle: mod.title,
                            moduleIndex: mIdx + 1
                        });
                    }
                });
            }
        });
        return items;
    }, [courseData]);

    const legacyPlaylist = useMemo(() => {
        if (!courseData) return [];
        return (courseData.videos || []).map((video, index) => ({
            ...video,
            moduleId: `legacy-${index}`,
            moduleTitle: `Video ${index + 1}`,
            moduleIndex: index + 1
        }));
    }, [courseData]);

    const playlist = modulePlaylist.length > 0 ? modulePlaylist : legacyPlaylist;

    const videoProgressMap = useMemo(() => {
        const rows = enrollmentProgress?.videoProgress || [];
        const map = new Map();
        rows.forEach((row) => {
            if (row?.videoId) {
                map.set(String(row.videoId), row);
            }
        });
        return map;
    }, [enrollmentProgress]);

    const syncVideoProgress = async ({ force = false, accessed = false, ended = false, progressData = null } = {}) => {
        // Guard: Ensure we have all required IDs for the backend updateVideoProgress
        const courseId = id;
        const moduleId = activeVideo?.moduleId;
        const videoId = activeVideo?._id;

        if (!courseId || !moduleId || !videoId || activeVideo.type === 'quiz') return;

        const now = Date.now();
        if (!force && now - lastSyncAtRef.current < 5000) return;
        lastSyncAtRef.current = now;

        const duration = progressData?.duration || 0;
        const currentTime = progressData?.currentTime || 0;
        const watchedDuration = Math.max(watchedSeconds, maxPlayedRef.current, ended ? duration : 0);

        try {
            const { data } = await api.post('/student/video/progress', {
                courseId,
                moduleId,
                videoId,
                watchedDuration,
                totalDuration: duration,
                currentTime,
                accessed
            });

            if (data?.progressSummary) setProgressSummary(data.progressSummary);
            if (data?.videoProgress) {
                setEnrollmentProgress((prev) => {
                    const previous = prev || {};
                    const currentRows = previous.videoProgress || [];
                    const idx = currentRows.findIndex((row) => String(row.videoId) === String(data.videoProgress.videoId));
                    const nextRows = [...currentRows];
                    if (idx >= 0) nextRows[idx] = data.videoProgress;
                    else nextRows.push(data.videoProgress);
                    return { ...previous, videoProgress: nextRows };
                });
            }
        } catch (error) {
            console.error('Video progress update failed:', error.response?.data || error.message);
        }
    };

    const handleVideoSelect = (video) => {
        // Strict Sequential Completion Logic
        const completedVideosList = [
            ...(enrollmentProgress?.completedVideos || []),
            ...((enrollmentProgress?.videoProgress || []).filter((row) => row.completed).map((row) => row.videoId))
        ].map(String);

        // Find first incomplete item in playlist
        const firstIncompleteIdx = playlist.findIndex(item => {
            if (item.type === 'video') {
                return !completedVideosList.includes(String(item._id));
            }
            if (item.type === 'quiz') {
                const quizId = item.quizId?._id || item.quizId;
                const quizResult = enrollmentProgress?.quizAttempts?.find(a => String(a.quizId) === String(quizId));
                return !quizResult?.passed;
            }
            return false;
        });

        const videoIndex = playlist.findIndex(v => String(v._id) === String(video._id));

        // Block if user tries to skip ahead past the first incomplete item
        if (firstIncompleteIdx !== -1 && videoIndex > firstIncompleteIdx) {
            setSecurityWarning(`Access Locked: Please complete ${playlist[firstIncompleteIdx].title} before moving forward.`);
            return;
        }

        // Upsell Check (existing logic)
        if (courseData?.upsell?.isEnabled && (courseData.type === 'free' || courseData.type === 'certification')) {
            const videoIndex = playlist.findIndex(v => v._id === video._id);
            const triggerLimit = courseData.upsell.triggerCondition || 2;
            
            // For modules trigger type, triggerLimit is in terms of modules
            let shouldBlock = false;
            if (courseData.upsell.triggerType === 'module') {
                 shouldBlock = video.moduleIndex > triggerLimit;
            } else {
                 shouldBlock = videoIndex >= triggerLimit;
            }

            if (shouldBlock) {
                 setIsUpsellModalOpen(true);
                 return; // Prevent playback
            }
        }

        setActiveVideo(video);
        setWatchedSeconds(0);
        maxPlayedRef.current = 0;
        lastSyncAtRef.current = 0;
    };

    const rawVideoUrl = activeVideo?.url || activeVideo?.videoUrl || '';
    const playableVideoUrl = resolveVideoUrl(rawVideoUrl);

    useEffect(() => {
        if (activeVideo?._id && activeVideo?.moduleId) {
            const existingRow = videoProgressMap.get(String(activeVideo._id));
            if (existingRow) {
                const existingWatched = Number(existingRow.watchedDuration || 0);
                setWatchedSeconds(existingWatched);
                maxPlayedRef.current = existingWatched;
            }
            syncVideoProgress({ force: true, accessed: true, ended: false });
        }
    }, [activeVideo?._id]);

    // Auto-select first video on load
    useEffect(() => {
        if (!activeVideo && playlist.length > 0 && !loading) {
            handleVideoSelect(playlist[0]);
        }
    }, [playlist, activeVideo, loading]);

    useEffect(() => {
        return () => {
            syncVideoProgress({ force: true, accessed: false, ended: false });
        };
    }, [activeVideo?._id, watchedSeconds]);

    if (loading) return <div className="p-8 text-center">Loading course content...</div>;
    if (!courseData) return <div className="p-8 text-center text-red-500">Course not found or access denied.</div>;

    const completedVideos = [
        ...(enrollmentProgress?.completedVideos || []),
        ...((enrollmentProgress?.videoProgress || []).filter((row) => row.completed).map((row) => row.videoId))
    ].map(String);
    const canGetCertificate = progressSummary?.completionPercentage === 100;

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] gap-6">
            {/* Left Panel: Video Player */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg relative">
                    {activeVideo ? (
                        activeVideo.type === 'quiz' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
                                <Icon name="HelpCircle" size={64} className="mb-4 text-blue-400 opacity-80" />
                                <h2 className="text-2xl font-bold mb-2">{activeVideo.title || 'Module Quiz'}</h2>
                                <p className="text-slate-400 mb-8 max-w-md">
                                    This module includes a quiz to test your knowledge. Complete the quiz to track your progress and work towards your certificate.
                                </p>
                                <Button
                                    size="lg"
                                    className="bg-blue-600 hover:bg-blue-700 px-10 py-6 text-lg font-bold rounded-xl shadow-xl shadow-blue-900/20"
                                    onClick={() => navigate(`/student/quizzes/${id}/${activeVideo.quizId?._id || activeVideo.quizId}`)}
                                >
                                    Start Quiz <Icon name="ChevronRight" size={20} className="ml-2" />
                                </Button>
                            </div>
                        ) : isDirectVideoFile(playableVideoUrl) ? (
                            <>
                                <VideoPlayer
                                    key={activeVideo._id}
                                    src={playableVideoUrl}
                                    maxPlayed={watchedSeconds}
                                    onProgress={(data) => {
                                        if (data.maxPlayed > maxPlayedRef.current) {
                                            maxPlayedRef.current = data.maxPlayed;
                                            setWatchedSeconds(data.maxPlayed);
                                        }
                                        syncVideoProgress({ progressData: data });
                                    }}
                                    onEnded={() => {
                                        syncVideoProgress({ force: true, accessed: false, ended: true });
                                    }}
                                />

                                {securityWarning && (
                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-2xl z-50 animate-bounce">
                                        {securityWarning}
                                    </div>
                                )}

                                {/* Module Navigation Overlays */}
                                <div className="absolute bottom-20 right-6 flex items-center gap-2 pointer-events-none opacity-0 group-hover/vidplayer:opacity-100 transition-opacity z-50">
                                    <button 
                                        className="p-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-black flex items-center gap-2 transition-all shadow-2xl pointer-events-auto uppercase tracking-wider"
                                        onClick={() => {
                                            const idx = playlist.findIndex(v => v._id === activeVideo._id);
                                            if (idx < playlist.length - 1) handleVideoSelect(playlist[idx + 1]);
                                        }}
                                    >
                                        NEXT MODULE <Icon name="SkipForward" size={14} fill="currentColor" />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <iframe
                                className="w-full h-full"
                                src={playableVideoUrl}
                                title={activeVideo.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        )
                    ) : (
                        <div className="text-white text-center p-8">
                            <Icon name="PlayCircle" size={48} className="mx-auto mb-4 opacity-50 text-blue-400" />
                            <h3 className="text-xl font-bold mb-1">Begin Your Session</h3>
                            <p className="text-slate-500 text-sm">Select a module from the content list to start</p>
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">{activeVideo?.title || 'Course Overview'}</h1>
                    <p className="text-slate-500">{courseData.title}</p>

                    {progressSummary && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-semibold text-slate-800">Course Progress</p>
                                <p className="text-sm text-slate-600">{progressSummary.completionPercentage}%</p>
                            </div>
                            <ProgressBar value={progressSummary.completionPercentage} className="h-2.5" />
                            <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
                                <span>Completed Modules: {progressSummary.completedModules}/{progressSummary.totalModules}</span>
                                <span>Pending Modules: {progressSummary.pendingModules}</span>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 border-b border-slate-200">
                        <Tabs defaultValue="overview">
                            <TabsList>
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="notes">Notes</TabsTrigger>
                                <TabsTrigger value="resources">Resources</TabsTrigger>
                            </TabsList>
                            <TabsContent value="overview" className="py-4 text-slate-600">
                                {activeVideo?.description || courseData.description}
                                {progressSummary?.moduleProgress?.length > 0 && (
                                    <div className="mt-8">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4">Module Completion Status</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {progressSummary.moduleProgress.map((mod, idx) => (
                                                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-900 truncate">Module {mod.moduleIndex + 1}: {mod.title}</p>
                                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{mod.completedItems}/{mod.totalItems} Items Completed</p>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${mod.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {mod.status === 'completed' ? 'Passed' : 'In Progress'}
                                                        </span>
                                                    </div>
                                                    <ProgressBar value={mod.completionPercentage} className="h-1.5" />
                                                    <div className="flex gap-4 text-[10px] text-slate-500 font-medium">
                                                        <div className="flex items-center gap-1">
                                                            <Icon name="Play" size={10} className={mod.completedVideos >= mod.videoIds?.length ? 'text-green-500' : ''} />
                                                            {mod.completedVideos} Videos
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Icon name="HelpCircle" size={10} className={mod.completedQuizzes >= mod.quizIds?.length ? 'text-green-500' : ''} />
                                                            {mod.completedQuizzes} Quizzes
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="notes" className="py-4 text-slate-600">
                                <p>Personal notes feature is coming soon.</p>
                            </TabsContent>
                            <TabsContent value="resources" className="py-4 text-slate-600">
                                <p>Course resources and handouts will appear here.</p>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Right Panel: Playlist */}
            <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-900">Course Content</h3>
                    <span className="text-xs text-slate-500">
                        {Math.round((completedVideos.length / (playlist.length || 1)) * 100)}% Completed
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {playlist.map((item, index) => {
                        const isQuiz = item.type === 'quiz';
                        const quizId = item.quizId?._id || item.quizId;
                        const hasPassedQuiz = isQuiz && enrollmentProgress?.quizAttempts?.some(
                            a => String(a.quizId) === String(quizId) && a.passed
                        );

                        return (
                            <VideoCard
                                key={item._id}
                                id={item._id}
                                title={`${item.title}`}
                                subtitle={`Module ${item.moduleIndex}: ${item.moduleTitle}`}
                                duration={isQuiz ? 'Assessment' : (item.duration || '00:00')}
                                isCompleted={isQuiz ? hasPassedQuiz : completedVideos.includes(String(item._id))}
                                isActive={activeVideo?._id === item._id}
                                icon={isQuiz ? 'HelpCircle' : 'Play'}
                                onClick={() => handleVideoSelect(item)}
                            />
                        );
                    })}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    {false && progressSummary?.completionPercentage === 100 && !feedbackState.submitted && (
                        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-800 mb-2">Final Task: Submit Mandatory Feedback</p>
                            <div className="space-y-2">
                                <select
                                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                                    value={feedbackState.rating}
                                    onChange={(e) => setFeedbackState(prev => ({ ...prev, rating: Number(e.target.value) }))}
                                >
                                    <option value={5}>5 - Excellent</option>
                                    <option value={4}>4 - Good</option>
                                    <option value={3}>3 - Average</option>
                                    <option value={2}>2 - Needs Improvement</option>
                                    <option value={1}>1 - Poor</option>
                                </select>
                                <textarea
                                    className="w-full border border-slate-200 rounded-md px-2 py-2 text-sm"
                                    rows={3}
                                    placeholder="Share your course feedback"
                                    value={feedbackState.comments}
                                    onChange={(e) => setFeedbackState(prev => ({ ...prev, comments: e.target.value }))}
                                />
                                <Button className="w-full" onClick={handleSubmitFeedback} disabled={submittingFeedback}>
                                    {submittingFeedback ? 'Submitting Feedback...' : 'Submit Feedback'}
                                </Button>
                            </div>
                        </div>
                    )}
                    {/* Global Quiz Button */}
                    {(courseData.quizzes?.length > 0 || playlist.some(i => i.type === 'quiz')) ? (
                        <Button
                            variant="outline"
                            className="w-full mb-2"
                            onClick={() => {
                                const firstQuiz = playlist.find(i => i.type === 'quiz');
                                const quizId = firstQuiz?.quizId?._id || firstQuiz?.quizId || courseData.quizzes?.[0]?._id;
                                if (quizId) navigate(`/student/quizzes/${id}/${quizId}`);
                                else navigate(`/student/quizzes/${id}`);
                            }}
                        >
                            Take Course Quiz
                        </Button>
                    ) : null}
                    <Button
                        className="w-full"
                        disabled={!canGetCertificate}
                        onClick={() => navigate('/student/certificates')}
                    >
                        Get Certificate <Icon name="Award" size={14} className="ml-2" />
                    </Button>
                </div>
            </div>
            
            {/* Upsell Modal */}
            <UpsellModal 
                isOpen={isUpsellModalOpen} 
                onClose={() => setIsUpsellModalOpen(false)} 
                course={courseData}
                certificateCourse={courseData?.upsell?.certificateCourseId}
                professionalCourse={courseData?.upsell?.professionalCourseId}
            />
        </div>
    );
};

export default LearningPage;
