"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const admin_routes_ts_1 = __importDefault(require("./routes/admin/admin-routes.ts"));
const public_routes_ts_1 = __importDefault(require("./routes/public/public-routes.ts"));
const user_auth_route_ts_1 = __importDefault(require("./routes/user/user-auth-route.ts"));
const user_profile_route_ts_1 = __importDefault(require("./routes/user/user-profile-route.ts"));
const video_routes_ts_1 = __importDefault(require("./routes/video-routes.ts"));
const payment_route_ts_1 = __importDefault(require("./routes/payment/payment-route.ts"));
const index_ts_1 = __importDefault(require("./db/index.ts"));
const app = (0, express_1.default)();
const PORT = 6644;
app.use(express_1.default.json({ limit: "100mb" }));
(0, index_ts_1.default)();
app.use(express_1.default.urlencoded({ limit: "100mb", extended: true }));
// ... other routes
app.use("/api/v1/admin", admin_routes_ts_1.default);
app.use("/api/v1/public", public_routes_ts_1.default);
app.use("/api/v1/auth", user_auth_route_ts_1.default);
app.use("/api/v1/profile", user_profile_route_ts_1.default);
app.use("/api/v1/videos", video_routes_ts_1.default);
app.use("/api/v1/payments", payment_route_ts_1.default);
app.listen(PORT, () => {
    console.log(`Server is up and running on http://localhost:${PORT}`);
});
//# sourceMappingURL=app.js.map