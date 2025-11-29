// Ce script peut être utilisé pour vérifier la présence de FFmpeg et FFprobe
import { exec } from 'child_process';

function checkFFmpeg() {
  exec('ffmpeg -version', (error, stdout, stderr) => {
    if (error) {
      console.error('FFmpeg n\'est pas installé ou non trouvé dans le PATH');
      return;
    }
    console.log('FFmpeg trouvé:', stdout.split('\n')[0]);
  });

  exec('ffprobe -version', (error, stdout, stderr) => {
    if (error) {
      console.error('FFprobe n\'est pas installé ou non trouvé dans le PATH');
      return;
    }
    console.log('FFprobe trouvé:', stdout.split('\n')[0]);
  });
}

checkFFmpeg();
