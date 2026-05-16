import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle, Clock, Loader2, Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateRoom } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Appointment = {
  id: string;
  title: string;
  date: Date;
  time: string;
  participants: number;
  status: "upcoming" | "completed" | "cancelled";
};

const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: "1",
    title: "Account Opening Consultation",
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    time: "10:30 AM",
    participants: 2,
    status: "upcoming" as const,
  },
  {
    id: "2",
    title: "Loan Discussion",
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    time: "2:00 PM",
    participants: 1,
    status: "upcoming" as const,
  },
  {
    id: "3",
    title: "Fixed Deposit Review",
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    time: "11:00 AM",
    participants: 2,
    status: "completed" as const,
  },
];

const TIME_SLOTS = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"
];

export function Schedule() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createRoom = useCreateRoom();

  const upcomingAppointments = MOCK_APPOINTMENTS.filter(a => a.status === "upcoming");
  const pastAppointments = MOCK_APPOINTMENTS.filter(a => a.status !== "upcoming");

  const handleBook = async () => {
    if (!name.trim() || !date || !time) return;

    setIsSubmitting(true);
    try {
      await createRoom.mutateAsync({ data: { hostName: `${name} - Video Call` } });
      toast({
        title: "Appointment Booked!",
        description: `Room created for ${format(date, "PPP")} at ${time}. Share the link with participants.`,
      });
      setName("");
      setTime("");
      setDate(new Date());
    } catch {
      toast({
        title: "Booking Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBadges = {
    upcoming: <Badge className="bg-green-100 text-green-800 border-green-200">Upcoming</Badge>,
    completed: <Badge className="bg-blue-100 text-blue-800 border-blue-200">Completed</Badge>,
    cancelled: <Badge variant="destructive">Cancelled</Badge>,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 py-12">
      <div className="max-w-6xl mx-auto px-4 space-y-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex items-center gap-3 rounded-full bg-primary/10 text-primary px-5 py-2 mb-6 mx-auto w-fit">
            <CalendarDays className="h-5 w-5" />
            <span>Video Appointment Scheduling</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-black bg-gradient-to-r from-primary via-union-gold to-primary bg-clip-text text-transparent mb-6">
            Schedule Video Call
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Book secure video appointments with bank advisors. Choose date, time, and get instant room link.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Booking Form */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 lg:max-w-md">
            <Card className="border-0 shadow-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/20 rounded-2xl">
                    <CalendarDays className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">New Appointment</CardTitle>
                    <CardDescription>Create video room instantly</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label>Your Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <div className="border rounded-2xl p-1 bg-card">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className="rounded-xl"
                        fromDate={new Date()}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Select value={time} onValueChange={setTime}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Select time slot" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {TIME_SLOTS.map(slot => (
                          <SelectItem key={slot} value={slot} className="rounded-xl">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {slot}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleBook} className="w-full h-14 text-lg shadow-2xl" disabled={isSubmitting || !name || !date || !time}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    <>
                      <Video className="mr-2 h-5 w-5" />
                      Book Appointment
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Appointments Tabs */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Tabs value={activeTab} onValueChange={(value: "upcoming" | "past") => setActiveTab(value)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-card/80 backdrop-blur-sm rounded-3xl p-1 mb-8 shadow-lg">
                <TabsTrigger value="upcoming" className="rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
                  <CalendarDays className="mr-2 h-5 w-5" />
                  Upcoming
                </TabsTrigger>
                <TabsTrigger value="past" className="rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Past
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  Upcoming Appointments ({upcomingAppointments.length})
                </h3>
                {upcomingAppointments.length === 0 ? (
                  <Card className="border-2 border-dashed border-muted">
                    <CardContent className="p-12 text-center">
                      <CalendarDays className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No upcoming appointments</h3>
                      <p className="text-muted-foreground mb-6">Book your first video call above</p>
                      <Button size="lg">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Book Now
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {upcomingAppointments.map((appointment) => (
                      <Card key={appointment.id} className="hover:shadow-xl transition-shadow">
                        <CardContent className="p-8">
                          <div className="flex items-start justify-between mb-6">
                            <div>
                              <h4 className="text-xl font-bold">{appointment.title}</h4>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <CalendarDays className="h-4 w-4" />
                                  {format(appointment.date, "PPP")}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {appointment.time}
                                </div>
                              </div>
                            </div>
                            {statusBadges[appointment.status]}
                          </div>
                          <div className="flex items-center gap-3 pt-4 border-t">
                            <Button variant="outline" size="sm">
                              Join Call
                            </Button>
                            <Button variant="ghost" size="sm">
                              Reschedule
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="past">
                <h3 className="text-2xl font-bold flex items-center gap-3 mb-8">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  Past Appointments ({pastAppointments.length})
                </h3>
                {pastAppointments.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <CheckCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No past appointments</h3>
                      <p className="text-muted-foreground">Book your first appointment to see history here</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {pastAppointments.map((appointment) => (
                      <Card key={appointment.id}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{appointment.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {format(appointment.date, "PPP")} at {appointment.time}
                              </p>
                            </div>
                            {statusBadges[appointment.status]}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
