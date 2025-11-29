import { FFmpegOrchestrator } from '../packages/ffmpeg-orchestrator/dist/index.js';

const orchestrator = new FFmpegOrchestrator();

// Exemple d'utilisation
async function buildProxy() {
  const mediaInfos = await orchestrator.importMedia(['/path/to/video.mp4']);
  console.log('Proxies built:', mediaInfos);
}

buildProxy().catch(console.error);
