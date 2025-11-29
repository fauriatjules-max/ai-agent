import { Keyframe, BezierCurve } from './KeyframeMath';

export interface Clip {
  id: string;
  startTime: number;
  duration: number;
  filePath: string;
  type: 'video' | 'audio' | 'image';
  keyframes: Keyframe[];
}

export interface Track {
  id: string;
  type: 'video' | 'audio';
  clips: Clip[];
  locked: boolean;
  muted: boolean;
}

export class TimelineEngine {
  private tracks: Track[] = [];
  private currentTime: number = 0;
  private duration: number = 0;

  addTrack(type: 'video' | 'audio'): Track {
    const track: Track = {
      id: `track_${Date.now()}`,
      type,
      clips: [],
      locked: false,
      muted: false
    };
    this.tracks.push(track);
    return track;
  }

  addClip(trackId: string, clip: Omit<Clip, 'id'>): Clip {
    const track = this.tracks.find(t => t.id === trackId);
    if (!track) throw new Error(`Track ${trackId} not found`);

    const newClip: Clip = {
      ...clip,
      id: `clip_${Date.now()}`
    };

    track.clips.push(newClip);
    this.updateDuration();
    return newClip;
  }

  splitClip(clipId: string, time: number): { firstClip: Clip, secondClip: Clip } {
    // Implémentation du split de clip
    // ... (code pour diviser un clip à un temps donné)
  }

  private updateDuration() {
    this.duration = Math.max(...this.tracks.flatMap(track => 
      track.clips.map(clip => clip.startTime + clip.duration)
    ));
  }

  getClipsAtTime(time: number): Clip[] {
    return this.tracks.flatMap(track =>
      track.clips.filter(clip =>
        clip.startTime <= time && clip.startTime + clip.duration >= time
      )
    );
  }

  // Gestion des keyframes et animations
  addKeyframe(clipId: string, keyframe: Keyframe) {
    const clip = this.findClip(clipId);
    clip.keyframes.push(keyframe);
    clip.keyframes.sort((a, b) => a.time - b.time);
  }

  private findClip(clipId: string): Clip {
    for (const track of this.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
    throw new Error(`Clip ${clipId} not found`);
  }

  // Calcul des transformations à un temps donné
  getClipTransform(clipId: string, time: number): any {
    const clip = this.findClip(clipId);
    const keyframes = clip.keyframes.filter(k => k.property === 'transform');
    
    // Implémentation de l'interpolation entre keyframes
    // ... (utilise BezierCurve pour l'interpolation)
  }
}
