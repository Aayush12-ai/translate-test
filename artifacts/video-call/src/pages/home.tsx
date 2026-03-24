import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Video, Copy, Check, ArrowRight, Loader2 } from "lucide-react";
import { useCreateRoom } from "@workspace/api-client-react";

export function Home() {
  const [hostName, setHostName] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  
  const createRoom = useCreateRoom();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) return;
    createRoom.mutate({ data: { hostName } });
  };

  const room = createRoom.data;
  const joinLink = room ? `${window.location.origin}/join/${room.id}` : "";

  const copyToClipboard = async (text: string, type: 'link' | 'pass') => {
    await navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/dark-mesh-bg.png`} 
          alt="Abstract Background" 
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
      </div>

      <main className="z-10 w-full max-w-md px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-6 ring-1 ring-primary/20 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
            Connect Instantly
          </h1>
          <p className="text-muted-foreground text-lg">
            Create secure, high-quality video calls directly from your browser.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-panel p-8 rounded-3xl"
        >
          {!room ? (
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 ml-1">Your Name</label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  required
                  className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              {createRoom.isError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                  Failed to create room. Please try again.
                </div>
              )}

              <button
                type="submit"
                disabled={createRoom.isPending || !hostName.trim()}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createRoom.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Create Room <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 text-green-400 mb-2">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold">Room Created!</h3>
                <p className="text-sm text-muted-foreground">Share these details with your guest.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Shareable Link</label>
                  <div className="flex gap-2">
                    <input 
                      readOnly 
                      value={joinLink}
                      className="flex-1 bg-secondary/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground truncate focus:outline-none"
                    />
                    <button 
                      onClick={() => copyToClipboard(joinLink, 'link')}
                      className="shrink-0 flex items-center justify-center w-12 bg-secondary border border-white/10 hover:bg-secondary/80 rounded-xl transition-colors"
                      title="Copy Link"
                    >
                      {copiedLink ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Room Password</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-secondary/50 border border-white/10 rounded-xl px-4 py-3 text-lg font-mono font-bold text-center tracking-widest text-primary">
                      {room?.password || "ERROR-NO-PASS"}
                    </div>
                    <button 
                      onClick={() => copyToClipboard(room?.password, 'pass')}
                      className="shrink-0 flex items-center justify-center w-12 bg-secondary border border-white/10 hover:bg-secondary/80 rounded-xl transition-colors"
                      title="Copy Password"
                    >
                      {copiedPass ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link 
                  href={`/call/${room.id}?token=host&name=${encodeURIComponent(hostName)}`}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-white/90 font-semibold py-3.5 rounded-xl transition-all shadow-lg"
                >
                  Join Call Now
                </Link>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
