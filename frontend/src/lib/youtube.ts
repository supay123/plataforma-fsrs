// API del reproductor de YouTube (https://developers.google.com/youtube/iframe_api_reference).
// Solo se tipa lo que usa la aplicación.

export interface YouTubePlayer {
  playVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getPlayerState(): number;
  destroy(): void;
}

export interface YouTubePlayerEvent { target: YouTubePlayer; data: number }

export interface YouTubePlayerOptions {
  videoId: string;
  host?: string;
  width?: string;
  height?: string;
  playerVars?: Record<string, string | number>;
  events?: Partial<Record<"onReady" | "onStateChange" | "onAutoplayBlocked", (event: YouTubePlayerEvent) => void>>;
}

export interface YouTubeApi {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
  PlayerState: { PLAYING: number; BUFFERING: number };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YouTubeApi> | null = null;

/** Carga la API una sola vez. Falla si el script no llega (sin red o bloqueado). */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("youtube_api_unavailable"));
    };
    document.head.append(script);
  });
  return loading;
}
