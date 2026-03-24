import { useEffect, useRef, useState, useCallback } from "react";

interface WebRTCState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;
  mediaError: string | null;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  remoteIsScreenSharing: boolean;
  screenShareRequest: { name: string } | null;
  screenShareRequestPending: boolean;
  screenShareDenied: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function getMediaErrorMessage(err: unknown): string {
  const name =
    typeof err === "object" && err && "name" in err
      ? String((err as { name?: unknown }).name)
      : "";
  const message =
    typeof err === "object" && err && "message" in err
      ? String((err as { message?: unknown }).message)
      : "";

  if (name === "NotAllowedError" || message === "Permission denied") {
    return "Camera or microphone permission was blocked. You can still join, then retry after allowing access.";
  }

  if (name === "NotReadableError") {
    return "Camera or microphone is already being used by another app. You can still join without local media.";
  }

  return "Could not access camera/microphone. You can still join without local media.";
}

function getSenderByKind(
  pc: RTCPeerConnection,
  kind: "audio" | "video",
): RTCRtpSender | null {
  const transceiver = pc
    .getTransceivers()
    .find(
      (item) =>
        item.sender.track?.kind === kind || item.receiver.track.kind === kind,
    );

  return transceiver?.sender ?? null;
}

export function useWebRTC(
  roomId: string,
  token: string,
  name: string,
  attempt = 0,
) {
  const isHost = token === "host";

  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    remoteStream: null,
    error: null,
    mediaError: null,
    isConnected: false,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    remoteIsScreenSharing: false,
    screenShareRequest: null,
    screenShareRequestPending: false,
    screenShareDenied: false,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const sendWs = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const stopScreenShareInternal = useCallback(
    async (notify = true) => {
      const pc = pcRef.current;
      const cameraStream = localStreamRef.current;
      const screenStream = screenStreamRef.current;

      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }

      if (pc) {
        const videoSender = getSenderByKind(pc, "video");
        if (videoSender) {
          await videoSender.replaceTrack(cameraStream?.getVideoTracks()[0] ?? null);
        }
      }

      setState((s) => ({
        ...s,
        isScreenSharing: false,
        localStream: cameraStream
          ? new MediaStream(cameraStream.getVideoTracks())
          : null,
      }));

      if (notify) {
        sendWs({ type: "screen-share-stop" });
      }
    },
    [sendWs],
  );

  const beginScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setState((s) => ({
        ...s,
        mediaError: "Screen sharing is not supported in this browser.",
        screenShareRequestPending: false,
      }));
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const pc = pcRef.current;
      const screenTrack = screenStream.getVideoTracks()[0];

      if (!pc || !screenTrack) {
        screenStream.getTracks().forEach((track) => track.stop());
        return;
      }

      screenStreamRef.current = screenStream;

      const videoSender = getSenderByKind(pc, "video");
      if (!videoSender) {
        screenStream.getTracks().forEach((track) => track.stop());
        setState((s) => ({
          ...s,
          mediaError: "Screen share could not start because the video sender is unavailable.",
          screenShareRequestPending: false,
        }));
        return;
      }

      await videoSender.replaceTrack(screenTrack);

      setState((s) => ({
        ...s,
        isScreenSharing: true,
        localStream: new MediaStream([screenTrack]),
        mediaError: null,
        screenShareRequestPending: false,
        screenShareDenied: false,
      }));

      sendWs({ type: "screen-share-started" });

      screenTrack.onended = () => {
        void stopScreenShareInternal(true);
      };
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "name" in err
          ? String((err as { name?: unknown }).name)
          : "";

      if (message !== "NotAllowedError") {
        setState((s) => ({
          ...s,
          mediaError: "Screen share could not start.",
          screenShareRequestPending: false,
        }));
      } else {
        setState((s) => ({
          ...s,
          screenShareRequestPending: false,
        }));
      }
    }
  }, [sendWs, stopScreenShareInternal]);

  useEffect(() => {
    if (!roomId || !token || !name) {
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        setState((s) => ({
          ...s,
          localStream: null,
          remoteStream: null,
          error: null,
          mediaError: null,
          isConnected: false,
          isScreenSharing: false,
          remoteIsScreenSharing: false,
          screenShareRequest: null,
          screenShareRequestPending: false,
          screenShareDenied: false,
        }));

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setState((s) => ({ ...s, remoteStream: event.streams[0] }));
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === "connected") {
            setState((s) => ({ ...s, isConnected: true }));
          } else if (
            pc.iceConnectionState === "disconnected" ||
            pc.iceConnectionState === "failed"
          ) {
            setState((s) => ({
              ...s,
              isConnected: false,
              remoteStream: null,
            }));
          }
        };

        let stream: MediaStream | null = null;

        if (!navigator.mediaDevices?.getUserMedia) {
          setState((s) => ({
            ...s,
            mediaError:
              "Camera and microphone require localhost or HTTPS in this browser.",
          }));
        } else {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user",
              },
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
          } catch (mediaErr) {
            setState((s) => ({
              ...s,
              mediaError: getMediaErrorMessage(mediaErr),
            }));
          }
        }

        if (!mounted) {
          stream?.getTracks().forEach((track) => track.stop());
          return;
        }

        if (stream) {
          localStreamRef.current = stream;
          setState((s) => ({
            ...s,
            localStream: new MediaStream(stream.getVideoTracks()),
            mediaError: null,
          }));

          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream!);
          });
        } else {
          pc.addTransceiver("video", { direction: "sendrecv" });
          pc.addTransceiver("audio", { direction: "sendrecv" });
        }

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        pc.onicecandidate = (event) => {
          if (event.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({ type: "ice-candidate", candidate: event.candidate }),
            );
          }
        };

        ws.onopen = () => {
          if (!mounted) return;
          ws.send(JSON.stringify({ type: "join", roomId, name, token }));
        };

        ws.onmessage = async (event) => {
          if (!mounted) return;

          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case "peer-joined": {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                ws.send(JSON.stringify({ type: "offer", sdp: pc.localDescription }));
                break;
              }

              case "offer": {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: "answer", sdp: pc.localDescription }));
                break;
              }

              case "answer": {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                break;
              }

              case "ice-candidate": {
                if (msg.candidate) {
                  await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
                break;
              }

              case "peer-left": {
                setState((s) => ({
                  ...s,
                  isConnected: false,
                  remoteStream: null,
                  remoteIsScreenSharing: false,
                  screenShareRequest: null,
                }));
                break;
              }

              case "screen-share-request": {
                if (isHost) {
                  setState((s) => ({
                    ...s,
                    screenShareRequest: { name: msg.name || "Guest" },
                  }));
                }
                break;
              }

              case "screen-share-approved": {
                setState((s) => ({
                  ...s,
                  screenShareRequestPending: false,
                  screenShareDenied: false,
                }));
                await beginScreenShare();
                break;
              }

              case "screen-share-denied": {
                setState((s) => ({
                  ...s,
                  screenShareRequestPending: false,
                  screenShareDenied: true,
                }));

                window.setTimeout(() => {
                  if (!mounted) return;
                  setState((s) => ({ ...s, screenShareDenied: false }));
                }, 3000);
                break;
              }

              case "screen-share-started": {
                setState((s) => ({ ...s, remoteIsScreenSharing: true }));
                break;
              }

              case "screen-share-stop": {
                setState((s) => ({ ...s, remoteIsScreenSharing: false }));
                break;
              }

              case "error": {
                setState((s) => ({ ...s, error: msg.message || "Signaling error" }));
                break;
              }
            }
          } catch (err) {
            console.error("Error processing signaling message", err);
          }
        };

        ws.onerror = () => {
          setState((s) => ({
            ...s,
            error: "Connection lost to signaling server",
          }));
        };

        ws.onclose = () => {
          if (!mounted) return;

          setState((s) => {
            if (s.isConnected) {
              return { ...s, isConnected: false, remoteStream: null };
            }

            return {
              ...s,
              error:
                s.error ??
                "Could not join the call room. Check that both servers are running.",
            };
          });
        };
      } catch (err: any) {
        console.error("Media/WebRTC init error:", err);
        if (mounted) {
          setState((s) => ({
            ...s,
            error: err?.message || "Failed to initialize call connection",
          }));
        }
      }
    };

    init();

    return () => {
      mounted = false;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (pcRef.current) {
        pcRef.current.close();
      }

      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, token, name, attempt, isHost, beginScreenShare]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const enabled = !audioTracks[0].enabled;
        audioTracks[0].enabled = enabled;
        setState((s) => ({ ...s, isMuted: !enabled }));
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const enabled = !videoTracks[0].enabled;
        videoTracks[0].enabled = enabled;
        setState((s) => ({ ...s, isVideoOff: !enabled }));
      }
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    if (isHost) {
      await beginScreenShare();
      return;
    }

    setState((s) => ({
      ...s,
      screenShareRequestPending: true,
      screenShareDenied: false,
    }));
    sendWs({ type: "screen-share-request", name });
  }, [beginScreenShare, isHost, name, sendWs]);

  const stopScreenShare = useCallback(() => {
    void stopScreenShareInternal(true);
  }, [stopScreenShareInternal]);

  const approveScreenShare = useCallback(() => {
    setState((s) => ({ ...s, screenShareRequest: null }));
    sendWs({ type: "screen-share-approved" });
  }, [sendWs]);

  const denyScreenShare = useCallback(() => {
    setState((s) => ({ ...s, screenShareRequest: null }));
    sendWs({ type: "screen-share-denied" });
  }, [sendWs]);

  return {
    ...state,
    isHost,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    approveScreenShare,
    denyScreenShare,
  };
}
