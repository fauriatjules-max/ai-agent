import { Howl, Howler } from 'howler'

class AudioManager {
  private sounds: Map<string, Howl> = new Map()
  private music: Howl | null = null
  private isMuted: boolean = false
  private volume: number = 0.7
  private musicVolume: number = 0.5

  constructor() {
    this.preloadSounds()
    Howler.volume(this.volume)
  }

  private preloadSounds() {
    const soundDefinitions = [
      { id: 'engine_start', url: '/sounds/engine-start.mp3' },
      { id: 'engine_idle', url: '/sounds/engine-idle.mp3', loop: true },
      { id: 'engine_accelerate', url: '/sounds/engine-accelerate.mp3' },
      { id: 'brake', url: '/sounds/brake.mp3' },
      { id: 'gear_shift', url: '/sounds/gear-shift.mp3' },
      { id: 'tyre_screech', url: '/sounds/tyre-screech.mp3' },
      { id: 'crash', url: '/sounds/crash.mp3' },
      { id: 'success', url: '/sounds/success.mp3' },
      { id: 'click', url: '/sounds/click.mp3' },
      { id: 'countdown', url: '/sounds/countdown.mp3' }
    ]

    soundDefinitions.forEach(def => {
      this.sounds.set(def.id, new Howl({
        src: [def.url],
        volume: this.volume,
        loop: def.loop || false,
        preload: true
      }))
    })
  }

  playSound(id: string, options: any = {}) {
    if (this.isMuted) return

    const sound = this.sounds.get(id)
    if (sound) {
      if (options.overlap || !sound.playing()) {
        sound.volume(options.volume || this.volume)
        sound.play()
      }
    }
  }

  stopSound(id: string) {
    const sound = this.sounds.get(id)
    sound?.stop()
  }

  playMusic(track: 'menu' | 'game' | 'results') {
    if (this.music) {
      this.music.stop()
    }

    const tracks = {
      menu: '/music/menu.mp3',
      game: '/music/game.mp3',
      results: '/music/results.mp3'
    }

    this.music = new Howl({
      src: [tracks[track]],
      volume: this.musicVolume,
      loop: true,
      autoplay: true
    })
  }

  stopMusic() {
    this.music?.stop()
    this.music = null
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    Howler.volume(this.volume)
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    if (this.music) {
      this.music.volume(this.musicVolume)
    }
  }

  mute() {
    this.isMuted = true
    Howler.mute(true)
  }

  unmute() {
    this.isMuted = false
    Howler.mute(false)
  }

  toggleMute() {
    this.isMuted ? this.unmute() : this.mute()
    return !this.isMuted
  }

  // Effets spéciaux
  playEngineStart() {
    this.playSound('engine_start')
    setTimeout(() => {
      this.playSound('engine_idle')
    }, 500)
  }

  playAcceleration() {
    this.stopSound('engine_idle')
    this.playSound('engine_accelerate')
  }

  playGearShift() {
    this.playSound('gear_shift', { volume: 0.3 })
  }

  playCrash() {
    this.playSound('crash', { volume: 0.8 })
    this.stopSound('engine_idle')
    this.stopSound('engine_accelerate')
  }
}

export const audioManager = new AudioManager()
