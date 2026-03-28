import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import api from '@/lib/api';
import VideoPlayerModal from '@/components/ui/VideoPlayerModal';

// ──────────────────────────── helpers ────────────────────────────


const formatBytes = (bytes = 0) => {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = Number(bytes);
    let i = 0;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ──────────────────────────── sub-components ────────────────────────────

const StorageBadge = ({ provider }) => {
    const isB2 = provider === 'backblaze';
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            isB2 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
        }`}>
            {isB2 ? <Icon name="Cloud" size={11} /> : <Icon name="HardDrive" size={11} />}
            {isB2 ? 'Backblaze B2' : 'Local'}
        </span>
    );
};

const StatCard = ({ icon, label, value, colorClass = 'text-slate-700', iconBg = 'bg-slate-100' }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon name={icon} size={18} className={colorClass} />
        </div>
        <div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
        </div>
    </div>
);

// ──────────────────────────── Tab 1 — Library ────────────────────────────

const LibraryTab = ({ onLibraryLoaded, onPlay }) => {
    const [allRows, setAllRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [uploadingKey, setUploadingKey] = useState('');
    const [uploadProgress, setUploadProgress] = useState({}); // key -> pct
    const [fileByKey, setFileByKey] = useState({});

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [vidRes, courseRes] = await Promise.all([
                api.get('/admin/videos'),
                api.get('/admin/courses')
            ]);
            const videos = vidRes.data || [];
            const courses = courseRes.data || [];

            // Build set of already-tracked module keys
            const existingKeys = new Set(videos.map(r => `${r.courseId}_${r.moduleId}`));

            // Add empty-slot rows for modules that have no video yet
            courses.forEach(course => {
                (course.modules || []).forEach((mod, mIdx) => {
                    if (!existingKeys.has(`${course._id}_${mod._id}`)) {
                        videos.push({
                            courseId: course._id,
                            courseTitle: course.title,
                            moduleId: mod._id,
                            moduleTitle: mod.title,
                            moduleIndex: mIdx,
                            videoTitle: null, fileName: null,
                            fileSizeBytes: 0, uploadedAt: null,
                            storageProvider: null, storageKey: null, url: null
                        });
                    }
                });
            });

            setAllRows(videos);
            onLibraryLoaded(videos.filter(r => r.url)); // pass only real videos for B2 matching
        } catch (e) {
            console.error('Library fetch failed:', e.message);
        } finally {
            setLoading(false);
        }
    }, [onLibraryLoaded]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const displayRows = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return allRows;
        return allRows.filter(r =>
            (r.courseTitle || '').toLowerCase().includes(q) ||
            (r.moduleTitle || '').toLowerCase().includes(q) ||
            (r.fileName || '').toLowerCase().includes(q) ||
            (r.videoTitle || '').toLowerCase().includes(q) ||
            (r.storageKey || '').toLowerCase().includes(q)
        );
    }, [allRows, search]);

    const handleUpload = async (courseId, moduleId, file) => {
        const key = `${courseId}_${moduleId}`;
        setUploadingKey(key);
        setUploadProgress(prev => ({ ...prev, [key]: 0 }));
        try {
            const form = new FormData();
            form.append('video', file);
            form.append('courseId', courseId);
            form.append('moduleId', moduleId);
            form.append('title', file.name.replace(/\.[^/.]+$/, ''));
            
            await api.post('/admin/videos/upload', form, {
                onUploadProgress: (evt) => {
                    const pct = evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0;
                    setUploadProgress(prev => ({ ...prev, [key]: pct }));
                }
            });
            
            await fetchAll();
            setFileByKey(prev => { const n = { ...prev }; delete n[key]; return n; });
        } catch (e) {
            alert(e?.response?.data?.message || 'Upload failed');
        } finally {
            setUploadingKey('');
            setUploadProgress(prev => { const n = { ...prev }; delete n[key]; return n; });
        }
    };

    const handleDelete = async (courseId, moduleId) => {
        if (!window.confirm('Delete this video? This cannot be undone.')) return;
        try {
            await api.delete(`/admin/videos/${courseId}/${moduleId}`);
            await fetchAll();
        } catch (e) {
            alert(e?.response?.data?.message || 'Delete failed');
        }
    };

    const b2Count = allRows.filter(r => r.storageProvider === 'backblaze').length;
    const localCount = allRows.filter(r => r.storageProvider === 'local').length;
    const emptyCount = allRows.filter(r => !r.url).length;

    return (
        <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard icon="Video" label="Total Modules" value={allRows.length} iconBg="bg-slate-100" />
                <StatCard icon="Cloud" label="On Backblaze B2" value={b2Count} colorClass="text-blue-600" iconBg="bg-blue-50" />
                <StatCard icon="AlertCircle" label="No Video Yet" value={emptyCount} colorClass="text-amber-500" iconBg="bg-amber-50" />
            </div>

            {/* Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input className="pl-8" placeholder="Search course, module, filename, B2 key…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={fetchAll}>
                    <Icon name="RefreshCw" size={13} className="mr-1" /> Refresh
                </Button>
                <span className="text-xs text-slate-500">{displayRows.length} rows</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead className="w-[120px]">Video ID</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Module</TableHead>
                            <TableHead>Video Title</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                                    <Icon name="Loader" size={18} className="animate-spin inline mr-2" />Loading…
                                </TableCell>
                            </TableRow>
                        ) : displayRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-12 text-slate-400">No results.</TableCell>
                            </TableRow>
                        ) : displayRows.map((row) => {
                            const rowKey = `${row.courseId}_${row.moduleId}`;
                            const videoUrl = row.url;
                            const pendingFile = fileByKey[rowKey];
                            const hasVideo = Boolean(row.url);

                            return (
                                <TableRow key={rowKey} className={`${!hasVideo ? 'opacity-55' : ''} hover:bg-slate-50/60`}>
                                    <TableCell className="text-sm font-bold text-blue-600">
                                        {row.videoId ? <code className="bg-blue-50 px-1.5 py-0.5 rounded font-mono">{row.videoId}</code> : <span className="text-slate-300">—</span>}
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-800 max-w-[130px] truncate" title={row.courseTitle}>
                                        {row.courseTitle}
                                    </TableCell>
                                    <TableCell className="text-slate-600 max-w-[120px] truncate" title={row.moduleTitle}>
                                        {row.moduleTitle}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-700 max-w-[150px] truncate" title={row.videoTitle}>
                                        {row.videoTitle || <span className="text-slate-300 italic text-xs">—</span>}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">{formatBytes(row.fileSizeBytes)}</TableCell>
                                    <TableCell className="text-xs text-slate-500">{fmtDate(row.uploadedAt)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {hasVideo ? (
                                                <>
                                                    <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50 h-8 px-2"
                                                        onClick={() => window.location.href = `/admin/programs/edit/${row.courseId}?step=1&module=${allRows.find(r => r.courseId === row.courseId && r.moduleId === row.moduleId)?.moduleIndex || 0}`}
                                                    >
                                                        <Icon name="ExternalLink" size={14} className="mr-1" /> View Module
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500"
                                                        onClick={() => onPlay(row.url, `${row.courseTitle} - ${row.moduleTitle}`)} 
                                                        title="Play Preview"
                                                    >
                                                        <Icon name="Play" size={15} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" 
                                                        onClick={() => handleDelete(row.courseId, row.moduleId)} 
                                                        title="Delete"
                                                    >
                                                        <Icon name="Trash2" size={15} />
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="file" accept="video/*" className="max-w-[140px] text-xs h-8"
                                                        onChange={e => setFileByKey(prev => ({ ...prev, [rowKey]: e.target.files?.[0] }))}
                                                        disabled={uploadingKey === rowKey}
                                                    />
                                                    <Button size="sm" className="h-8 px-2 text-xs" disabled={!pendingFile || uploadingKey === rowKey}
                                                        onClick={() => pendingFile && handleUpload(row.courseId, row.moduleId, pendingFile)}>
                                                        {uploadingKey === rowKey ? 'Uploading…' : 'Upload'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {uploadProgress[rowKey] !== undefined && (
                                            <div className="w-full mt-1">
                                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${uploadProgress[rowKey]}%` }} />
                                                </div>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

