import coreUrl from "@ffmpeg/core?url";
import wasmUrl from "@ffmpeg/core/wasm?url";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export type VideoCompressionProfile = "standard" | "compact";

export interface VideoCompressionProgress {
  phase: "preparing" | "compressing" | "verifying";
  progress: number;
}

export interface VideoCompressionOptions {
  maxBytes: number;
  profile: VideoCompressionProfile;
  signal?: AbortSignal;
  onProgress?: (update: VideoCompressionProgress) => void;
}

export class VideoCompressionError extends Error {
  constructor(message: string, public readonly code: "cancelled" | "unsupported" | "failed") {
    super(message);
    this.name = "VideoCompressionError";
  }
}

const PROFILE_SETTINGS: Record<VideoCompressionProfile, { maxHeight: number; audioBitrateKbps: number; targetRatio: number }> = {
  standard: { maxHeight: 720, audioBitrateKbps: 96, targetRatio: 0.9 },
  compact: { maxHeight: 480, audioBitrateKbps: 80, targetRatio: 0.8 },
};

function safeBaseName(name: string) {
  const base = name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "video";
}

function extensionFor(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : "mp4";
}

async function readDurationSeconds(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const video = document.createElement("video");
      const finish = (duration: number | null) => {
        video.removeAttribute("src");
        video.load();
        resolve(duration && Number.isFinite(duration) && duration > 0 ? duration : null);
      };
      video.preload = "metadata";
      video.onloadedmetadata = () => finish(video.duration);
      video.onerror = () => finish(null);
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function videoBitrateKbps(maxBytes: number, durationSeconds: number | null, audioBitrateKbps: number, targetRatio: number) {
  if (!durationSeconds) return 1_200;
  const budgetBits = maxBytes * 8 * targetRatio;
  const videoBitsPerSecond = budgetBits / durationSeconds - audioBitrateKbps * 1_000 - 48_000;
  return Math.round(Math.min(2_500, Math.max(350, videoBitsPerSecond / 1_000)));
}

/**
 * Returns a conservative estimate for the selected profile. The actual output
 * remains the source of truth because codecs and input complexity vary.
 */
export async function estimateCompressedVideoBytes(
  file: File,
  maxBytes: number,
  profileName: VideoCompressionProfile,
): Promise<number | null> {
  const durationSeconds = await readDurationSeconds(file);
  if (!durationSeconds) return null;

  const profile = PROFILE_SETTINGS[profileName];
  const bitrateKbps = videoBitrateKbps(maxBytes, durationSeconds, profile.audioBitrateKbps, profile.targetRatio);
  const encodedBytes = ((bitrateKbps + profile.audioBitrateKbps) * 1_000 * durationSeconds) / 8;
  const containerOverheadBytes = Math.max(128_000, encodedBytes * 0.015);

  return Math.round(Math.min(maxBytes * profile.targetRatio, encodedBytes + containerOverheadBytes));
}

export async function compressVideo(file: File, options: VideoCompressionOptions): Promise<File> {
  if (!file.type.startsWith("video/")) {
    throw new VideoCompressionError("Le fichier sélectionné n’est pas une vidéo.", "unsupported");
  }

  const ffmpeg = new FFmpeg();
  const inputName = `input.${extensionFor(file)}`;
  const outputName = `${safeBaseName(file.name)}-ecodis.mp4`;
  const profile = PROFILE_SETTINGS[options.profile];
  const durationSeconds = await readDurationSeconds(file);
  const bitrateKbps = videoBitrateKbps(options.maxBytes, durationSeconds, profile.audioBitrateKbps, profile.targetRatio);
  const report = (phase: VideoCompressionProgress["phase"], progress: number) => options.onProgress?.({ phase, progress: Math.max(0, Math.min(1, progress)) });

  const progressListener = ({ progress }: { progress: number }) => report("compressing", progress);
  ffmpeg.on("progress", progressListener);

  try {
    if (options.signal?.aborted) throw new DOMException("Compression annulée", "AbortError");
    report("preparing", 0);
    // Vite resolves FFmpeg's module worker from the package entry point.
    await ffmpeg.load({ coreURL: coreUrl, wasmURL: wasmUrl }, { signal: options.signal });
    await ffmpeg.writeFile(inputName, await fetchFile(file), { signal: options.signal });
    report("compressing", 0);

    const exitCode = await ffmpeg.exec([
      "-i", inputName,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-vf", `scale=-2:${profile.maxHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-b:v", `${bitrateKbps}k`,
      "-maxrate", `${Math.round(bitrateKbps * 1.15)}k`,
      "-bufsize", `${Math.round(bitrateKbps * 2)}k`,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", `${profile.audioBitrateKbps}k`,
      "-movflags", "+faststart",
      outputName,
    ], -1, { signal: options.signal });
    if (exitCode !== 0) throw new VideoCompressionError("La vidéo n’a pas pu être compressée sur cet appareil.", "failed");

    report("verifying", 1);
    const output = await ffmpeg.readFile(outputName, "binary", { signal: options.signal });
    if (!(output instanceof Uint8Array) || output.byteLength === 0) {
      throw new VideoCompressionError("Le fichier compressé est vide.", "failed");
    }
    return new File([output], outputName, { type: "video/mp4", lastModified: Date.now() });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new VideoCompressionError("Compression annulée.", "cancelled");
    }
    if (error instanceof VideoCompressionError) throw error;
    throw new VideoCompressionError("La vidéo n’a pas pu être compressée sur cet appareil.", "failed");
  } finally {
    ffmpeg.off("progress", progressListener);
    ffmpeg.terminate();
  }
}
