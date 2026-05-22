import { Router, type IRouter } from "express";
import healthRouter from "./health";
import simulateRouter from "./simulate";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(simulateRouter);
router.use(messagesRouter);

export default router;
