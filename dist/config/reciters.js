"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findReciterConfig = exports.RECITERS = void 0;
exports.RECITERS = [
    { id: "ar.alafasy", name: "Mishary Alafasy", bitrate: 128 },
    { id: "ar.abdurrahmaansudais", name: "Abdurrahman As-Sudais", bitrate: 64 },
    { id: "ar.mahermuaiqly", name: "Maher Al Muaiqly", bitrate: 128 },
    { id: "ar.abdulbasitmurattal", name: "Abdul Basit", bitrate: 64 },
    { id: "ar.abdulsamad", name: "Abdul Samad", bitrate: 64 },
    { id: "ar.husary", name: "Mahmoud Khalil Al-Husary", bitrate: 128 },
    { id: "ar.minshawi", name: "Mohamed Siddiq Al-Minshawi", bitrate: 128 },
    { id: "ar.ahmedajamy", name: "Ahmed Al-Ajamy", bitrate: 128 },
    { id: "ar.shaatree", name: "Abu Bakr Ash-Shaatree", bitrate: 128 },
    { id: "ar.saoodshuraym", name: "Saood Ash-Shuraym", bitrate: 64 },
    { id: "ar.hudhaify", name: "Ali Al-Hudhaify", bitrate: 128 },
    { id: "ar.muhammadayyoub", name: "Muhammad Ayyoub", bitrate: 128 },
    { id: "ar.muhammadjibreel", name: "Muhammad Jibreel", bitrate: 128 },
    { id: "ar.abdullahbasfar", name: "Abdullah Basfar", bitrate: 64 },
    { id: "ar.husarymujawwad", name: "Husary (Mujawwad)", bitrate: 128 },
    { id: "ar.minshawimujawwad", name: "Minshawi (Mujawwad)", bitrate: 64 },
    { id: "ar.hanirifai", name: "Hani Rifai", bitrate: 64 },
    { id: "ar.aymanswoaid", name: "Ayman Sowaid", bitrate: 64 },
    { id: "ar.dosari", name: "Yasser Al-Dosari", audioSource: "everyayah" },
];
const findReciterConfig = (reciterId) => exports.RECITERS.find((reciter) => reciter.id.toLowerCase() === reciterId.toLowerCase());
exports.findReciterConfig = findReciterConfig;
//# sourceMappingURL=reciters.js.map