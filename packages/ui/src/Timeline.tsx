import React, { useRef, useEffect } from 'react';

interface TimelineProps {
  tracks: any[];
  currentTime: number;
  onTimeChange: (time: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ tracks, currentTime, onTimeChange }) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timelineWidth = rect.width;
    const newTime = (clickX / timelineWidth) * 100; // Suppose une durée de 100 unités pour l'exemple
    
    onTimeChange(newTime);
  };

  return (
    <div 
      ref={timelineRef}
      className="timeline-container bg-gray-800 h-48 relative cursor-pointer"
      onClick={handleTimelineClick}
    >
      {/* Ruler */}
      <div className="timeline-ruler h-6 bg-gray-700 border-b border-gray-600"></div>
      
      {/* Tracks */}
      <div className="tracks-container">
        {tracks.map(track => (
          <TrackComponent key={track.id} track={track} />
        ))}
      </div>
      
      {/* Playhead */}
      <div 
        className="playhead absolute top-0 bottom-0 w-0.5 bg-red-500"
        style={{ left: `${currentTime}%` }}
      />
    </div>
  );
};

const TrackComponent: React.FC<{ track: any }> = ({ track }) => {
  return (
    <div className="track h-12 border-b border-gray-700 relative">
      {track.clips.map((clip: any) => (
        <ClipComponent key={clip.id} clip={clip} />
      ))}
    </div>
  );
};

const ClipComponent: React.FC<{ clip: any }> = ({ clip }) => {
  return (
    <div 
      className="clip absolute h-10 bg-blue-500 rounded border border-blue-400"
      style={{
        left: `${clip.startTime}%`,
        width: `${clip.duration}%`
      }}
    >
      <span className="text-xs text-white p-1">{clip.id}</span>
    </div>
  );
};
