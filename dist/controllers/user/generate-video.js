"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateVideo = void 0;
const helper_ts_1 = require("../../utils/helper.ts");
const generatevideo_ts_1 = require("../../models/generatevideo.ts");
const GenerateVideo = async (req, res) => {
    const user = req.id;
    const cookies = req.headers.cookie;
    if (!cookies) {
        return (0, helper_ts_1.sendErrorResponse)(res, "You're not logged in!");
    }
    const { templateId, surahNumber, ayahNumber, reciterId } = req.body;
    if (!templateId || !surahNumber || !ayahNumber || !reciterId) {
        return (0, helper_ts_1.sendErrorResponse)(res, "templateId,surahNumber,ayahNumber and reciterId are required!");
    }
    try {
        const generateNewVideo = new generatevideo_ts_1.GeneratedVideo({
            userId: user,
            templateId: templateId,
            surahNumber: surahNumber,
            ayahNumber: ayahNumber,
            reciterId: reciterId,
            status: "pending",
            progress: 0,
            outputUrl: "",
        });
    }
    catch (error) {
        console.log(error.message);
        return (0, helper_ts_1.sendErrorResponse)(res, error.message);
    }
};
exports.GenerateVideo = GenerateVideo;
//# sourceMappingURL=generate-video.js.map