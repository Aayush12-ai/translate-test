import { useEffect, useRef, useState, useCallback } from "react";
import { resolveApiWebSocketCandidates } from "@/lib/utils";

const SIGNALING_ACK_TIMEOUT_MS = 5_000;
const SIGNALING_RECONNECT_DELAY_MS = 1_500;
const ICE_DISCONNECT_GRACE_MS = 6_000;
const PEER_LEFT_GRACE_MS = 4_000;
const INTERNAL_RECONNECT_CLOSE_CODE = 4002;

interface WebRTCState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteParticipantName: string | null;
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

interface SignalingPeer {
  name?: string;
  isHost?: boolean;
}

interface SignalingMessage {
  type: string;
  candidate?: RTCIceCandidateInit;
  fromIsHost?: boolean;
  fromName?: string;
  isHost?: boolean;
  message?: string;
  name?: string;
  peers?: SignalingPeer[];
  sdp?: RTCSessionDescriptionInit;
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

function getParticipantName(message: SignalingMessage): string | null {
  const candidates = [message.fromName, message.name];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function getExistingPeerName(peers: SignalingPeer[] | undefined): string | null {
  if (!Array.isArray(peers)) {
    return null;
  }

  for (const peer of peers) {
    if (typeof peer?.name === "string" && peer.name.trim()) {
      return peer.name.trim();
    }
  }

  return null;
}

function isSelfPeerEvent(message: SignalingMessage, localName: string, localIsHost: boolean): boolean {
  const participantName = getParticipantName(message);
  if (!participantName) {
    return false;
  }

  return participantName === localName && message.isHost === localIsHost;
}

export function useWebRTC(
  roomId: string,
  token: string,
  name: string,
  attempt = 0,
) {
  const isHost = token === "host";
  const [connectionGeneration, setConnectionGeneration] = useState(0);

  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    remoteStream: null,
    remoteParticipantName: null,
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
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const preserveLocalStreamRef = useRef(false);
  const disconnectTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const peerLeftTimerRef = useRef<number | null>(null);

  const clearDisconnectTimer = useCallback(() => {
    if (disconnectTimerRef.current !== null) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearPeerLeftTimer = useCallback(() => {
    if (peerLeftTimerRef.current !== null) {
      window.clearTimeout(peerLeftTimerRef.current);
      peerLeftTimerRef.current = null;
    }
  }, []);

  const sendWs = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const requestConnectionReset = useCallback(() => {
    preserveLocalStreamRef.current = true;
    setConnectionGeneration((value) => value + 1);
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
    let isRestartingIce = false;
    const preservedLocalStream = preserveLocalStreamRef.current
      ? localStreamRef.current
      : null;
    preserveLocalStreamRef.current = false;

    const updateRemoteParticipantName = (nextName: string | null) => {
      if (!nextName) {
        return;
      }

      setState((s) =>
        s.remoteParticipantName === nextName
          ? s
          : { ...s, remoteParticipantName: nextName },
      );
    };

    const clearRemoteMediaState = (clearParticipantName = false) => {
      remoteStreamRef.current = null;
      if (!mounted) {
        return;
      }

      setState((s) => ({
        ...s,
        remoteStream: null,
        ...(clearParticipantName ? { remoteParticipantName: null } : {}),
        remoteIsScreenSharing: false,
        screenShareRequest: null,
      }));
    };

    const init = async () => {
      try {
        clearDisconnectTimer();
        clearReconnectTimer();
        clearPeerLeftTimer();
        remoteStreamRef.current = null;

        setState((s) => ({
          ...s,
          localStream: preservedLocalStream
            ? new MediaStream(preservedLocalStream.getVideoTracks())
            : null,
          remoteStream: null,
          remoteParticipantName: null,
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

        const scheduleDisconnectCleanup = () => {
          if (disconnectTimerRef.current !== null) {
            return;
          }

          disconnectTimerRef.current = window.setTimeout(() => {
            disconnectTimerRef.current = null;

            if (!mounted) {
              return;
            }

            if (
              pc.iceConnectionState === "disconnected" ||
              pc.iceConnectionState === "failed"
            ) {
              clearRemoteMediaState();
            }
          }, ICE_DISCONNECT_GRACE_MS);
        };

        const createAndSendOffer = async (ws: WebSocket, restartIce = false) => {
          if (pc.signalingState !== "stable") {
            try {
              await pc.setLocalDescription({ type: "rollback" });
            } catch {
              // Ignore rollback errors and fall back to the current signaling state check.
            }
          }

          if (pc.signalingState !== "stable") {
            return false;
          }

          const offer = await pc.createOffer(restartIce ? { iceRestart: true } : undefined);
          await pc.setLocalDescription(offer);

          if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "offer", sdp: pc.localDescription }));
            return true;
          }

          return false;
        };

        const attemptIceRestart = async () => {
          if (!isHost || isRestartingIce) {
            return;
          }

          const ws = wsRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
          }

          try {
            isRestartingIce = true;
            await createAndSendOffer(ws, true);
          } catch (err) {
            console.error("ICE restart failed", err);
          } finally {
            isRestartingIce = false;
          }
        };

        pc.ontrack = (event) => {
          const remoteStream = remoteStreamRef.current ?? new MediaStream();
          remoteStreamRef.current = remoteStream;

          if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
            remoteStream.addTrack(event.track);
          }

          event.track.onended = () => {
            const activeRemoteStream = remoteStreamRef.current;
            if (!activeRemoteStream) {
              return;
            }

            const trackToRemove = activeRemoteStream
              .getTracks()
              .find((track) => track.id === event.track.id);

            if (trackToRemove) {
              activeRemoteStream.removeTrack(trackToRemove);
            }

            if (activeRemoteStream.getTracks().length === 0) {
              clearRemoteMediaState();
              return;
            }

            setState((s) => ({ ...s, remoteStream: activeRemoteStream }));
          };

          clearDisconnectTimer();
          clearPeerLeftTimer();
          setState((s) => ({ ...s, remoteStream, error: null }));
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            clearDisconnectTimer();
            clearPeerLeftTimer();
            setState((s) => ({ ...s, isConnected: true, error: null }));
            return;
          }

          if (pc.iceConnectionState === "disconnected") {
            setState((s) => ({ ...s, isConnected: false }));
            scheduleDisconnectCleanup();
            return;
          }

          if (pc.iceConnectionState === "failed") {
            setState((s) => ({ ...s, isConnected: false }));
            scheduleDisconnectCleanup();
            void attemptIceRestart();
            return;
          }

          if (pc.iceConnectionState === "closed") {
            clearDisconnectTimer();
            clearRemoteMediaState();
            setState((s) => ({
              ...s,
              isConnected: false,
            }));
          }
        };

        let stream: MediaStream | null = preservedLocalStream;

        if (!stream && !navigator.mediaDevices?.getUserMedia) {
          setState((s) => ({
            ...s,
            mediaError:
              "Camera and microphone require localhost or HTTPS in this browser.",
          }));
        } else if (!stream) {
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
            pc.addTrack(track, stream);
          });
        } else {
          pc.addTransceiver("video", { direction: "sendrecv" });
          pc.addTransceiver("audio", { direction: "sendrecv" });
        }

        const socketCandidates = await resolveApiWebSocketCandidates("/ws");

        if (!mounted) {
          return;
        }

        const connectSocket = (candidateIndex = 0) => {
          const socketUrl = socketCandidates[candidateIndex];

          if (!socketUrl) {
            setState((s) => ({
              ...s,
              error: "Could not join the call room. Check that both servers are running.",
            }));
            return;
          }

          let opened = false;
          let joined = false;
          const ws = new WebSocket(socketUrl);
          wsRef.current = ws;

          const scheduleReconnect = () => {
            if (!mounted || reconnectTimerRef.current !== null) {
              return;
            }

            reconnectTimerRef.current = window.setTimeout(() => {
              reconnectTimerRef.current = null;
              connectSocket(0);
            }, SIGNALING_RECONNECT_DELAY_MS);
          };

          const ackTimer = window.setTimeout(() => {
            if (!joined && ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          }, SIGNALING_ACK_TIMEOUT_MS);

          pc.onicecandidate = (event) => {
            if (event.candidate && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({ type: "ice-candidate", candidate: event.candidate }),
              );
            }
          };

          ws.onopen = () => {
            if (!mounted || wsRef.current !== ws) {
              ws.close();
              return;
            }

            opened = true;
            clearReconnectTimer();
            ws.send(JSON.stringify({ type: "join", roomId, name, token }));
          };

          ws.onmessage = async (event) => {
            if (!mounted || wsRef.current !== ws) {
              return;
            }

            try {
              const msg = JSON.parse(event.data) as SignalingMessage;
              updateRemoteParticipantName(getParticipantName(msg));

              switch (msg.type) {
                case "joined": {
                  joined = true;
                  window.clearTimeout(ackTimer);
                  clearPeerLeftTimer();
                  updateRemoteParticipantName(getExistingPeerName(msg.peers));
                  setState((s) => ({ ...s, error: null }));
                  break;
                }

                case "peer-joined": {
                if (isSelfPeerEvent(msg, name, isHost)) {
                  break;
                }

                clearPeerLeftTimer();

                if (
                  pc.connectionState !== "new" ||
                  pc.iceConnectionState !== "new" ||
                  remoteStreamRef.current
                ) {
                  requestConnectionReset();
                  break;
                }

                clearRemoteMediaState();
                setState((s) => ({ ...s, isConnected: false }));
                await createAndSendOffer(ws, pc.connectionState !== "new");
                  break;
                }

                case "offer": {
                  clearPeerLeftTimer();

                  if (!msg.sdp) {
                    break;
                  }

                  if (pc.signalingState !== "stable") {
                    try {
                      await pc.setLocalDescription({ type: "rollback" });
                    } catch {
                      // Ignore rollback errors and try to recover with the new offer.
                    }
                  }

                  await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);

                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "answer", sdp: pc.localDescription }));
                  }
                  break;
                }

                case "answer": {
                  clearPeerLeftTimer();

                  if (!msg.sdp) {
                    break;
                  }

                  if (pc.signalingState !== "have-local-offer") {
                    break;
                  }

                  await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                  break;
                }

                case "ice-candidate": {
                  clearPeerLeftTimer();

                  if (msg.candidate) {
                    try {
                      await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                    } catch (err) {
                      console.error("Failed to add ICE candidate", err);
                    }
                  }
                  break;
                }

                case "peer-left": {
                  if (isSelfPeerEvent(msg, name, isHost)) {
                    break;
                  }

                  clearPeerLeftTimer();
                  peerLeftTimerRef.current = window.setTimeout(() => {
                    peerLeftTimerRef.current = null;

                    if (!mounted) {
                      return;
                    }

                    const connectionStillActive =
                      pc.connectionState === "connected" ||
                      pc.iceConnectionState === "connected" ||
                      pc.iceConnectionState === "completed" ||
                      pc.getReceivers().some((receiver) => receiver.track?.readyState === "live");

                    if (connectionStillActive) {
                      return;
                    }

                    clearRemoteMediaState(true);
                    setState((s) => ({
                      ...s,
                      isConnected: false,
                    }));
                  }, PEER_LEFT_GRACE_MS);
                  break;
                }

                case "screen-share-request": {
                  if (isHost) {
                    setState((s) => ({
                      ...s,
                      screenShareRequest: {
                        name: getParticipantName(msg) ?? "Guest",
                      },
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
                    if (!mounted) {
                      return;
                    }

                    setState((s) => ({ ...s, screenShareDenied: false }));
                  }, 3_000);
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
            if (wsRef.current !== ws) {
              return;
            }

            if (!opened || !joined) {
              return;
            }

            scheduleReconnect();
          };

          ws.onclose = () => {
            window.clearTimeout(ackTimer);

            if (!mounted || wsRef.current !== ws) {
              return;
            }

            wsRef.current = null;

            if (!opened || !joined) {
              connectSocket(candidateIndex + 1);
              return;
            }

            scheduleReconnect();
          };
        };

        connectSocket();
      } catch (err: unknown) {
        console.error("Media/WebRTC init error:", err);
        if (mounted) {
          setState((s) => ({
            ...s,
            error:
              err instanceof Error
                ? err.message
                : "Failed to initialize call connection",
          }));
        }
      }
    };

    void init();

    return () => {
      mounted = false;
      clearDisconnectTimer();
      clearReconnectTimer();
      clearPeerLeftTimer();

      if (localStreamRef.current && !preserveLocalStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }

      remoteStreamRef.current = null;

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      if (wsRef.current) {
        if (
          preserveLocalStreamRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          wsRef.current.close(INTERNAL_RECONNECT_CLOSE_CODE, "Internal reconnect");
        } else {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [
    roomId,
    token,
    name,
    attempt,
    connectionGeneration,
    isHost,
    beginScreenShare,
    clearDisconnectTimer,
    clearPeerLeftTimer,
    clearReconnectTimer,
    requestConnectionReset,
  ]);

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
