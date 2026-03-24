import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  mirrored?: boolean;
  name?: string;
}

export function VideoPlayer({ stream, muted = false, className, mirrored = false, name }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // React doesn't reliably reflect the muted prop to the DOM — set it directly
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.play().catch(() => {
      // Autoplay was blocked — listen for a user gesture then retry
      const retry = () => {
        video.play().catch(() => {});
        document.removeEventListener("click", retry);
      };
      document.addEventListener("click", retry, { once: true });
    });
  }, [stream]);

  if (!stream) {
    return (
      <div className={cn("bg-secondary/50 flex flex-col items-center justify-center rounded-2xl overflow-hidden", className)}>
        <div className="bg-secondary p-6 rounded-full mb-4">
          <User className="w-12 h-12 text-muted-foreground" />
        </div>
        {name && <p className="text-muted-foreground font-medium">{name}</p>}
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-2xl overflow-hidden bg-black", className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={cn(
          "w-full h-full object-cover",
          mirrored && "-scale-x-100"
        )}
      />
      {name && (
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium">
          {name}
        </div>
      )}
    </div>
  );
}