// ──────────────────────────── Tab 2 — B2 Browser ────────────────────────────

const B2BrowserTab = ({ libraryRows, onPlay }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedFolders, setExpandedFolders] = useState({});
    const [search, setSearch] = useState('');
    const [deletingKey, setDeletingKey] = useState('');

    // storageKey → library row for matching
    const libraryByKey = useMemo(() => {
        const map = {};
        libraryRows.forEach(r => { if (r.storageKey) map[r.storageKey] = r; });
        return map;
    }, [libraryRows]);

    const fetchBucket = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const { data: res } = await api.get('/admin/videos/b2-bucket');
            setData(res);
            const expanded = {};
            (res.folders || []).forEach(f => { expanded[f.name] = true; });
            setExpandedFolders(expanded);
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to load B2 bucket contents.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchBucket(); }, [fetchBucket]);

    const handleDeleteB2 = async (key) => {
        const match = libraryByKey[key];
        const msg = match
            ? `Delete "${key}" from B2?\n\nThis file is linked to:\nCourse: ${match.courseTitle}\nModule: ${match.moduleTitle}\n\nThe video entry will also be removed from that module.`
            : `Delete "${key}" permanently from Backblaze B2? This cannot be undone.`;
        if (!window.confirm(msg)) return;
        setDeletingKey(key);
        try {
            await api.delete('/admin/videos/b2-file', { data: { key } });
            await fetchBucket();
        } catch (e) {
            alert(e?.response?.data?.message || 'Delete from B2 failed');
        } finally {
            setDeletingKey('');
        }
    };

    const toggleFolder = (name) => setExpandedFolders(prev => ({ ...prev, [name]: !prev[name] }));

    if (loading) return (
        <div className="flex items-center justify-center py-24 text-slate-400">
            <Icon name="Loader" size={22} className="animate-spin mr-3" />Connecting to Backblaze B2…
        </div>
    );

    if (error) return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-3">
            <Icon name="AlertCircle" size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
                <p className="font-semibold text-red-700">Could not fetch bucket contents</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={fetchBucket}>Retry</Button>
            </div>
        </div>
    );

    if (!data?.enabled) return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center space-y-2">
            <Icon name="WifiOff" size={36} className="text-amber-400 mx-auto" />
            <h3 className="font-semibold text-amber-800">Backblaze B2 Not Configured</h3>
            <p className="text-sm text-amber-700 max-w-md mx-auto">
                Set <code className="bg-amber-100 px-1 rounded">B2_KEY_ID</code>, <code className="bg-amber-100 px-1 rounded">B2_APPLICATION_KEY</code>,{' '}
                <code className="bg-amber-100 px-1 rounded">B2_BUCKET_NAME</code> and <code className="bg-amber-100 px-1 rounded">B2_ENDPOINT</code> in your backend <code className="bg-amber-100 px-1 rounded">.env</code>.
            </p>
        </div>
    );

    // Compute stats from bucket data + library matching
    const allFiles = (data.folders || []).flatMap(f => f.files);
    const matchedFiles = allFiles.filter(f => libraryByKey[f.key]);
    const unmatchedFiles = allFiles.filter(f => !libraryByKey[f.key]);
    const totalSize = allFiles.reduce((s, f) => s + f.size, 0);

    const q = search.toLowerCase();
    const filteredFolders = (data.folders || []).map(folder => ({
        ...folder,
        files: q ? folder.files.filter(f => f.fileName.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)) : folder.files
    })).filter(folder => !q || folder.files.length > 0);

    return (
        <div className="space-y-4">
            {/* Dashboard widgets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon="Database" label="Total Files in B2" value={allFiles.length} iconBg="bg-slate-100" />
                <StatCard icon="CheckCircle" label="Linked to App" value={matchedFiles.length} colorClass="text-green-600" iconBg="bg-green-50" />
                <StatCard icon="MinusCircle" label="Not in Library" value={unmatchedFiles.length} colorClass="text-amber-500" iconBg="bg-amber-50" />
                <StatCard icon="BarChart2" label="Total B2 Size" value={formatBytes(totalSize)} colorClass="text-blue-600" iconBg="bg-blue-50" />
            </div>

            {/* Header bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                    <Icon name="Database" size={14} className="text-blue-600" />
                    <span className="text-sm text-blue-800 font-medium">{data.bucket}</span>
                </div>
                <span className="text-xs text-slate-500">{data.folders?.length} folder{data.folders?.length !== 1 ? 's' : ''}</span>
                <div className="flex-1" />
                <div className="relative max-w-sm w-full">
                    <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input className="pl-8 text-sm" placeholder="Filter by name or key…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={fetchBucket}>
                    <Icon name="RefreshCw" size={13} className="mr-1" /> Refresh
                </Button>
            </div>

            {/* Folder accordion */}
            <div className="space-y-2">
                {filteredFolders.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-lg py-12 text-center text-slate-400 text-sm">No files found.</div>
                ) : filteredFolders.map(folder => (
                    <div key={folder.name} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        {/* Folder header */}
                        <button
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                            onClick={() => toggleFolder(folder.name)}
                        >
                            <Icon name={expandedFolders[folder.name] ? 'ChevronDown' : 'ChevronRight'} size={14} className="text-slate-400 shrink-0" />
                            <Icon name="Folder" size={15} className="text-yellow-500 shrink-0" />
                            <span className="font-medium text-slate-800 text-sm">{folder.name}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full ml-1">
                                {folder.files.filter(f => libraryByKey[f.key]).length} linked
                            </span>
                            <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                {folder.files.length} file{folder.files.length !== 1 ? 's' : ''}
                            </span>
                        </button>

                        {expandedFolders[folder.name] && (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/80">
                                        <TableHead className="pl-10">File Name</TableHead>
                                        <TableHead>Course</TableHead>
                                        <TableHead>Module</TableHead>
                                        <TableHead>App Video Name</TableHead>
                                        <TableHead>B2 Key</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Last Modified</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {folder.files.map(file => {
                                        const match = libraryByKey[file.key];
                                        const isDeleting = deletingKey === file.key;
                                        return (
                                            <TableRow key={file.key} className={`hover:bg-blue-50/20 ${match ? '' : 'opacity-70'}`}>
                                                <TableCell className="pl-10">
                                                    <div className="flex items-center gap-2">
                                                        <Icon name="Film" size={13} className="text-slate-400 shrink-0" />
                                                        <span className="text-sm font-medium text-slate-800">{file.fileName}</span>
                                                    </div>
                                                </TableCell>
                                                {/* Course */}
                                                <TableCell>
                                                    {match
                                                        ? <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">{match.courseTitle}</span>
                                                        : <span className="text-xs text-slate-300">—</span>}
                                                </TableCell>
                                                {/* Module */}
                                                <TableCell>
                                                    {match
                                                        ? <span className="text-xs text-slate-600">{match.moduleTitle}</span>
                                                        : <span className="text-xs text-slate-300">—</span>}
                                                </TableCell>
                                                {/* App video name */}
                                                <TableCell>
                                                    {match
                                                        ? <span className="text-xs text-slate-700 italic">{match.videoTitle || match.fileName}</span>
                                                        : <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                            <Icon name="AlertTriangle" size={10} />Not in library
                                                          </span>}
                                                </TableCell>
                                                {/* B2 key */}
                                                <TableCell>
                                                    <code className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded max-w-[150px] block truncate" title={file.key}>
                                                        {file.key}
                                                    </code>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600">{formatBytes(file.size)}</TableCell>
                                                <TableCell className="text-xs text-slate-500">{fmtDate(file.lastModified)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            onClick={() => onPlay(file.url, file.fileName)}
                                                            title="Preview Video"
                                                        >
                                                            <Icon name="Play" size={14} className="text-blue-500" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost" size="icon"
                                                        disabled={isDeleting}
                                                        onClick={() => handleDeleteB2(file.key)}
                                                        title="Delete from B2"
                                                    >
                                                        {isDeleting
                                                            ? <Icon name="Loader" size={14} className="text-red-400 animate-spin" />
                                                            : <Icon name="Trash2" size={14} className="text-red-500" />}
                                                    </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ──────────────────────────── Main Page ────────────────────────────

const TABS = [
    { id: 'library', label: 'Video Library', icon: 'Video' },
    { id: 'b2', label: 'Backblaze B2 Browser', icon: 'Cloud' }
];

const VideosPage = () => {
    const [activeTab, setActiveTab] = useState('library');
    const [libraryRows, setLibraryRows] = useState([]);
    const [playerUrl, setPlayerUrl] = useState(null);
    const [playerTitle, setPlayerTitle] = useState('');

    const handlePlay = (url, title) => {
        setPlayerUrl(url);
        setPlayerTitle(title);
    };

    return (
        <div className="space-y-6 pb-20">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Video Management</h1>
                <p className="text-sm text-slate-500 mt-1">Course-wise video library and live Backblaze B2 bucket browser.</p>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Icon name={tab.icon} size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'library' && (
                <LibraryTab 
                    onLibraryLoaded={setLibraryRows} 
                    onPlay={handlePlay} 
                />
            )}
            {activeTab === 'b2' && (
                <B2BrowserTab 
                    libraryRows={libraryRows} 
                    onPlay={handlePlay} 
                />
            )}

            {/* In-app video player for the entire page */}
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

export default VideosPage;
