import axios from "axios";

export type SocialPlatform = "youtube" | "tiktok" | "facebook";

interface QuranContent {
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
  reciterId: string;
  arabicText: string;
  translation: string;
  videoUrl?: string; // Optional generated .mp4 URL
  audioUrl: string;
  description: string;
  title: string; // Ready-to-use title for YouTube/TikTok
}

const DEFAULT_RECITER_EDITION = "ar.alafasy";

export const generateQuranContent = async (
  reciterId?: string | null,
  targetPlatform?: SocialPlatform,
): Promise<QuranContent> => {
  const randomAyahId = Math.floor(Math.random() * 6236) + 1;
  const activeReciter = reciterId || DEFAULT_RECITER_EDITION;

  const response = await axios.get(
    `https://api.alquran.cloud/v1/ayah/${randomAyahId}/editions/quran-uthmani,en.sahih,${activeReciter}`,
  );

  const data = response.data.data;
  const uthmaniText: string = data[0].text;
  const translationText: string = data[1].text;
  const audioUrl: string = data[2].audio;
  const surahName: string = data[0].surah.englishName;
  const surahNumber: number = data[0].surah.number;
  const ayahNumber: number = data[0].numberInSurah;

  const cleanSurah = surahName.replace(/[^a-zA-Z0-9]/g, "");
  const title = `Surah ${surahName} [Verse ${ayahNumber}] - Quran Recitation`;

  let description = "";

  // Apply tailored formatting per platform constraints
  if (targetPlatform === "tiktok") {
    // TikTok: Keep core 3-4 hashtags to prevent mobile screen overlap (Max 4000 chars)
    const hashtags = `#Quran #Islam #Surah${cleanSurah} #IslamicReminders`;
    const fullText = `Surah ${surahName} [Verse ${ayahNumber}]\n\n"${translationText}"\n\n${hashtags}`;
    description = fullText.slice(0, 4000);
  } else if (targetPlatform === "facebook") {
    // Facebook: 3 key hashtags (avoids spam signals)
    const hashtags = `#Quran #Islam #Surah${cleanSurah}`;
    description =
      `Quranic Reflection: Surah ${surahName} [Verse ${ayahNumber}]\n\n` +
      `Arabic:\n${uthmaniText}\n\n` +
      `Translation:\n"${translationText}"\n\n` +
      `May Allah grant us wisdom and peace through the Holy Quran.\n\n` +
      `${hashtags}`;
  } else if (targetPlatform === "youtube") {
    // YouTube: 4-5 high-performing hashtags (YouTube ignores descriptions with >60 hashtags)
    const hashtags = `#Quran #QuranVerses #Islam #Surah${cleanSurah} #IslamicReminders`;
    const fullText =
      `Quranic Reflection: Surah ${surahName} [Verse ${ayahNumber}]\n\n` +
      `Arabic:\n${uthmaniText}\n\n` +
      `Translation:\n"${translationText}"\n\n` +
      `May Allah grant us wisdom and peace through the Holy Quran.\n\n` +
      `${hashtags}`;
    description = fullText.slice(0, 5000);
  } else {
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
    surahNumber,
    ayahNumber,
    reciterId: activeReciter,
    arabicText: uthmaniText,
    translation: translationText,
    audioUrl,
    title: title.slice(0, 100),
    description,
  };
};
