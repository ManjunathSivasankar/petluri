import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

/**
 * VideoPlayer Component
 * 
 * Props:
 * - src: string (video source URL)
 * - title: string (optional)
 * - poster: string (optional)
 * - autoPlay: boolean
 * - initialTime: number (start from this time)
 * - maxPlayed: number (the furthest point the user has watched)
 * - onProgress: function ({ currentTime, duration, maxPlayed })
 * - onEnded: function
 * - restrictSeeking: boolean (if true, user can't seek past maxPlayed + 10s)
 */
export const VideoPlayer = ({
    src,
    title = '',
    poster = '',
    autoPlay = false,
    initialTime = 0,
    maxPlayed = 0,
    onProgress,
    onEnded,
    restrictSeeking = true,
    className = ''
}) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [localMaxPlayed, setLocalMaxPlayed] = useState(maxPlayed);
    const controlsTimeoutRef = useRef(null);

    // Sync external maxPlayed to local state
    useEffect(() => {
        if (maxPlayed > localMaxPlayed) {
            setLocalMaxPlayed(maxPlayed);
        }
    }, [maxPlayed]);

    // Handle initial seek
    useEffect(() => {
        if (videoRef.current && initialTime > 0) {
            videoRef.current.currentTime = initialTime;
        }
    }, [initialTime]);

    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    }, []);

    const handleSeek = useCallback((amount) => {
        if (!videoRef.current) return;
        const newTime = videoRef.current.currentTime + amount;
        
        if (amount > 0 && restrictSeeking) {
            // Forward jump: limit to maxPlayed + 10s or video duration
            const allowedMax = Math.min(duration, localMaxPlayed + 10);
            videoRef.current.currentTime = Math.min(newTime, allowedMax);
        } else {
            // Backward jump: always allowed
            videoRef.current.currentTime = Math.max(0, newTime);
        }
    }, [duration, localMaxPlayed, restrictSeeking]);

    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Fullscreen error: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }, []);

    const handleVolumeChange = (e) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        setIsMuted(v === 0);
        if (videoRef.current) {
            videoRef.current.volume = v;
            videoRef.current.muted = v === 0;
        }
    };

    const handleScrub = (e) => {
        if (!videoRef.current) return;
        const time = parseFloat(e.target.value);
        
        if (restrictSeeking && time > localMaxPlayed + 1) {
            // Prevent large jumps forward
            videoRef.current.currentTime = localMaxPlayed;
        } else {
            videoRef.current.currentTime = time;
        }
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const current = videoRef.current.currentTime;
        setCurrentTime(current);

        // Update local max played if we've watched further
        if (current > localMaxPlayed) {
            setLocalMaxPlayed(current);
        }

        if (onProgress) {
            onProgress({
                currentTime: current,
                duration: videoRef.current.duration || 0,
                maxPlayed: localMaxPlayed
            });
        }
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    handleSeek(10);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    handleSeek(-10);
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, handleSeek, toggleFullscreen]);

    // UI Control Visibility
    useEffect(() => {
        const handleMouseMove = () => {
            setShowControls(true);
            clearTimeout(controlsTimeoutRef.current);
            if (isPlaying) {
                controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
            }
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('mousemove', handleMouseMove);
            container.addEventListener('mouseleave', () => {
                if (isPlaying) setShowControls(false);
            });
        }
        return () => {
            if (container) {
                container.removeEventListener('mousemove', handleMouseMove);
            }
            clearTimeout(controlsTimeoutRef.current);
        };
    }, [isPlaying]);

    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    return (
        <div 
            ref={containerRef}
            className={cn(
                "relative group/vidplayer bg-black overflow-hidden w-full h-full",
                isFullscreen ? "fixed inset-0 z-[10000]" : "rounded-xl",
                className
            )}
        >
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                className="w-full h-full object-contain cursor-pointer"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => setDuration(videoRef.current.duration)}
                onEnded={onEnded}
                onLoadStart={() => setIsLoading(true)}
                onCanPlay={() => setIsLoading(false)}
                onWaiting={() => setIsLoading(true)}
                onPlaying={() => setIsLoading(false)}
                onClick={togglePlay}
                autoPlay={autoPlay}
                playsInline
                crossOrigin="anonymous"
                controls={false}
                onContextMenu={(e) => e.preventDefault()}
            />

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Center Play/Pause Indicator (Large) */}
            <div 
                className={cn(
                    "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 z-30",
                    !isPlaying || (!showControls && isPlaying) ? "opacity-100" : "opacity-0"
                )}
            >
                <button 
                    className="w-16 h-16 bg-blue-600/80 hover:bg-blue-600 rounded-full flex items-center justify-center text-white backdrop-blur-sm pointer-events-auto shadow-xl transition-transform hover:scale-110 active:scale-95"
                    onClick={togglePlay}
                >
                    <Icon name={isPlaying ? "Pause" : "Play"} size={28} className={!isPlaying ? "ml-1" : ""} />
                </button>
            </div>

            {/* Controls Overlay */}
            <div 
                className={cn(
                    "absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-white/10 p-3 pt-6 transition-all duration-300 z-[100]",
                    !showControls && isPlaying ? "opacity-0 translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"
                )}
            >
                {/* Progress Bar (Scrubber) */}
                <div className="relative w-full h-1.5 group/scrubber mb-3 cursor-pointer flex items-center">
                    <input 
                        type="range"
                        min="0"
                        max={duration || 0}
                        step="0.1"
                        value={currentTime}
                        onChange={handleScrub}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <div className="absolute inset-0 bg-white/20 rounded-full h-1.5"></div>
                    {restrictSeeking && (
                        <div 
                            className="absolute inset-y-0 left-0 bg-white/10 rounded-full h-1.5 transition-all"
                            style={{ width: `${(localMaxPlayed / (duration || 1)) * 100}%` }}
                        ></div>
                    )}
                    <div 
                        className="absolute inset-y-0 left-0 bg-blue-500 rounded-full h-1.5 transition-all shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    ></div>
                    <div 
                        className="absolute top-1/2 -translate-y-1/2 h-4 w-4 bg-white rounded-full shadow-xl border-2 border-blue-500 transition-all opacity-100 scale-100"
                        style={{ left: `${(currentTime / (duration || 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
                    ></div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={togglePlay} 
                            className="text-white hover:text-blue-400 transition-all active:scale-90"
                        >
                            <Icon name={isPlaying ? "Pause" : "Play"} size={24} fill="currentColor" />
                        </button>

                        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1">
                            <button 
                                className="p-1 px-3 text-white hover:bg-white/10 rounded-md transition-all flex flex-col items-center group/rewind"
                                onClick={() => handleSeek(-10)}
                                title="Back 10s"
                            >
                                <Icon name="RotateCcw" size={20} className="group-active/rewind:-rotate-45" />
                                <span className="text-[9px] font-black mt-0.5 text-blue-400">10S</span>
                            </button>
                            <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                            <button 
                                className="p-1 px-3 text-white hover:bg-white/10 rounded-md transition-all flex flex-col items-center group/forward"
                                onClick={() => handleSeek(10)}
                                title="Forward 10s"
                            >
                                <Icon name="RotateCw" size={20} className="group-active/forward:rotate-45" />
                                <span className="text-[9px] font-black mt-0.5 text-blue-400">10S</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 group/volume ml-2">
                            <button 
                                onClick={() => {
                                    const m = !isMuted;
                                    setIsMuted(m);
                                    if (videoRef.current) videoRef.current.muted = m;
                                }}
                                className="text-white/80 hover:text-white"
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                <Icon name={isMuted || volume === 0 ? "VolumeX" : volume < 0.5 ? "Volume1" : "Volume2"} size={18} />
                            </button>
                            <input 
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-0 group-hover/volume:w-16 transition-all duration-300 accent-blue-500 h-1 cursor-pointer opacity-0 group-hover/volume:opacity-100"
                            />
                        </div>

                        <div className="text-xs font-mono font-medium text-white/90 ml-2">
                            {formatTime(currentTime)} <span className="text-white/30 mx-1">/</span> {formatTime(duration)}
                        </div>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest hidden sm:block">Speed</span>
                            <select
                                className="bg-white/10 hover:bg-white/20 border-none text-xs font-bold text-white rounded px-2 py-1 outline-none cursor-pointer transition-colors appearance-none text-center min-w-[50px]"
                                value={playbackRate}
                                onChange={(e) => {
                                    const r = parseFloat(e.target.value);
                                    setPlaybackRate(r);
                                    if (videoRef.current) videoRef.current.playbackRate = r;
                                }}
                            >
                                <option value={0.5} className="bg-slate-900">0.5x</option>
                                <option value={1} className="bg-slate-900">1.0x</option>
                                <option value={1.5} className="bg-slate-900">1.5x</option>
                                <option value={2} className="bg-slate-900">2.0x</option>
                            </select>
                        </div>

                        <button 
                            onClick={toggleFullscreen} 
                            className="text-white/80 hover:text-white transition-all hover:scale-110"
                            title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
                        >
                            <Icon name={isFullscreen ? "Minimize" : "Maximize"} size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
