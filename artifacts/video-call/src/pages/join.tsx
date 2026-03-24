import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { Video, ArrowRight, Loader2, Lock } from "lucide-react";
import { useVerifyRoomPassword, useGetRoom } from "@workspace/api-client-react";

export function Join() {
  const params = useParams();
  const roomId = params.roomId || "";
  const [, setLocation] = useLocation();
  
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  
  const { data: room, isLoading: isLoadingRoom, isError: isRoomError } = useGetRoom(roomId);
  const verifyMutation = useVerifyRoomPassword();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) return;
    
    verifyMutation.mutate(
      { roomId, data: { password } },
      {
        onSuccess: (data) => {
          if (data.valid && data.token) {
            setLocation(`/call/${roomId}?token=${data.token}&name=${encodeURIComponent(name)}`);
          }
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
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
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-6 ring-1 ring-primary/20 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gradient">
            Join Meeting
          </h1>
          {isLoadingRoom ? (
             <p className="text-muted-foreground flex items-center justify-center gap-2">
               <Loader2 className="w-4 h-4 animate-spin" /> Locating room...
             </p>
          ) : isRoomError ? (
             <p className="text-destructive">This room does not exist or has expired.</p>
          ) : (
             <p className="text-muted-foreground">
               Hosted by <span className="font-medium text-foreground">{room?.hostName}</span>
             </p>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-panel p-8 rounded-3xl"
        >
          <form onSubmit={handleJoin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 ml-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we call you?"
                required
                disabled={isLoadingRoom || isRoomError}
                className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 ml-1">Room Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter the password"
                  required
                  disabled={isLoadingRoom || isRoomError}
                  className="w-full bg-secondary/50 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                />
              </div>
            </div>

            {verifyMutation.isError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                Incorrect password. Please try again.
              </div>
            )}

            <button
              type="submit"
              disabled={verifyMutation.isPending || !name.trim() || !password.trim() || isLoadingRoom || isRoomError}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {verifyMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Join Room <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
