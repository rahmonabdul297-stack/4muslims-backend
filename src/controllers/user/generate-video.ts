import type { NextFunction, Request, Response } from "express";
import { sendErrorResponse } from "../../utils/helper.ts";
import { GeneratedVideo } from "../../models/generatevideo.ts";
import { User } from "../../models/User.ts";

const GenerateVideo = async (req: Request, res: Response) => {
  const user = (req as any).id;
  const cookies = req.headers.cookie;
  if (!cookies) {
    return sendErrorResponse(res, "You're not logged in!");
  }
  const { templateId, surahNumber, ayahNumber, reciterId } = req.body;
  if (!templateId || !surahNumber || !ayahNumber || !reciterId) {
    return sendErrorResponse(
      res,
      "templateId,surahNumber,ayahNumber and reciterId are required!",
    );
  }
  try {
    const generateNewVideo = new GeneratedVideo({
      userId: user,
      templateId: templateId,
      surahNumber: surahNumber,
      ayahNumber: ayahNumber,
      reciterId: reciterId,
      status: "pending",
      progress: 0,
      outputUrl: "",
    });
  } catch (error) {
    console.log((error as Error).message);
    return sendErrorResponse(res, (error as Error).message);
  }
};
export { GenerateVideo };
