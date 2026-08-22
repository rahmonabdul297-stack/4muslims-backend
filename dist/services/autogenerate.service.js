"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQuranContent = void 0;
const axios_1 = __importDefault(require("axios"));
const DEFAULT_RECITER_EDITION = "ar.alafasy";
const generateQuranContent = async (reciterId, targetPlatform) => {
    const randomAyahId = Math.floor(Math.random() * 6236) + 1;
    const activeReciter = reciterId || DEFAULT_RECITER_EDITION;
    const response = await axios_1.default.get(`https://api.alquran.cloud/v1/ayah/${randomAyahId}/editions/quran-uthmani,en.sahih,${activeReciter}`);
    const data = response.data.data;
    const uthmaniText = data[0].text;
    const translationText = data[1].text;
    const audioUrl = data[2].audio;
    const surahName = data[0].surah.englishName;
    const ayahNumber = data[0].numberInSurah;
    const cleanSurah = surahName.replace(/[^a-zA-Z0-9]/g, "");
    const title = `Surah ${surahName} [Verse ${ayahNumber}] - Quran Recitation`;
    let description = "";
    // Apply tailored formatting per platform constraints
    if (targetPlatform === "tiktok") {
        // TikTok: Keep core 3-4 hashtags to prevent mobile screen overlap (Max 4000 chars)
        const hashtags = `#Quran #Islam #Surah${cleanSurah} #IslamicReminders`;
        const fullText = `Surah ${surahName} [Verse ${ayahNumber}]\n\n"${translationText}"\n\n${hashtags}`;
        description = fullText.slice(0, 4000);
    }
    else if (targetPlatform === "facebook") {
        // Facebook: 3 key hashtags (avoids spam signals)
        const hashtags = `#Quran #Islam #Surah${cleanSurah}`;
        description =
            `Quranic Reflection: Surah ${surahName} [Verse ${ayahNumber}]\n\n` +
                `Arabic:\n${uthmaniText}\n\n` +
                `Translation:\n"${translationText}"\n\n` +
                `May Allah grant us wisdom and peace through the Holy Quran.\n\n` +
                `${hashtags}`;
    }
    else if (targetPlatform === "youtube") {
        // YouTube: 4-5 high-performing hashtags (YouTube ignores descriptions with >60 hashtags)
        const hashtags = `#Quran #QuranVerses #Islam #Surah${cleanSurah} #IslamicReminders`;
        const fullText = `Quranic Reflection: Surah ${surahName} [Verse ${ayahNumber}]\n\n` +
            `Arabic:\n${uthmaniText}\n\n` +
            `Translation:\n"${translationText}"\n\n` +
            `May Allah grant us wisdom and peace through the Holy Quran.\n\n` +
            `${hashtags}`;
        description = fullText.slice(0, 5000);
    }
    else {
        // Standard Fallback: Balanced 5-6 hashtags
        const hashtags = `#Quran #QuranVerses #Islam #Surah${cleanSurah} #IslamicReminders #Deen`;
        description =
            `Quranic Reflection: Surah ${surahName} [Verse ${ayahNumber}]\n\n` +
                `Arabic:\n${uthmaniText}\n\n` +
                `Translation:\n"${translationText}"\n\n` +
                `May Allah grant us wisdom and peace through the Holy Quran.\n\n` +
                `${hashtags}`;
    }
    return {
        surahName,
        ayahNumber,
        arabicText: uthmaniText,
        translation: translationText,
        audioUrl,
        title: title.slice(0, 100),
        description,
    };
};
exports.generateQuranContent = generateQuranContent;
//# sourceMappingURL=autogenerate.service.js.map