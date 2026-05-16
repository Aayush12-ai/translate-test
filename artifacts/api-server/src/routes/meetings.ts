import { Router, Response } from "express";
import { MeetingRequest } from "../db/models/meetingRequest";
import { User } from "../db/models/user";
import { authMiddleware, adminMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { generateMeetingAccess } from "../lib/auth";
import {
  sendAdminMeetingScheduledEmail,
  sendMeetingApprovalEmail,
  sendMeetingRejectionEmail,
  sendMeetingRequestNotification,
} from "../lib/email";
import { logger } from "../lib/logger";
import { resolveAdminNotificationEmail } from "../lib/admin";

const router = Router();

interface CreateMeetingRequestBody {
  topic: string;
  description: string;
}

interface ApproveMeetingBody {
  scheduledAt: string;
}

interface RejectMeetingBody {
  rejectionReason: string;
}

// Create meeting request (User)
router.post(
  "/request",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { topic, description }: CreateMeetingRequestBody = req.body;

      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!topic || !description) {
        return res.status(400).json({
          error: "Topic and description are required",
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const meetingRequest = await MeetingRequest.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userName: user.name,
        topic,
        description,
      });

      // Notify admin
      const adminEmail = await resolveAdminNotificationEmail();
      if (adminEmail) {
        await sendMeetingRequestNotification(
          adminEmail,
          user.name,
          user.email,
          topic,
          description,
        );
      }

      res.status(201).json({
        message: "Meeting request created successfully",
        request: meetingRequest,
      });
    } catch (error) {
      logger.error("Create meeting request error:", error);
      res.status(500).json({
        error: "Failed to create meeting request",
      });
    }
  },
);

// Get user's meeting requests
router.get(
  "/my-requests",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const requests = await MeetingRequest.find({
        userId: req.user.userId,
      }).sort({ createdAt: -1 });

      res.json({
        requests,
      });
    } catch (error) {
      logger.error("Get user requests error:", error);
      res.status(500).json({
        error: "Failed to get requests",
      });
    }
  },
);

// Get all meeting requests (Admin only)
router.get(
  "/all-requests",
  authMiddleware,
  adminMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status = "pending" } = req.query;

      const filter: any = {};
      if (status && status !== "all") {
        filter.status = status;
      }

      const requests = await MeetingRequest.find(filter)
        .populate("userId", "name email")
        .sort({ createdAt: -1 });

      res.json({
        requests,
      });
    } catch (error) {
      logger.error("Get all requests error:", error);
      res.status(500).json({
        error: "Failed to get requests",
      });
    }
  },
);

// Approve meeting request (Admin only)
router.post(
  "/:id/approve",
  authMiddleware,
  adminMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { scheduledAt }: ApproveMeetingBody = req.body;

      if (!scheduledAt) {
        return res.status(400).json({
          error: "Scheduled date is required",
        });
      }

      const meetingRequest = await MeetingRequest.findById(id);
      if (!meetingRequest) {
        return res.status(404).json({ error: "Meeting request not found" });
      }

      const approvingAdmin = req.user
        ? await User.findById(req.user.userId)
        : null;
      const meetingAccess = generateMeetingAccess(
        meetingRequest.userName,
        approvingAdmin?.name || "System Admin",
      );
      const scheduledDate = new Date(scheduledAt);

      meetingRequest.status = "approved";
      meetingRequest.approvedBy = req.user!.userId as any;
      meetingRequest.scheduledAt = scheduledDate;
      meetingRequest.meetingLink = meetingAccess.meetingLink;
      meetingRequest.hostMeetingLink = meetingAccess.hostMeetingLink;

      await meetingRequest.save();

      // Send approval email to user
      await sendMeetingApprovalEmail(
        meetingRequest.userEmail,
        meetingRequest.userName,
        meetingRequest.topic,
        scheduledDate,
        meetingAccess.meetingLink,
      );

      const adminEmail = await resolveAdminNotificationEmail();
      if (adminEmail) {
        await sendAdminMeetingScheduledEmail(
          adminEmail,
          meetingRequest.userName,
          meetingRequest.userEmail,
          meetingRequest.topic,
          scheduledDate,
          meetingAccess.meetingLink,
          meetingAccess.hostMeetingLink,
        );
      }

      res.json({
        message: "Meeting request approved",
        request: meetingRequest,
      });
    } catch (error) {
      logger.error("Approve meeting error:", error);
      res.status(500).json({
        error: "Failed to approve meeting",
      });
    }
  },
);

// Reject meeting request (Admin only)
router.post(
  "/:id/reject",
  authMiddleware,
  adminMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { rejectionReason }: RejectMeetingBody = req.body;

      if (!rejectionReason) {
        return res.status(400).json({
          error: "Rejection reason is required",
        });
      }

      const meetingRequest = await MeetingRequest.findById(id);
      if (!meetingRequest) {
        return res.status(404).json({ error: "Meeting request not found" });
      }

      meetingRequest.status = "rejected";
      meetingRequest.rejectionReason = rejectionReason;

      await meetingRequest.save();

      // Send rejection email to user
      await sendMeetingRejectionEmail(
        meetingRequest.userEmail,
        meetingRequest.userName,
        meetingRequest.topic,
        rejectionReason,
      );

      res.json({
        message: "Meeting request rejected",
        request: meetingRequest,
      });
    } catch (error) {
      logger.error("Reject meeting error:", error);
      res.status(500).json({
        error: "Failed to reject meeting",
      });
    }
  },
);

// Get meeting request details
router.get(
  "/:id",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const meetingRequest = await MeetingRequest.findById(id).populate(
        "userId",
        "name email",
      );

      if (!meetingRequest) {
        return res.status(404).json({ error: "Meeting request not found" });
      }

      const populatedUser = meetingRequest.userId as any;
      const ownerId = populatedUser?._id?.toString?.() ?? populatedUser.toString();
      const isOwner = ownerId === req.user.userId;
      if (!req.user.isAdmin && !isOwner) {
        return res.status(403).json({
          error: "Forbidden - You can only view your own meeting requests",
        });
      }

      res.json({
        request: meetingRequest,
      });
    } catch (error) {
      logger.error("Get meeting request error:", error);
      res.status(500).json({
        error: "Failed to get meeting request",
      });
    }
  },
);

export default router;
