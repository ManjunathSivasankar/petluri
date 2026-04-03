import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoCard } from '@/components/cards/VideoCard';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { UpsellModal } from '@/components/student/UpsellModal';
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
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoLoading, setVideoLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isUpsellModalOpen, setIsUpsellModalOpen] = useState(false);

    const videoRef = useRef(null);
    const playerContainerRef = useRef(null);
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
        // Upsell Check
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
    }, [activeVideo?._id, watchedSeconds, playbackRate]);

    useEffect(() => {
        let timeout;
        const handleMouseMove = () => {
            setShowControls(true);
            clearTimeout(timeout);
            if (isPlaying) {
                timeout = setTimeout(() => setShowControls(false), 3000);
            }
        };
        
        const container = playerContainerRef.current;
        if (container) {
            container.addEventListener('mousemove', handleMouseMove);
        }
        return () => {
            if (container) container.removeEventListener('mousemove', handleMouseMove);
            clearTimeout(timeout);
        };
    }, [isPlaying]);

    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const toggleFullscreen = () => {
        if (!playerContainerRef.current) return;
        if (!document.fullscreenElement) {
            playerContainerRef.current.requestFullscreen().catch(err => {
                console.error(`Fullscreen error: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

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
                                    onClick={() => navigate(`/student/quizzes/${id}`)}
                                >
                                    Start Quiz <Icon name="ChevronRight" size={20} className="ml-2" />
                                </Button>
                            </div>
                        ) : isDirectVideoFile(playableVideoUrl) ? (
                            <div 
                                ref={playerContainerRef}
                                className={`w-full bg-black rounded-xl overflow-hidden shadow-2xl relative flex flex-col group/player ${isFullscreen ? 'h-screen rounded-none' : 'aspect-video'}`}
                            >
                                <div className="flex-1 relative min-h-0 bg-black flex items-center justify-center">
                                    <video
                                        ref={videoRef}
                                        key={activeVideo._id}
                                        className="w-full h-full object-contain cursor-pointer"
                                        src={playableVideoUrl}
                                        onContextMenu={(e) => e.preventDefault()}
                                        preload="metadata"
                                        onLoadStart={() => setVideoLoading(true)}
                                        onCanPlay={() => setVideoLoading(false)}
                                        onWaiting={() => setVideoLoading(true)}
                                        onPlaying={() => {
                                            setVideoLoading(false);
                                            setIsPlaying(true);
                                        }}
                                        onPause={() => setIsPlaying(false)}
                                        onLoadedMetadata={() => {
                                            if (videoRef.current) {
                                                setVideoDuration(Number(videoRef.current.duration || 0));
                                                videoRef.current.playbackRate = playbackRate;
                                            }
                                        }}
                                        onTimeUpdate={handleTimeUpdate}
                                        onEnded={() => {
                                            syncVideoProgress({ force: true, accessed: false, ended: true });
                                            setIsPlaying(false);
                                        }}
                                        onClick={togglePlay}
                                    >
                                        Your browser does not support the video tag.
                                    </video>

                                    {/* Center Play/Pause Indicator (Large) */}
                                    <div 
                                        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0'}`}
                                    >
                                        <button 
                                            className="w-20 h-20 bg-blue-600/80 rounded-full flex items-center justify-center text-white backdrop-blur-sm pointer-events-auto"
                                            onClick={togglePlay}
                                        >
                                            <Icon name={isPlaying ? "Pause" : "Play"} size={32} className={!isPlaying ? "ml-1" : ""} />
                                        </button>
                                    </div>

                                    {videoLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
                                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>

                                {/* Custom Control Bar - REDESIGNED FOR VISIBILITY */}
                                <div className={`absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-md border-t border-white/10 transition-all duration-300 p-3 z-30 ${!showControls && isPlaying ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0 pointer-events-auto'}`}>
                                    {/* Scrubber at the top of the bar */}
                                    <div className="relative w-full h-1 group/scrubber mb-3 cursor-pointer">
                                        <input 
                                            type="range"
                                            min="0"
                                            max={videoDuration || 0}
                                            value={watchedSeconds}
                                            onChange={(e) => {
                                                const time = Number(e.target.value);
                                                if (videoRef.current) videoRef.current.currentTime = time;
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="absolute inset-0 bg-white/20 rounded-full"></div>
                                        <div 
                                            className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all"
                                            style={{ width: `${(watchedSeconds / (videoDuration || 1)) * 100}%` }}
                                        ></div>
                                        <div 
                                            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full shadow-lg opacity-0 group-hover/scrubber:opacity-100 transition-opacity"
                                            style={{ left: `${(watchedSeconds / (videoDuration || 1)) * 100}%` }}
                                        ></div>
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <button onClick={togglePlay} className="text-white hover:text-blue-400 transition-colors">
                                                <Icon name={isPlaying ? "Pause" : "Play"} size={22} fill="currentColor" />
                                            </button>

                                            <div className="flex items-center gap-0.5">
                                                <button 
                                                    className="p-1 text-white/70 hover:text-white flex flex-col items-center min-w-[32px]"
                                                    onClick={() => { if(videoRef.current) videoRef.current.currentTime -= 10; }}
                                                    title="Back 10s"
                                                >
                                                    <Icon name="RotateCcw" size={14} />
                                                    <span className="text-[8px] font-black leading-none mt-0.5 uppercase">10S</span>
                                                </button>
                                                <button 
                                                    className="p-1 text-white/70 hover:text-white flex flex-col items-center min-w-[32px]"
                                                    onClick={() => { if(videoRef.current) videoRef.current.currentTime -= 5; }}
                                                    title="Back 5s"
                                                >
                                                    <Icon name="History" size={14} />
                                                    <span className="text-[8px] font-black leading-none mt-0.5 uppercase">5S</span>
                                                </button>
                                                <button 
                                                    className="p-1 text-white/70 hover:text-white flex flex-col items-center min-w-[32px]"
                                                    onClick={() => { if(videoRef.current) videoRef.current.currentTime += 5; }}
                                                    title="Forward 5s"
                                                >
                                                    <Icon name="ChevronRight" size={14} />
                                                    <span className="text-[8px] font-black leading-none mt-0.5 uppercase">5S</span>
                                                </button>
                                                <button 
                                                    className="p-1 text-white/70 hover:text-white flex flex-col items-center min-w-[32px]"
                                                    onClick={() => { if(videoRef.current) videoRef.current.currentTime += 10; }}
                                                    title="Forward 10s"
                                                >
                                                    <Icon name="RotateCw" size={14} />
                                                    <span className="text-[8px] font-black leading-none mt-0.5 uppercase">10S</span>
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-1.5 group/volume ml-1">
                                                <button 
                                                    onClick={() => {
                                                        const m = !isMuted;
                                                        setIsMuted(m);
                                                        if (videoRef.current) videoRef.current.muted = m;
                                                    }}
                                                    className="text-white/80 hover:text-white"
                                                >
                                                    <Icon name={isMuted || volume === 0 ? "VolumeX" : volume < 0.5 ? "Volume1" : "Volume2"} size={18} />
                                                </button>
                                                <input 
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={isMuted ? 0 : volume}
                                                    onChange={(e) => {
                                                        const v = Number(e.target.value);
                                                        setVolume(v);
                                                        setIsMuted(v === 0);
                                                        if (videoRef.current) {
                                                            videoRef.current.volume = v;
                                                            videoRef.current.muted = v === 0;
                                                        }
                                                    }}
                                                    className="w-0 group-hover/volume:w-16 transition-all duration-300 accent-blue-500 h-1 cursor-pointer opacity-0 group-hover/volume:opacity-100"
                                                />
                                            </div>

                                            <div className="text-[10px] font-mono font-bold text-white/80 border-l border-white/10 pl-2">
                                                {formatTime(watchedSeconds)} <span className="text-white/20">/</span> {formatTime(videoDuration)}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                                                <button 
                                                    className="p-1.5 text-white/60 hover:text-white transition-colors"
                                                    onClick={() => {
                                                        const idx = playlist.findIndex(v => v._id === activeVideo._id);
                                                        if (idx > 0) handleVideoSelect(playlist[idx - 1]);
                                                    }}
                                                    title="Prev Module"
                                                >
                                                    <Icon name="SkipBack" size={16} />
                                                </button>
                                                <button 
                                                    className="p-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-black flex items-center gap-1.5 transition-all shadow-lg shadow-blue-900/40 uppercase"
                                                    onClick={() => {
                                                        const idx = playlist.findIndex(v => v._id === activeVideo._id);
                                                        if (idx < playlist.length - 1) handleVideoSelect(playlist[idx + 1]);
                                                    }}
                                                >
                                                    NEXT <Icon name="SkipForward" size={12} fill="currentColor" />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                                                <div className="flex flex-col items-center">
                                                    <select
                                                        className="bg-transparent border-none text-[10px] font-bold text-blue-400 outline-none cursor-pointer hover:text-white appearance-none h-4"
                                                        value={playbackRate}
                                                        onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                                                    >
                                                        <option value={1}>1X</option>
                                                        <option value={1.5}>1.5X</option>
                                                        <option value={2}>2X</option>
                                                    </select>
                                                    <span className="text-[5px] text-white/30 font-black tracking-widest leading-none">SPEED</span>
                                                </div>
                                                <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-all hover:scale-110 ml-1">
                                                    <Icon name={isFullscreen ? "Minimize" : "Maximize"} size={18} />
                                                </button>
                                            </div>
                                        </div>
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
                    {playlist.map((item, index) => (
                        <VideoCard
                            key={item._id}
                            id={item._id}
                            title={`${item.title}`}
                            subtitle={`Module ${item.moduleIndex}: ${item.moduleTitle}`}
                            duration={item.type === 'quiz' ? 'Assessment' : (item.duration || '00:00')}
                            isCompleted={item.type === 'video' ? completedVideos.includes(String(item._id)) : false}
                            isActive={activeVideo?._id === item._id}
                            icon={item.type === 'quiz' ? 'HelpCircle' : 'Play'}
                            onClick={() => handleVideoSelect(item)}
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
