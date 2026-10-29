import Joi from "joi";

const email = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: { allow: false } })
  .max(254)
  .required();
const password = Joi.string()
  .min(10)
  .max(128)
  .custom((value, helpers) =>
    !value.trim() ? helpers.error("string.empty") : value,
  )
  .required();
const loginPassword = Joi.string().min(1).max(128).required();

export const loginSchema = Joi.object({
  email,
  password: loginPassword,
}).unknown(false);
export const registerSchema = Joi.object({
  email,
  password,
  timezone: Joi.string().max(64).optional(),
}).unknown(false);
export const forgotPasswordSchema = Joi.object({ email }).unknown(false);
export const verifyOtpSchema = Joi.object({
  challengeId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required(),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required(),
}).unknown(false);
export const resetPasswordSchema = Joi.object({
  resetToken: Joi.string().hex().length(64).required(),
  password: Joi.string()
    .min(10)
    .max(128)
    .custom((value, helpers) => {
      if (!value.trim()) return helpers.error("string.empty");
      return value;
    })
    .required(),
}).unknown(false);

export const profileSchema = Joi.object({
  skinType: Joi.string()
    .valid("oily", "dry", "combination", "normal", "unsure")
    .required(),
  sensitivity: Joi.string()
    .valid("often", "sometimes", "rarely", "unsure")
    .required(),
  concerns: Joi.array()
    .items(
      Joi.string().valid(
        "acne",
        "pigmentation",
        "dryness",
        "oiliness",
        "sensitivity",
        "other",
      ),
    )
    .max(10)
    .required(),
  goals: Joi.array()
    .items(
      Joi.string().valid(
        "simple-routine",
        "hydration",
        "sun-protection",
        "comfort",
        "even-tone",
      ),
    )
    .max(10)
    .required(),
  allergies: Joi.array().items(Joi.string().max(80).trim()).max(20).required(),
  timezone: Joi.string()
    .max(64)
    .custom((value, helpers) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
        return value;
      } catch {
        return helpers.error("any.invalid");
      }
    })
    .required(),
  city: Joi.string().allow(null, "").max(120).optional(),
}).unknown(false);

export const completionSchema = Joi.object({
  completed: Joi.boolean().required(),
}).unknown(false);
export const emptyBodySchema = Joi.object({}).unknown(false);
export const completionParamSchema = Joi.object({
  stepId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required(),
}).unknown(false);
export const compareQuerySchema = Joi.object({
  from: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required(),
  to: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required()
    .invalid(Joi.ref("from")),
}).unknown(false);
export const historyQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(20),
  cursor: Joi.date().iso().optional(),
}).unknown(false);
export const taskParamSchema = Joi.object({
  taskId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required(),
}).unknown(false);
export const analysisIdParamSchema = Joi.object({
  analysisId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required(),
}).unknown(false);
export const uvQuerySchema = Joi.object({
  city: Joi.string().trim().max(120).allow("").optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
})
  .and("latitude", "longitude")
  .unknown(false);
