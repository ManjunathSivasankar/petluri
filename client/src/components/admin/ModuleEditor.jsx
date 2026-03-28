import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardContent } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';
import QuizModal from './QuizModal';
import VideoPlayerModal from '@/components/ui/VideoPlayerModal';

const ModuleEditor = ({ modules = [], setModules, quizzes = [], onQuizCreated, highlightModule = null, programCode = '', courseTitle = '' }) => {
    const [draggedItem, setDraggedItem] = useState(null);
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [editingQuizId, setEditingQuizId] = useState(null);
    const [activeQuizSlot, setActiveQuizSlot] = useState(null);
    // upload progress: key = `${mIndex}_${cIndex}`, value = 0-100
    const [uploadProgress, setUploadProgress] = useState({});
    // video player modal
    const [playerUrl, setPlayerUrl] = useState(null);
    const [playerTitle, setPlayerTitle] = useState('');
    
    // Helper: Derive a descriptive prefix from course title (e.g. "Automation Testing" -> "AT")
    const getCoursePrefix = (title) => {
        if (!title) return 'PROG';
        const words = title.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length === 1) {
            return words[0].slice(0, 3).toUpperCase();
        }
        return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
    };

    // Refs for scrolling to modules
    const moduleRefs = useRef([]);

    // Scroll to highlighted module
    useEffect(() => {
        if (highlightModule !== null && moduleRefs.current[highlightModule]) {
            setTimeout(() => {
                moduleRefs.current[highlightModule].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500); // Wait for data to render
        }
    }, [highlightModule]);

    const handleQuizCreated = (newQuiz) => {
        if (onQuizCreated) onQuizCreated(newQuiz);

        // Auto-assign to the active slot if one exists (only for new creation via this slot)
        if (activeQuizSlot) {
            const { moduleIndex, contentIndex } = activeQuizSlot;
            const newModules = [...modules];
            // Verify structure just in case
            if (newModules[moduleIndex] && newModules[moduleIndex].content[contentIndex]) {
                newModules[moduleIndex].content[contentIndex].quizId = newQuiz._id;
                setModules(newModules);
            }
            setActiveQuizSlot(null);
        }

        setShowQuizModal(false);
        setEditingQuizId(null);
    };

    const addModule = () => {
        setModules([...modules, { title: 'New Module', description: '', content: [] }]);
    };

    const updateModuleTitle = (index, title) => {
        const newModules = [...modules];
        newModules[index].title = title;
        setModules(newModules);
    };

    const updateModuleDescription = (index, desc) => {
        const newModules = [...modules];
        newModules[index].description = desc;
        setModules(newModules);
    }

    const removeModule = (index) => {
        const newModules = modules.filter((_, i) => i !== index);
        setModules(newModules);
    };

    const addContent = (moduleIndex, type) => {
        const newModules = [...modules];
        if (type === 'video') {
            const hasVideo = newModules[moduleIndex].content.some(item => item.type === 'video');
            if (hasVideo) {
                alert('Each module can contain only one video. Replace the existing one if needed.');
                return;
            }
            newModules[moduleIndex].content.push({
                type: 'video',
                title: 'New Video',
                url: '',
                duration: '',
                file: null
            });
        } else if (type === 'quiz') {
            newModules[moduleIndex].content.push({
                type: 'quiz',
                title: 'Quiz',
                quizId: ''
            });
        }
        setModules(newModules);
    };

    const updateContent = (moduleIndex, contentIndex, field, value) => {
        const newModules = [...modules];
        newModules[moduleIndex].content[contentIndex][field] = value;
        setModules(newModules);
    };

    const handleVideoUpload = async (moduleIndex, contentIndex, file) => {
        if (!file) return;
        const slotKey = `${moduleIndex}_${contentIndex}`;
        try {
            const formData = new FormData();
            formData.append('video', file);
            setUploadProgress(prev => ({ ...prev, [slotKey]: 0 }));

            const response = await api.post('/admin/upload-video', formData, {
                onUploadProgress: (evt) => {
                    const pct = evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0;
                    setUploadProgress(prev => ({ ...prev, [slotKey]: pct }));
                }
            });

            const newModules = [...modules];
            const videoData = response.data;
            newModules[moduleIndex].content[contentIndex].url = videoData.url;
            newModules[moduleIndex].content[contentIndex].title = videoData.filename || file.name.replace(/\.[^/.]+$/, '');
            newModules[moduleIndex].content[contentIndex].duration = '00:00';
            newModules[moduleIndex].content[contentIndex].storageKey = videoData.storageKey || '';
            newModules[moduleIndex].content[contentIndex].storageProvider = videoData.storageProvider || 'backblaze';
            newModules[moduleIndex].content[contentIndex].fileSizeBytes = videoData.fileSizeBytes || file.size;
            newModules[moduleIndex].content[contentIndex].uploadedAt = new Date().toISOString();
            
            setModules(newModules);
        } catch (error) {
            console.error('Upload failed', error.response?.data || error.message);
            alert('Video upload failed: ' + (error.response?.data?.message || error.message));
        } finally {
            setUploadProgress(prev => { const n = { ...prev }; delete n[slotKey]; return n; });
        }
    };

    const removeContent = (moduleIndex, contentIndex) => {
        const newModules = [...modules];
        newModules[moduleIndex].content = newModules[moduleIndex].content.filter((_, i) => i !== contentIndex);
        setModules(newModules);
    };

    // Module Drag Handlers
    const handleModuleDragStart = (e, index) => {
        setDraggedItem({ type: 'module', moduleIndex: index });
        e.dataTransfer.effectAllowed = "move";
    };

    const handleModuleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleModuleDrop = (e, index) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.type !== 'module') return;

        const newModules = [...modules];
        const [draggedModule] = newModules.splice(draggedItem.moduleIndex, 1);
        newModules.splice(index, 0, draggedModule);
        setModules(newModules);
        setDraggedItem(null);
    };

    // Content Drag Handlers
    const handleContentDragStart = (e, mIndex, cIndex) => {
        e.stopPropagation();
        setDraggedItem({ type: 'content', moduleIndex: mIndex, contentIndex: cIndex });
        e.dataTransfer.effectAllowed = "move";
    };

    const handleContentDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
    };

    const handleContentDrop = (e, mIndex, cIndex) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedItem || draggedItem.type !== 'content' || draggedItem.moduleIndex !== mIndex) return;

        const newModules = [...modules];
        const moduleContent = newModules[mIndex].content;
        const [draggedContent] = moduleContent.splice(draggedItem.contentIndex, 1);
        moduleContent.splice(cIndex, 0, draggedContent);
        setModules(newModules);
        setDraggedItem(null);
    };

    return (
        <div className="space-y-6">
            {modules.map((module, mIndex) => (
                <Card
                    key={module._id || mIndex}
                    ref={el => moduleRefs.current[mIndex] = el}
                    className={`bg-slate-50 border border-slate-200 shadow-sm transition-all duration-500 ${highlightModule === mIndex ? 'ring-2 ring-blue-500 ring-offset-2 animate-pulse-subtle' : ''}`}
                    draggable
                    onDragStart={(e) => handleModuleDragStart(e, mIndex)}
                    onDragOver={handleModuleDragOver}
                    onDrop={(e) => handleModuleDrop(e, mIndex)}
                >
                    <CardContent className="p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-3 flex-1">
                                <div className="flex items-center gap-3">
                                    <div className="cursor-grab hover:text-slate-700 text-slate-400">
                                        <Icon name="GripVertical" size={20} />
                                    </div>
                                    <span className="h-8 w-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                                        {mIndex + 1}
                                    </span>
                                    <div className="flex-1">
                                        <Label htmlFor={`module-${mIndex}`}>Module Title <span className="text-red-500">*</span></Label>
                                        <Input
                                            id={`module-${mIndex}`}
                                            value={module.title}
                                            onChange={(e) => updateModuleTitle(mIndex, e.target.value)}
                                            placeholder="e.g., Introduction to React"
                                            className="bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="pl-11">
                                    <Label htmlFor={`module-desc-${mIndex}`}>Description <span className="text-red-500">*</span></Label>
                                    <Input
                                        id={`module-desc-${mIndex}`}
                                        value={module.description || ''}
                                        onChange={(e) => updateModuleDescription(mIndex, e.target.value)}
                                        placeholder="Brief summary of this module..."
                                        className="bg-white"
                                    />
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeModule(mIndex)} className="text-red-500 hover:text-red-700">
                                <Icon name="Trash2" size={18} />
                            </Button>
                        </div>

                        {/* Content List */}
                        <div className="pl-11 space-y-3">
                            {module.content.map((item, cIndex) => (
                                <div
                                    key={cIndex}
                                    className="flex items-center gap-3 bg-white p-3 rounded border border-slate-100"
                                    draggable
                                    onDragStart={(e) => handleContentDragStart(e, mIndex, cIndex)}
                                    onDragOver={handleContentDragOver}
                                    onDrop={(e) => handleContentDrop(e, mIndex, cIndex)}
                                >
                                    <div className="cursor-grab hover:text-slate-700 text-slate-300">
                                        <Icon name="GripVertical" size={16} />
                                    </div>
                                    <div className="p-2 rounded bg-slate-100">
                                        <Icon name={item.type === 'video' ? 'Video' : 'FileQuestion'} size={18} className="text-slate-500" />
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <Input
                                            value={item.title}
                                            onChange={(e) => updateContent(mIndex, cIndex, 'title', e.target.value)}
                                            placeholder={item.type === 'video' ? "Video Name" : "Content Title"}
                                        />

                                        {item.type === 'video' ? (
                                            <div className="space-y-1.5 flex-1">
                                                    {!item.url ? (
                                                        <div className="flex flex-col gap-2 w-full">
                                                            <Input
                                                                type="file"
                                                                accept="video/*"
                                                                onChange={(e) => handleVideoUpload(mIndex, cIndex, e.target.files[0])}
                                                                className="text-xs"
                                                                disabled={!!uploadProgress[`${mIndex}_${cIndex}`]}
                                                            />
                                                            <p className="text-[10px] text-slate-400 italic">MP4 recommended. Max size depends on server limits.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded min-h-[80px]">
                                                            <div className="flex items-center justify-between">
                                                                <span className="flex items-center gap-2 text-xs text-green-600 font-bold uppercase tracking-wide">
                                                                    <Icon name="Cloud" size={14} className="text-blue-500" />
                                                                    Backblaze B2 Cloud
                                                                </span>
                                                                {item.fileSizeBytes && (
                                                                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-bold">
                                                                        {(item.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Video ID</span>
                                                                    <code className="bg-white border px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-700">
                                                                        {item.videoId || `${programCode || getCoursePrefix(courseTitle)}-M${mIndex + 1}-V1`}
                                                                    </code>
                                                                </div>
                                                                
                                                                {item.storageKey && (
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Storage Key</span>
                                                                        <code className="bg-white border px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 truncate max-w-[120px]" title={item.storageKey}>
                                                                            {item.storageKey}
                                                                        </code>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                {/* Progress bar */}
                                                {uploadProgress[`${mIndex}_${cIndex}`] !== undefined && (
                                                    <div className="w-full">
                                                        <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                                                            <span>Uploading…</span>
                                                            <span>{uploadProgress[`${mIndex}_${cIndex}`]}%</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 rounded-full transition-all duration-200"
                                                                style={{ width: `${uploadProgress[`${mIndex}_${cIndex}`]}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 w-full">
                                                <select
                                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    value={item.quizId || ''}
                                                    onChange={(e) => updateContent(mIndex, cIndex, 'quizId', e.target.value)}
                                                >
                                                    <option value="">Select Quiz</option>
                                                    {quizzes.map(q => (
                                                        <option key={q._id} value={q._id}>{q.title}</option>
                                                    ))}
                                                </select>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="shrink-0"
                                                    title="Create New Quiz"
                                                    onClick={() => {
                                                        setActiveQuizSlot({ moduleIndex: mIndex, contentIndex: cIndex });
                                                        setEditingQuizId(null);
                                                        setShowQuizModal(true);
                                                    }}
                                                >
                                                    <Icon name="Plus" size={16} />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-1">
                                        {item.type === 'video' ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    if (item.url) {
                                                        // Use proxy for B2 videos to ensure playback
                                                        const previewUrl = item.storageKey 
                                                            ? `/api/admin/videos/stream-raw?key=${encodeURIComponent(item.storageKey)}`
                                                            : item.url;
                                                        setPlayerUrl(previewUrl);
                                                        setPlayerTitle(item.title || 'Video Preview');
                                                    } else {
                                                        alert('No video uploaded yet for this slot.');
                                                    }
                                                }}
                                                className={`${item.url ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50' : 'text-slate-300 cursor-not-allowed'}`}
                                                title={item.url ? 'Preview Video' : 'No video yet'}
                                                disabled={!item.url}
                                            >
                                                <Icon name="Play" size={16} />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setEditingQuizId(item.quizId);
                                                    setShowQuizModal(true);
                                                }}
                                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                title="Edit Quiz"
                                            >
                                                <Icon name="Edit" size={16} />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => removeContent(mIndex, cIndex)} className="text-red-400 hover:text-red-600">
                                            <Icon name="X" size={16} />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            {/* Add Content Buttons */}
                            <div className="flex gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addContent(mIndex, 'video')}
                                    disabled={module.content.some(item => item.type === 'video')}
                                    className="text-xs h-8"
                                >
                                    <Icon name="Plus" size={14} className="mr-1" /> Add Video
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addContent(mIndex, 'quiz')}
                                    className="text-xs h-8"
                                >
                                    <Icon name="Plus" size={14} className="mr-1" /> Add Quiz
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}

            <Button type="button" variant="outline" onClick={addModule} className="w-full border-dashed border-2">
                <Icon name="Plus" size={18} className="mr-2" /> Add Module
            </Button>

            {showQuizModal && (
                <QuizModal
                    quizId={editingQuizId}
                    onClose={() => {
                        setShowQuizModal(false);
                        setEditingQuizId(null);
                        setActiveQuizSlot(null);
                    }}
                    onSuccess={handleQuizCreated}
                />
            )}

            {/* In-app video player */}
            {playerUrl && (
                <VideoPlayerModal
                    url={playerUrl}
                    title={playerTitle}
                    onClose={() => { setPlayerUrl(null); setPlayerTitle(''); }}
                />
            )}
        </div>
    );
};

export default ModuleEditor;
