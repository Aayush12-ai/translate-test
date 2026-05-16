import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle,
  Headphones,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { ImageInsightPanel } from "@/components/image-insight-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "../stores/authStore";

interface MeetingRequest {
  _id: string;
  topic: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  scheduledAt?: string;
  meetingLink?: string;
  hostMeetingLink?: string;
  rejectionReason?: string;
  createdAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || "/api";

export function UserDashboardPage() {
  const [, navigate] = useLocation();
  const { user, token, logout } = useAuthStore();
  const { toast } = useToast();

  const [requests, setRequests] = useState<MeetingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("meetings");
  const [formData, setFormData] = useState({ topic: "", description: "" });

  const requestStats = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === "pending").length,
      approved: requests.filter((request) => request.status === "approved").length,
      rejected: requests.filter((request) => request.status === "rejected").length,
    }),
    [requests],
  );

  const fetchMeetingRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/meetings/my-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch requests");
      }

      const data = await response.json();
      setRequests(data.requests);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void fetchMeetingRequests();
    }
  }, [token]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/meetings/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit request");
      }

      toast({
        title: "Success",
        description: "Meeting request submitted successfully",
      });

      setFormData({ topic: "", description: "" });
      setShowForm(false);
      void fetchMeetingRequests();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: MeetingRequest["status"]) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-blue-700" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
    }
  };

  const getStatusClassName = (status: MeetingRequest["status"]) => {
    switch (status) {
      case "approved":
        return "border-blue-200 bg-blue-50";
      case "rejected":
        return "border-red-200 bg-red-50";
      default:
        return "border-amber-200 bg-amber-50";
    }
  };

  const openRequestForm = () => {
    setActiveTab("meetings");
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_48%,#fff7f7_100%)] text-slate-950">
      <header className="border-b border-blue-100 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/images/union-bank-logo.svg"
              alt="Union Bank"
              className="h-12 w-auto"
            />
            <div>
              <p className="text-sm font-semibold text-blue-700">
                Union Assist Workspace
              </p>
              <h1 className="text-2xl font-bold text-slate-950">
                Welcome, {user?.name || "User"}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="border-blue-200 text-blue-800 hover:bg-blue-50"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white/85 p-6 shadow-[0_24px_70px_rgba(30,64,175,0.12)] backdrop-blur-xl">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-4">
              <Badge className="w-fit border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50">
                Smart customer assistance
              </Badge>
              <h2 className="bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_52%,#b91c1c_100%)] bg-clip-text text-4xl font-black text-transparent lg:text-5xl">
                Your meetings, complaints, and AI support in one place.
              </h2>
              <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
                Request support from an admin, ask the AI assistant about an
                uploaded image, or review key services without leaving your
                dashboard. Video links appear only after an admin schedules
                your request.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <SummaryTile label="Pending" value={requestStats.pending} tone="amber" />
              <SummaryTile label="Approved" value={requestStats.approved} tone="green" />
              <SummaryTile label="Rejected" value={requestStats.rejected} tone="red" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <QuickActionCard
            icon={CalendarDays}
            title="Request meeting"
            description="Send a meeting request to admin for approval."
            onClick={openRequestForm}
          />
          <QuickActionCard
            icon={Bot}
            title="Complaint assistant"
            description="Upload a document/image or type your query."
            onClick={() => setActiveTab("assistant")}
          />
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-card/80 p-1 shadow-sm">
            <TabsTrigger value="meetings" className="rounded-xl data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              <CalendarDays className="h-4 w-4" />
              Meetings
            </TabsTrigger>
            <TabsTrigger value="assistant" className="rounded-xl data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              <Sparkles className="h-4 w-4" />
              Assistant
            </TabsTrigger>
            <TabsTrigger value="about" className="rounded-xl data-[state=active]:bg-blue-700 data-[state=active]:text-white">
              <Building2 className="h-4 w-4" />
              About
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meetings" className="space-y-6">
            {!showForm ? (
              <Button onClick={openRequestForm} className="h-11 border-blue-700 bg-blue-700 text-white hover:bg-blue-800">
                <Plus className="h-4 w-4" />
                Request New Meeting
              </Button>
            ) : (
              <Card className="border-blue-100 shadow-xl shadow-blue-950/5">
                <CardHeader>
                  <CardTitle className="text-slate-950">Request a Meeting</CardTitle>
                  <CardDescription>
                    Share the topic and details. Admin will approve, reject, or
                    schedule a secure video link.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitRequest} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Topic</label>
                      <Input
                        placeholder="What is the meeting about?"
                        value={formData.topic}
                        onChange={(e) =>
                          setFormData({ ...formData, topic: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Provide more details about your meeting request"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        required
                        rows={4}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="border-blue-700 bg-blue-700 text-white hover:bg-blue-800"
                      >
                        <Send className="h-4 w-4" />
                        {isSubmitting ? "Submitting..." : "Submit Request"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card className="border-blue-100 shadow-xl shadow-blue-950/5">
              <CardHeader>
                <CardTitle className="text-slate-950">Your Meeting Requests</CardTitle>
                <CardDescription>
                  Track pending, approved, and rejected meeting requests.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-10 text-center text-muted-foreground">
                    Loading...
                  </div>
                ) : requests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 py-12 text-center text-slate-500">
                    <CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-60" />
                    <p>No meeting requests yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <Card
                        key={request._id}
                        className={`border ${getStatusClassName(request.status)}`}
                      >
                        <CardContent className="pt-6">
                          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-lg font-bold">{request.topic}</h3>
                              <p className="mt-1 text-sm text-slate-600">
                                {request.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(request.status)}
                              <span className="text-sm font-medium capitalize">
                                {request.status}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm text-slate-600">
                            <p>
                              <strong>Requested:</strong>{" "}
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>

                            {request.status === "approved" && request.scheduledAt && (
                              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                                <p className="flex items-center gap-2 font-medium text-blue-950">
                                  <CalendarDays className="h-4 w-4" />
                                  Meeting Scheduled
                                </p>
                                <p className="mt-1 text-sm text-blue-800">
                                  {new Date(request.scheduledAt).toLocaleString()}
                                </p>
                                {request.meetingLink && (
                                  <div className="mt-3 space-y-2">
                                    <a
                                      href={request.meetingLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
                                    >
                                      Join Video Call
                                    </a>
                                    <p className="break-all text-xs text-blue-700">
                                      {request.meetingLink}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {request.status === "rejected" &&
                              request.rejectionReason && (
                                <div className="mt-4 rounded-lg bg-red-100/70 p-3">
                                  <p className="font-medium text-red-900">
                                    Rejection Reason
                                  </p>
                                  <p className="mt-1 text-sm text-red-800">
                                    {request.rejectionReason}
                                  </p>
                                </div>
                              )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assistant">
            <ImageInsightPanel
              compact
              title="Complaint & Query Assistant"
              description="Send a question, upload a screenshot or document image, and get a structured response."
            />
          </TabsContent>

          <TabsContent value="about">
            <div className="grid gap-6 lg:grid-cols-3">
              <AboutCard
                icon={ShieldCheck}
                title="Secure and Private"
                description="Password-protected meeting links and authenticated dashboards keep user actions separated."
              />
              <AboutCard
                icon={Sparkles}
                title="AI Powered"
                description="The assistant can read uploaded images, summarize visible details, and answer customer queries."
              />
              <AboutCard
                icon={Headphones}
                title="Human Support"
                description="Meeting requests go to admins, who can approve, reject, and send secure video links."
              />
            </div>

            <Card className="mt-6 border-blue-100 shadow-xl shadow-blue-950/5">
              <CardHeader>
                <CardTitle>How video support works</CardTitle>
                <CardDescription>
                  Users request help here. Admins review the request, choose the
                  schedule time, and generate the secure video call links.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <ProcessStep
                  step="1"
                  title="Send request"
                  description="Submit your meeting topic and details from the dashboard."
                />
                <ProcessStep
                  step="2"
                  title="Admin schedules"
                  description="Admin approves the request and selects the video call time."
                />
                <ProcessStep
                  step="3"
                  title="Use approved link"
                  description="The scheduled time and join link appear on your approved request."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "green" | "red";
}) {
  const toneClassName = {
    amber: "bg-amber-100 text-amber-800",
    green: "bg-blue-100 text-blue-800",
    red: "bg-red-100 text-red-800",
  }[tone];

  return (
    <div className={`rounded-2xl px-5 py-4 ${toneClassName}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
  onClick,
}: {
  icon: typeof CalendarDays;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <Card className="h-full border-blue-100 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/10">
      <CardContent className="flex h-full items-start gap-4 p-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className="block text-left">
      {content}
    </button>
  );
}

function ProcessStep({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-blue-700 text-sm font-bold text-white">
        {step}
      </div>
      <h3 className="font-bold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {description}
      </p>
    </div>
  );
}

function AboutCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-blue-100 bg-white shadow-xl shadow-blue-950/5">
      <CardContent className="p-6">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-950">{title}</h3>
        <p className="mt-3 leading-relaxed text-slate-600">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
