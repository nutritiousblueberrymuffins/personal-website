// Hero music player. Tracks come from src/data/tracks.json and the audio files live in
// public/music/. Playback only ever starts from a click, which is what browsers require.
import tracks from '../data/tracks.json';

const player = document.querySelector('.music-player');

if (player) {
  const el = {
    status: player.querySelector('#track-status'),
    name: player.querySelector('#track-name'),
    artist: player.querySelector('#track-artist'),
    credit: player.querySelector('#track-credit'),
    progress: player.querySelector('#progress'),
    current: player.querySelector('#current-time'),
    duration: player.querySelector('#duration'),
    prev: player.querySelector('#prev-track'),
    toggle: player.querySelector('#play-pause'),
    toggleIcon: player.querySelector('#play-pause img'),
    next: player.querySelector('#next-track'),
  };

  if (tracks.length === 0) {
    el.status.textContent = 'NO TRACKS YET';
    el.name.textContent = 'Nothing to play';
    for (const button of [el.prev, el.toggle, el.next]) {
      button.disabled = true;
    }
    el.progress.disabled = true;
  } else {
    init();
  }

  function init() {
    const BASE = import.meta.env.BASE_URL;
    const icons = {
      play: `${BASE}assets/hero/svg-previews/play.svg`,
      pause: `${BASE}assets/hero/svg-previews/pause.svg`,
    };
    const audio = new Audio();
    audio.preload = 'metadata';

    // Start on a random track, like the original player did.
    let index = Math.floor(Math.random() * tracks.length);
    let seeking = false;

    function format(seconds) {
      if (!Number.isFinite(seconds)) {
        return '0:00';
      }
      const minutes = Math.floor(seconds / 60);
      const rest = Math.floor(seconds % 60);
      return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    function link(text, href) {
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.textContent = text;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      return anchor;
    }

    function setPlaying(playing) {
      player.classList.toggle('is-playing', playing);
      el.status.textContent = playing ? 'NOW PLAYING' : 'PAUSED';
      el.toggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      el.toggle.setAttribute('aria-pressed', String(playing));
      el.toggleIcon.src = playing ? icons.pause : icons.play;
    }

    function render() {
      if (!seeking && audio.duration) {
        el.progress.value = (audio.currentTime / audio.duration) * 100;
      }
      el.current.textContent = format(audio.currentTime);
      el.progress.setAttribute('aria-valuetext', `${format(audio.currentTime)} of ${format(audio.duration)}`);
    }

    function play() {
      audio.play().catch((error) => {
        console.warn('Playback was blocked or failed.', error);
        setPlaying(false);
      });
    }

    function updateMediaSession(track) {
      if (!('mediaSession' in navigator)) {
        return;
      }
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist });
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => load(index - 1, { autoplay: true }));
      navigator.mediaSession.setActionHandler('nexttrack', () => load(index + 1, { autoplay: true }));
    }

    function load(i, { autoplay = false } = {}) {
      index = (i + tracks.length) % tracks.length;
      const track = tracks[index];
      audio.src = `${BASE}music/${track.file}`;
      el.name.textContent = track.title;
      el.artist.textContent = track.artist;
      el.credit.replaceChildren(
        'Music by ',
        link(track.artist, track.artistUrl),
        ', licensed ',
        link(track.license, track.licenseUrl),
        '.',
      );
      el.progress.value = 0;
      el.current.textContent = '0:00';
      el.duration.textContent = '0:00';
      updateMediaSession(track);
      if (autoplay) {
        play();
      }
    }

    el.toggle.addEventListener('click', () => (audio.paused ? play() : audio.pause()));
    el.prev.addEventListener('click', () => load(index - 1, { autoplay: !audio.paused }));
    el.next.addEventListener('click', () => load(index + 1, { autoplay: !audio.paused }));

    // While the slider is being dragged, show the target time but do not fight the drag.
    el.progress.addEventListener('input', () => {
      seeking = true;
      if (audio.duration) {
        el.current.textContent = format((el.progress.value / 100) * audio.duration);
      }
    });
    el.progress.addEventListener('change', () => {
      if (audio.duration) {
        audio.currentTime = (el.progress.value / 100) * audio.duration;
      }
      seeking = false;
    });

    audio.addEventListener('play', () => setPlaying(true));
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('timeupdate', render);
    audio.addEventListener('loadedmetadata', () => {
      el.duration.textContent = format(audio.duration);
      render();
    });
    audio.addEventListener('ended', () => load(index + 1, { autoplay: true }));
    audio.addEventListener('error', () => {
      setPlaying(false);
      el.status.textContent = 'TRACK UNAVAILABLE';
    });

    load(index);
    setPlaying(false);
  }
}
