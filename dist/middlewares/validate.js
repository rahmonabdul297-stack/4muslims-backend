"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validate = void 0;
const express_validator_1 = require("express-validator");
const Validate = (req, res, next) => {
    const err = (0, express_validator_1.validationResult)(req);
    if (!err.isEmpty()) {
        return res.status(400).json({ error: err.array()[0]?.msg });
    }
    next();
};
exports.Validate = Validate;
//# sourceMappingURL=validate.js.map