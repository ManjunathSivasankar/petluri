import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardContent } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';
import QuizModal from './QuizModal';

const ModuleEditor = ({ modules = [], setModules, quizzes = [], onQuizCreated }) => {
    const [draggedItem, setDraggedItem] = useState(null); // { type: 'module'|'content', moduleIndex, contentIndex }
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [editingQuizId, setEditingQuizId] = useState(null);
    const [activeQuizSlot, setActiveQuizSlot] = useState(null); // { moduleIndex, contentIndex }

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
        if (!file) {
            console.error('No video file selected');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('video', file);

            const response = await api.post('/admin/upload-video', formData);

            const newModules = [...modules];
            newModules[moduleIndex].content[contentIndex].url = response.data.url;
            newModules[moduleIndex].content[contentIndex].title = file.name.replace(/\.[^/.]+$/, "");
            newModules[moduleIndex].content[contentIndex].duration = "10:00";
            setModules(newModules);
        } catch (error) {
            console.error("Upload failed", error.response?.data || error.message);
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
                    key={mIndex}
                    className="bg-slate-50 border border-slate-200"
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
                                            placeholder="Content Title"
                                        />

                                        {item.type === 'video' ? (
                                            <div className="flex gap-2">
                                                <Input
                                                    type="file"
                                                    accept="video/*"
                                                    onChange={(e) => handleVideoUpload(mIndex, cIndex, e.target.files[0])}
                                                    className="text-xs"
                                                />
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
                                                    if (item.url) window.open(item.url, '_blank');
                                                    else alert("No URL to preview");
                                                }}
                                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                title="Preview Video"
                                            >
                                                <Icon name="Eye" size={16} />
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
                        setActiveQuizSlot(null); // Clear slot on close
                    }}
                    onSuccess={handleQuizCreated}
                />
            )}
        </div>
    );
};

export default ModuleEditor;
