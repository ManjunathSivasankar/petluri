import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoCard } from '@/components/cards/VideoCard';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ProgressBar } from '@/components/ui/ProgressBar';
import api from '@/lib/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || api.defaults.baseURL || 'http://localhost:5001/api';
const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const resolveVideoUrl = (rawUrl) => {
    if (!rawUrl) return '';
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    const normalizedPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${BACKEND_BASE_URL}${normalizedPath}`;
};

const isDirectVideoFile = (url = '') => {
    return /\.(mp4|webm|ogg|mov|mkv|avi)(\?.*)?$/i.test(url) || url.includes('/uploads/videos/');
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
    const [videoDuration, setVideoDuration] = useState(0);

    const videoRef = useRef(null);
    const maxPlayedRef = useRef(0);
    const lastSyncAtRef = useRef(0);

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
        if (!courseData) return [];

        return (courseData.modules || [])
            .map((mod, index) => {
                const video = (mod.content || []).find((item) => item.type === 'video');
                if (!video) return null;

                return {
                    ...video,
                    moduleId: mod._id,
                    moduleTitle: mod.title,
                    moduleIndex: index + 1
                };
            })
            .filter(Boolean);
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

    const syncVideoProgress = async ({ force = false, accessed = false, ended = false } = {}) => {
        if (!activeVideo?._id || !activeVideo?.moduleId) return;
        if (!videoRef.current) return;

        const now = Date.now();
        if (!force && now - lastSyncAtRef.current < 5000) return;
        lastSyncAtRef.current = now;

        const duration = Number(videoRef.current.duration || videoDuration || 0);
        const currentTime = Number(videoRef.current.currentTime || 0);
        const watchedDuration = Math.max(watchedSeconds, maxPlayedRef.current, ended ? duration : 0);

        try {
            const { data } = await api.post('/student/video/progress', {
                courseId: id,
                moduleId: activeVideo.moduleId,
                videoId: activeVideo._id,
                watchedDuration,
                totalDuration: duration,
                currentTime,
                playbackRate,
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
        setActiveVideo(video);
        setWatchedSeconds(0);
        setVideoDuration(0);
        maxPlayedRef.current = 0;
        lastSyncAtRef.current = 0;
        setPlaybackRate(1);
    };

    const handleTimeUpdate = () => {
        const player = videoRef.current;
        if (!player) return;

        const current = Number(player.currentTime || 0);
        const duration = Number(player.duration || 0);

        if (duration > 0 && current > maxPlayedRef.current + 2) {
            player.currentTime = maxPlayedRef.current;
            return;
        }

        if (current > maxPlayedRef.current) {
            maxPlayedRef.current = current;
            setWatchedSeconds(maxPlayedRef.current);
        }

        if (duration > 0 && duration !== videoDuration) {
            setVideoDuration(duration);
        }

        syncVideoProgress({ force: false, accessed: false, ended: false });
    };

    const handlePlaybackRateChange = (rate) => {
        setPlaybackRate(rate);
        if (videoRef.current) {
            videoRef.current.playbackRate = rate;
        }
    };

    const rawVideoUrl = activeVideo?.url || activeVideo?.videoUrl || '';
    const playableVideoUrl = resolveVideoUrl(rawVideoUrl);

    useEffect(() => {
        if (playableVideoUrl) {
            console.log('Resolved video URL:', playableVideoUrl);
        }
    }, [playableVideoUrl]);

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

    useEffect(() => {
        return () => {
            syncVideoProgress({ force: true, accessed: false, ended: false });
        };
    }, [activeVideo?._id, watchedSeconds, playbackRate]);

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
                <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg relative flex items-center justify-center">
                    {activeVideo ? (
                        isDirectVideoFile(playableVideoUrl) ? (
                            <div className="w-full h-full flex flex-col">
                                <video
                                    ref={videoRef}
                                    className="w-full h-full"
                                    src={playableVideoUrl}
                                    controls
                                    preload="metadata"
                                    onLoadedMetadata={() => {
                                        if (videoRef.current) {
                                            setVideoDuration(Number(videoRef.current.duration || 0));
                                            videoRef.current.playbackRate = playbackRate;
                                        }
                                    }}
                                    onTimeUpdate={handleTimeUpdate}
                                    onPause={() => syncVideoProgress({ force: true, accessed: false, ended: false })}
                                    onEnded={() => syncVideoProgress({ force: true, accessed: false, ended: true })}
                                >
                                    Your browser does not support the video tag.
                                </video>
                                <div className="bg-slate-900/90 text-white text-xs px-3 py-2 flex items-center justify-between">
                                    <span>
                                        Watched {Math.round((Math.min(watchedSeconds, videoDuration || watchedSeconds) / (videoDuration || 1)) * 100)}%
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span>Speed</span>
                                        <select
                                            className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5"
                                            value={playbackRate}
                                            onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                                        >
                                            <option value={1}>1x</option>
                                            <option value={1.5}>1.5x</option>
                                            <option value={2}>2x</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
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
                        <div className="text-white text-center">
                            <Icon name="PlayCircle" size="2xl" className="mx-auto mb-4 opacity-50" />
                            <p>Select a video to start learning</p>
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
                                    <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                                        <p className="text-sm font-semibold text-slate-800 mb-2">Module Completion</p>
                                        <div className="space-y-2">
                                            {progressSummary.moduleProgress.map((module) => (
                                                <div key={module.moduleIndex} className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-700">{module.title}</span>
                                                    <span className={module.status === 'completed' ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                                                        {module.status === 'completed' ? 'Completed' : 'Pending'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {activeVideo && !completedVideos.includes(String(activeVideo._id)) && (
                                    <p className="mt-4 text-xs text-amber-600 font-medium">
                                        Watch at least 95% of this video to mark the module as completed.
                                    </p>
                                )}
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
                    {playlist.map((video, index) => (
                        <VideoCard
                            key={video._id}
                            id={video._id}
                            title={`Module ${video.moduleIndex}: ${video.moduleTitle} - ${video.title}`}
                            duration={video.duration || '00:00'}
                            isCompleted={completedVideos.includes(String(video._id))}
                            isActive={activeVideo?._id === video._id}
                            onClick={() => handleVideoSelect(video)}
                        />
                    ))}
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
                    {courseData.quizzes?.length > 0 || courseData.modules?.some(m => m.content?.some(c => c.type === 'quiz')) ? (
                        <Button 
                            variant="outline" 
                            className="w-full mb-2"
                            onClick={() => navigate(`/student/quizzes/${id}`)}
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
        </div>
    );
};

export default LearningPage;
