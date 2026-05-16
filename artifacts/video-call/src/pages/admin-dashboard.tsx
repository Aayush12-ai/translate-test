import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useToast } from "../hooks/use-toast";
import { LogOut, CheckCircle, XCircle, Calendar, MessageSquare } from "lucide-react";
import { Textarea } from "../components/ui/textarea";

interface MeetingRequest {
  _id: string;
  topic: string;
  description: string;
  userName: string;
  userEmail: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  scheduledAt?: string;
  meetingLink?: string;
  hostMeetingLink?: string;
  rejectionReason?: string;
}

interface ModalState {
  isOpen: boolean;
  request: MeetingRequest | null;
  action: "approve" | "reject" | null;
  data: {
    scheduledAt: string;
    rejectionReason: string;
  };
}

const API_URL = import.meta.env.VITE_API_URL || "/api";

export function AdminDashboardPage() {
  const [, navigate] = useLocation();
  const { user, token, logout, isSessionReady } = useAuthStore();
  const { toast } = useToast();

  const [requests, setRequests] = useState<MeetingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    request: null,
    action: null,
    data: { scheduledAt: "", rejectionReason: "" },
  });

  useEffect(() => {
    // ProtectedRoute ensures user and token are available and user is admin
    if (token) {
      fetchAllRequests();
    }
  }, [filter, token]);

  const fetchAllRequests = async () => {
    setIsLoading(true);
    try {
      const url = filter === "all"
        ? `${API_URL}/meetings/all-requests?status=all`
        : `${API_URL}/meetings/all-requests?status=${filter}`;

      const response = await fetch(url, {
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
        description: error instanceof Error ? error.message : "Failed to fetch requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!modal.request || !modal.data.scheduledAt) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/meetings/${modal.request._id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            scheduledAt: modal.data.scheduledAt,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to approve meeting");
      }

      toast({
        title: "Success",
        description: "Video call scheduled and notification sent to user",
      });

      setModal({ isOpen: false, request: null, action: null, data: { scheduledAt: "", rejectionReason: "" } });
      fetchAllRequests();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve meeting",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!modal.request || !modal.data.rejectionReason) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/meetings/${modal.request._id}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rejectionReason: modal.data.rejectionReason,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to reject meeting");
      }

      toast({
        title: "Success",
        description: "Meeting rejected and notification sent to user",
      });

      setModal({ isOpen: false, request: null, action: null, data: { scheduledAt: "", rejectionReason: "" } });
      fetchAllRequests();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject meeting",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-600">Manage meeting requests</p>
          </div>
          <Button variant="outline" onClick={() => {
            logout();
            navigate("/admin/login");
          }}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(["pending", "approved", "rejected", "all"] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? "default" : "outline"}
              onClick={() => setFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm">Total Requests</p>
                <p className="text-3xl font-bold text-gray-900">{requests.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {requests.filter((r) => r.status === "pending").length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm">Approved</p>
                <p className="text-3xl font-bold text-green-600">
                  {requests.filter((r) => r.status === "approved").length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requests List */}
        <div>
          <h2 className="text-xl font-bold mb-4">Meeting Requests</h2>

          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">Loading...</p>
              </CardContent>
            </Card>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No meeting requests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request._id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{request.topic}</h3>
                        <p className="text-gray-600 text-sm mt-1">{request.description}</p>

                        <div className="mt-4 space-y-1 text-sm text-gray-600">
                          <p>
                            <strong>User:</strong> {request.userName} ({request.userEmail})
                          </p>
                          <p>
                            <strong>Requested:</strong>{" "}
                            {new Date(request.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          request.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : request.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {request.status === "pending" && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() =>
                            setModal({
                              isOpen: true,
                              request,
                              action: "approve",
                              data: { scheduledAt: "", rejectionReason: "" },
                            })
                          }
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setModal({
                              isOpen: true,
                              request,
                              action: "reject",
                              data: { scheduledAt: "", rejectionReason: "" },
                            })
                          }
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {request.status === "approved" && request.scheduledAt && (
                      <div className="bg-green-50 p-3 rounded-lg mt-4">
                        <p className="font-medium text-green-900 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Scheduled
                        </p>
                        <p className="text-sm text-green-800 mt-1">
                          {new Date(request.scheduledAt).toLocaleString()}
                        </p>
                        {(request.hostMeetingLink || request.meetingLink) && (
                          <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {request.hostMeetingLink && (
                                <a
                                  href={request.hostMeetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-800"
                                >
                                  Join as Admin
                                </a>
                              )}
                              {request.meetingLink && (
                                <a
                                  href={request.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-md border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                                >
                                  Open User Link
                                </a>
                              )}
                            </div>
                            {request.hostMeetingLink && (
                              <p className="text-xs text-green-700 break-all">
                                Admin host link: {request.hostMeetingLink}
                              </p>
                            )}
                            {request.meetingLink && (
                              <p className="text-xs text-green-700 break-all">
                                User join link: {request.meetingLink}
                              </p>
                            )}
                            <p className="text-xs text-green-700">
                              The host link is also sent to the configured admin email.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {request.status === "rejected" && request.rejectionReason && (
                      <div className="bg-red-50 p-3 rounded-lg mt-4">
                        <p className="font-medium text-red-900">Reason</p>
                        <p className="text-sm text-red-800 mt-1">{request.rejectionReason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal.isOpen && modal.request && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {modal.action === "approve" ? "Schedule Video Call" : "Reject Meeting"}
              </CardTitle>
              <CardDescription>{modal.request.topic}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {modal.action === "approve" ? (
                <>
                  <div>
                    <label className="text-sm font-medium">Video Call Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={modal.data.scheduledAt}
                      onChange={(e) =>
                        setModal({
                          ...modal,
                          data: { ...modal.data, scheduledAt: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Approve & Schedule Video Call
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setModal({
                          isOpen: false,
                          request: null,
                          action: null,
                          data: { scheduledAt: "", rejectionReason: "" },
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Rejection Reason
                    </label>
                    <Textarea
                      placeholder="Why are you rejecting this request?"
                      value={modal.data.rejectionReason}
                      onChange={(e) =>
                        setModal({
                          ...modal,
                          data: { ...modal.data, rejectionReason: e.target.value },
                        })
                      }
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleReject}
                      variant="destructive"
                    >
                      Reject Request
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setModal({
                          isOpen: false,
                          request: null,
                          action: null,
                          data: { scheduledAt: "", rejectionReason: "" },
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
