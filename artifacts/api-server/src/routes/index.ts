import { Router, type IRouter } from "express";
import healthRouter from "./health";
import imageInsightsRouter from "./image-insights";
import roomsRouter from "./rooms";
import authRouter from "./auth";
import meetingsRouter from "./meetings";

const router: IRouter = Router();

router.use("/auth", authRouter);
router.use("/meetings", meetingsRouter);
router.use(healthRouter);
router.use(imageInsightsRouter);
router.use(roomsRouter);

export default router;
