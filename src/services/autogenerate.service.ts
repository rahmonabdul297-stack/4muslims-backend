// services/quranContent.service.ts
import axios from "axios";

interface QuranContent {
  surahName: string;
  ayahNumber: number;
  arabicText: string;
  translation: string;
  audioUrl: string;
  description: string;
}

export const generateQuranContent = async (): Promise<QuranContent> => {
  const randomAyahId = Math.floor(Math.random() * 6236) + 1;
  const response = await axios.get(
    `https://api.alquran.cloud/v1/ayah/${randomAyahId}/editions/quran-uthmani,en.sahih,ar.alafasy`,
  );

  const data = response.data.data;
  const uthmaniText = data[0].text;
  const translationText = data[1].text;
  const audioUrl = data[2].audio;
  const surahName = data[0].surah.englishName;
  const ayahNumber = data[0].numberInSurah;

  const description =
    `Quranic Reflection: Surah ${surahName} [Verse ${ayahNumber}]\n\n` +
    `Arabic:\n${uthmaniText}\n\n` +
    `Translation:\n"${translationText}"\n\n` +
    `May Allah grant us wisdom and peace through the Holy Quran.\n\n` +
    `#Quran #Islam #Surah${surahName.replace(/\s+/g, "")} #IslamicReminders #Muslim #Sunnah #Deen #Allah`;

  return {
    surahName,
    ayahNumber,
    arabicText: uthmaniText,
    translation: translationText,
    audioUrl,
    description,
  };
};
