"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.md5 = md5;
exports.sha1 = sha1;
const crypto_1 = __importDefault(require("crypto"));
function md5(input, encoding = 'hex') {
    return crypto_1.default.createHash('md5').update(input).digest(encoding);
}
function sha1(input, key, encoding = 'binary') {
    return crypto_1.default.createHmac('sha1', key).update(input).digest(encoding);
}
