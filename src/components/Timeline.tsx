import React from 'react';

interface TimelineProps {
  currentTime: number;
  onTimeChange: (time: number) => void;
  mediaFiles: any[];
}

export const Timeline: React.FC<TimelineProps> = ({
  currentTime,
  onTimeChange,
  mediaFiles
}) => {
  return (
    <div className="timeline-container">
      <div className="timeline-ruler">
        {/* Ruler marks */}
        <div className="ruler-marks">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="ruler-mark">
              <span>{i * 10}s</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="tracks">
        {/* Video Track */}
        <div className="track video-track">
          <div className="track-label">Vidéo 1</div>
          <div className="track-content">
            {mediaFiles.filter(f => f.type === 'video').map(media => (
              <div key={media.id} className="clip video-clip">
                {media.name}
              </div>
            ))}
          </div>
        </div>
        
        {/* Audio Track */}
        <div className="track audio-track">
          <div className="track-label">Audio 1</div>
          <div className="track-content">
            {mediaFiles.filter(f => f.type === 'audio').map(media => (
              <div key={media.id} className="clip audio-clip">
                {media.name}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Playhead */}
      <div 
        className="playhead"
        style={{ left: `${(currentTime / 100) * 100}%` }}
      />
    </div>
  );
};
