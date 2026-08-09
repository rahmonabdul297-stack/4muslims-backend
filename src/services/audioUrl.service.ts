const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45,
  83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
  56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21,
  11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 6, 4, 5, 6,
];

const normalizeBitrate = (bitrate?: string | number) => {
  const raw =
    bitrate === undefined || bitrate === null
      ? process.env.QURAN_AUDIO_BITRATE
      : String(bitrate);
  if (!raw || raw.trim().length === 0) {
    return "128";
  }

  const trimmed = raw.trim().toLowerCase();
  const numericMatch = trimmed.match(/^(\d+)(?:kbps)?$/);
  const allowedBitrates = ["64", "128"];
  if (numericMatch && numericMatch[1]) {
    const value = numericMatch[1];
    return allowedBitrates.includes(value) ? value : "128";
  }
  return "128";
};

const normalizeReciterId = (reciterId: string) => {
  if (!reciterId || typeof reciterId !== "string") {
    throw new Error("Invalid reciterId for Quran audio URL");
  }
  const value = reciterId.trim();
  if (!/^ar\./.test(value)) {
    throw new Error(
      `Invalid Quran reciter id: ${reciterId}. Expected a reciter id like ar.alafasy`,
    );
  }
  return value;
};

export const getGlobalAyahNumber = (
  surahNumber: number,
  ayahNumber: number,
) => {
  const parsedSurah = Number(surahNumber);
  const parsedAyah = Number(ayahNumber);
  if (
    !Number.isInteger(parsedSurah) ||
    parsedSurah <= 0 ||
    parsedSurah > SURAH_AYAH_COUNTS.length
  ) {
    throw new Error(
      `Invalid surah number: ${surahNumber}. Expected a value between 1 and ${SURAH_AYAH_COUNTS.length}.`,
    );
  }
  if (!Number.isInteger(parsedAyah) || parsedAyah <= 0) {
    throw new Error(
      `Invalid ayah number: ${ayahNumber}. Expected a positive integer.`,
    );
  }

  let offset = 0;
  for (let i = 0; i < parsedSurah - 1; i++) {
    const count = SURAH_AYAH_COUNTS[i];
    offset += count ?? 0;
  }

  const surahCount = SURAH_AYAH_COUNTS[parsedSurah - 1];
  if (!surahCount || parsedAyah > surahCount) {
    throw new Error(
      `Invalid ayah number ${ayahNumber} for surah ${surahNumber}.`,
    );
  }

  return offset + parsedAyah;
};

export const buildQuranAudioUrl = (
  reciterId: string,
  surahNumber: number,
  ayahNumber: number,
  bitrate?: string | number,
) => {
  const parsedReciterId = normalizeReciterId(reciterId);
  const globalAyahNumber = getGlobalAyahNumber(surahNumber, ayahNumber);
  const configuredBitrate = normalizeBitrate(bitrate);
  return `https://cdn.islamic.network/quran/audio/${configuredBitrate}/${parsedReciterId}/${globalAyahNumber}.mp3`;
};

export const normalizeQuranAudioUrl = (
  audioUrl: string,
  reciterId: string,
  surahNumber: number,
  ayahNumber: number,
  bitrate?: string | number,
) => {
  try {
    const url = new URL(audioUrl);
    if (url.hostname !== "cdn.islamic.network") {
      return audioUrl;
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (
      pathParts.length !== 5 ||
      pathParts[0] !== "quran" ||
      pathParts[1] !== "audio"
    ) {
      return audioUrl;
    }

    const slicedParts = pathParts.slice(2);
    const bitratePart = slicedParts[0] as string | undefined;
    const reciterPart = slicedParts[1] as string | undefined;
    const third = slicedParts[2] as string | undefined;
    const fourth = slicedParts[3] as string | undefined;
    const configuredBitrate = normalizeBitrate(bitrate);

    if (!bitratePart || !reciterPart) {
      return audioUrl;
    }

    if (/^(64|128)$/.test(bitratePart) && reciterPart.startsWith("ar.")) {
      return audioUrl;
    }

    if (
      bitratePart.startsWith("ar.") &&
      typeof third === "string" &&
      typeof fourth === "string"
    ) {
      const sourceSurah = Number(third);
      const sourceAyah = Number(fourth.replace(/\.mp3$/, ""));
      if (Number.isInteger(sourceSurah) && Number.isInteger(sourceAyah)) {
        const globalAyahNumber = getGlobalAyahNumber(sourceSurah, sourceAyah);
        return `https://cdn.islamic.network/quran/audio/${configuredBitrate}/${bitratePart}/${globalAyahNumber}.mp3`;
      }
    }

    return audioUrl;
  } catch {
    return audioUrl;
  }
};
