import { Router } from "express";
import { pool } from "../config/database.js";
import { getUvForecast } from "../integrations/weather/openMeteoService.js";

const router = Router();
router.get("/uv", async (req, res) => {
  const [[pref]] = await pool.execute(
    "SELECT city FROM user_preferences WHERE user_id = ?",
    [req.userId],
  );
  const city =
    typeof req.query.city === "string" ? req.query.city.trim() : pref?.city;
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const hasLatitude = req.query.latitude !== undefined;
  const hasLongitude = req.query.longitude !== undefined;
  if (hasLatitude !== hasLongitude)
    return res.status(400).json({
      status: "error",
      message: "Provide both latitude and longitude.",
    });
  const coordinatesProvided =
    Number.isFinite(latitude) && Number.isFinite(longitude);
  if (!coordinatesProvided && !city)
    return res.json({
      available: false,
      reason: "Choose a city in your skin profile to see UV guidance.",
    });
  if (city && city.length > 120)
    return res
      .status(400)
      .json({ status: "error", message: "City name is too long." });
  if (
    coordinatesProvided &&
    (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
  )
    return res
      .status(400)
      .json({ status: "error", message: "Location coordinates are invalid." });
  res.json(await getUvForecast({ city, latitude, longitude }));
});
export default router;
