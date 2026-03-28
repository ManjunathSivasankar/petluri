import React, { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * VideoPlayerModal
 * Props:
 *   url      – resolved video URL (string)
 *   title    – optional title shown in the header
 *   onClose  – called when the user closes the modal
 */
const VideoPlayerModal = ({ url, title = 'Video Preview', onClose }) => {
    const videoRef = useRef(null);

    // Resolve URL: If it starts with /api, prepend the backend host and append the auth token
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const backendHost = apiBase.replace(/\/api$/, '');
    const token = localStorage.getItem('token');
    
    let resolvedUrl = url;
    if (url?.startsWith('/api')) {
        resolvedUrl = `${backendHost}${url}${url.includes('?') ? '&' : '?'}token=${token}`;
    }

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Pause video when modal closes
    useEffect(() => {
        return () => {
            if (videoRef.current) videoRef.current.pause();
        };
    }, []);

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-4xl bg-black rounded-xl overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90">
                    <div className="flex items-center gap-2 text-white">
                        <Icon name="Play" size={16} className="text-blue-400" />
                        <span className="text-sm font-medium truncate max-w-[400px]">{title}</span>
                    </div>
                    <button
                        className="text-slate-400 hover:text-white transition-colors p-1 rounded"
                        onClick={onClose}
                        title="Close (Esc)"
                    >
                        <Icon name="X" size={18} />
                    </button>
                </div>

                {/* Player */}
                <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
                    {url ? (
                        <video
                            ref={videoRef}
                            src={resolvedUrl}
                            controls
                            autoPlay
                            crossOrigin="anonymous"
                            className="w-full h-full"
                            style={{ maxHeight: '75vh' }}
                            onError={() => console.error('Video failed to load:', url)}
                        >
                            <p className="text-white text-center p-8">
                                Your browser does not support HTML5 video.
                            </p>
                        </video>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 p-12">
                            <div className="text-center space-y-2">
                                <Icon name="VideoOff" size={40} className="mx-auto opacity-40" />
                                <p className="text-sm">No video URL available</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoPlayerModal;
