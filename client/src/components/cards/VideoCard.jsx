import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

const VideoCard = ({ title, subtitle, duration, isLocked, isCompleted, isActive, onClick, className, icon = 'Play' }) => {
    return (
        <Card
            onClick={!isLocked ? onClick : undefined}
            className={cn(
                "cursor-pointer transition-all border-none shadow-none bg-transparent hover:bg-slate-50 rounded-lg",
                isActive && "bg-blue-50/80 hover:bg-blue-50/80",
                isLocked && "opacity-60 cursor-not-allowed",
                className
            )}
        >
            <CardContent className="p-3 flex items-start gap-3">
                <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isCompleted ? "bg-green-100 text-green-600" :
                        isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-200" :
                            isLocked ? "bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-500"
                )}>
                    {isCompleted ? <Icon name="Check" size={14} /> :
                        isLocked ? <Icon name="Lock" size={14} /> :
                            <Icon name={icon} size={14} className={isActive ? "fill-current" : ""} />}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className={cn(
                        "text-[10px] uppercase font-bold tracking-wider mb-0.5",
                        isActive ? "text-blue-600" : "text-slate-400"
                    )}>
                        {subtitle}
                    </div>
                    <p className={cn(
                        "text-sm font-bold leading-snug line-clamp-1", 
                        isActive ? "text-slate-900" : "text-slate-700"
                    )}>
                        {title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 font-medium">
                            {duration}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export { VideoCard };
