import axios from "axios";
import { findReciterConfig } from "../config/reciters.ts";
import { buildQuranAudioUrl } from "./audioUrl.service.ts";

export type SocialPlatform = "youtube" | "tiktok" | "facebook";

interface AyahContent {
  ayahNumber: number;
  arabicText: string;
  translation: string;
  audioUrl: string;
}

interface QuranContent {
  surahName: string;
  surahNumber: number;
  ayahNumber: number; // Primary/First ayah number (for legacy compatibility)
  ayahNumbers: number[]; // Required array of all ayah numbers included
  reciterId: string;
  arabicText: string; // Combined or first arabic text
  translation: string; // Combined or first translation
  audioUrl: string; // Primary/First audio URL (for legacy compatibility)
  ayahs: AyahContent[]; // Full list of selected ayahs with individual texts & audios
  videoUrl?: string; // Optional generated .mp4 URL
  description: string;
  title: string; // Ready-to-use title for YouTube/TikTok
}

const DEFAULT_RECITER_EDITION = "ar.alafasy";
const TOTAL_AYAHS = 6236;

export const generateQuranContent = async (
  reciterId?: string | null,
  targetPlatform?: SocialPlatform,
): Promise<QuranContent> => {
  const activeReciter = reciterId || DEFAULT_RECITER_EDITION;
  const reciterConfig = findReciterConfig(activeReciter);

  // 1. Determine count between 3 and 5 inclusive (3, 4, or 5)
  const count = Math.floor(Math.random() * 3) + 3;

  // 2. Pick a random starting global ayah ID (ensuring we don't overflow the 6236 total limit)
  const startAyahId = Math.floor(Math.random() * (TOTAL_AYAHS - count + 1)) + 1;

  // 3. Fetch all consecutive ayahs in parallel using Promise.all
  const ayahPromises = [];
  for (let i = 0; i < count; i++) {
    const currentAyahId = startAyahId + i;
    ayahPromises.push(
      axios.get(
        `https://api.alquran.cloud/v1/ayah/${currentAyahId}/editions/quran-uthmani,en.sahih`,
      ),
    );
  }

  const responses = await Promise.all(ayahPromises);

  if (!responses || responses.length === 0 || !responses[0]?.data?.data) {
    throw new Error("Failed to fetch Quran content from external API.");
  }

  const ayahs: AyahContent[] = responses.map((response, index) => {
    const data = response?.data?.data;
    if (!data || !data[0] || !data[1]) {
      throw new Error(
        `Invalid data structure received for ayah index ${index}`,
      );
    }

    const uthmaniText: string = data[0].text;
    const translationText: string = data[1].text;
    const surahNum: number = data[0].surah.number;
    const numInSurah: number = data[0].numberInSurah;

    const audioUrl = buildQuranAudioUrl(
      activeReciter,
      surahNum,
      numInSurah,
      reciterConfig?.bitrate,
      reciterConfig,
    );

    return {
      ayahNumber: numInSurah,
      arabicText: uthmaniText,
      translation: translationText,
      audioUrl: audioUrl || "",
    };
  });

  // Guard check
  if (ayahs.length === 0) {
    throw new Error("No ayahs were successfully processed.");
  }

  // Explicitly assert that the first element exists
  const firstAyah = ayahs[0] as AyahContent;

  // Extract metadata safely from the first ayah response
  const firstResponseData = responses[0].data.data;
  const surahName: string = firstResponseData[0].surah.englishName;
  const surahNumber: number = firstResponseData[0].surah.number;
  const ayahNumbers: number[] = ayahs.map((a) => a.ayahNumber);

  const rangeLabel =
    ayahs.length === 1
      ? `[Verse ${ayahNumbers[0]}]`
      : `[Verses ${ayahNumbers[0]}-${ayahNumbers[ayahNumbers.length - 1]}]`;

  const cleanSurah = surahName.replace(/[^a-zA-Z0-9]/g, "");
  const title = `Surah ${surahName} ${rangeLabel} - Quran Recitation`;

  // Combine texts for captions/descriptions
  const combinedArabic = ayahs
    .map((a) => `(${a.ayahNumber}) ${a.arabicText}`)
    .join(" ");
  const combinedTranslation = ayahs
    .map((a) => `(${a.ayahNumber}) ${a.translation}`)
    .join("\n\n");

  let description = "";

  // Apply tailored formatting per platform constraints
  if (targetPlatform === "tiktok") {
    const hashtags = `#Quran #Islam #Surah${cleanSurah} #IslamicReminders`;
    const fullText = `Surah ${surahName} ${rangeLabel}\n\n"${combinedTranslation}"\n\n${hashtags}`;
    description = fullText.slice(0, 4000);
  } else if (targetPlatform === "facebook") {
    const hashtags = `#Quran #fyp #Islam #Surah${cleanSurah}`;
    description =
      `🎧🌹✨ Quranic Reflection: Surah ${surahName} ${rangeLabel}\n\n` +
      `Arabic:\n${combinedArabic}\n\n` +
      `Translation:\n"${combinedTranslation}"\n\n` +
      `May Allah grant us wisdom and peace through the Holy Quran.🤲🤲\n\n` +
      `Follow us you'll never regret it 🙏` +
      `${hashtags}`;
  } else if (targetPlatform === "youtube") {
    const hashtags = `#Quran #QuranVerses #Islam #Surah${cleanSurah} #IslamicReminders`;
    const fullText =
      `Quranic Reflection: Surah ${surahName} ${rangeLabel}\n\n` +
      `Arabic:\n${combinedArabic}\n\n` +
      `Translation:\n"${combinedTranslation}"\n\n` +
      `May Allah grant us wisdom and peace through the Holy Quran.\n\n` +
      `${hashtags}`;
    description = fullText.slice(0, 5000);
  } else {
    const hashtags = `#Quran #QuranVerses #Islam #Surah${cleanSurah} #IslamicReminders #Deen`;
    description =
      `Quranic Reflection: Surah ${surahName} ${rangeLabel}\n\n` +
      `Arabic:\n${combinedArabic}\n\n` +
      `Translation:\n"${combinedTranslation}"\n\n` +
      `May Allah grant us wisdom and peace through the Holy Quran.\n\n` +
      `${hashtags}`;
  }

  return {
    surahName,
    surahNumber,
    ayahNumber: firstAyah.ayahNumber,
    ayahNumbers,
    reciterId: activeReciter,
    arabicText: combinedArabic,
    translation: combinedTranslation,
    audioUrl: firstAyah.audioUrl,
    ayahs,
    title: title.slice(0, 100),
    description,
  };
};
