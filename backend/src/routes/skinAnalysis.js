
// import express from "express";
// import multer from "multer";

// const router = express.Router();

// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10 MB
//   },
//   fileFilter: (req, file, callback) => {
//     const allowedTypes = ["image/jpeg", "image/png"];

//     if (!allowedTypes.includes(file.mimetype)) {
//       return callback(
//         new Error("Only JPG, JPEG and PNG images are supported.")
//       );
//     }

//     callback(null, true);
//   },
// });

// const BASE_URL = "https://yce-api-01.makeupar.com/s2s/v2.1";
// // const BASE_URL = 'https://yce-api-01.makeupar.com/s2s/v2.1/task/skin-analysis';

// const SD_CONCERNS = [
//   "acne",
//   "pore",
//   "texture",
//   "oiliness",
//   "radiance",
//   "moisture",
//   "redness",
//   "age_spot",
//   "wrinkle",
//   "skin_type",
// ];

// async function youCamRequest(url, options = {}) {
//   const response = await fetch(url, {
//     ...options,
//     headers: {
//       Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`,
//       ...(options.headers || {}),
//     },
//   });

//   const text = await response.text();

//   let payload;
//   try {
//     payload = JSON.parse(text);
//   } catch {
//     payload = { message: text };
//   }

//   if (!response.ok) {
//     const message =
//       payload?.message ||
//       payload?.error?.message ||
//       `YouCam API request failed with status ${response.status}`;

//     const error = new Error(message);
//     error.status = response.status;
//     throw error;
//   }

//   return payload;
// }

// async function uploadImageToYouCam(file) {
//   const contentType =
//     file.mimetype === "image/jpeg" ? "image/jpg" : "image/png";

//   // 1. Ask YouCam for an upload URL and file ID.
//   const uploadInfo = await youCamRequest(
//     `${BASE_URL}/file/skin-analysis`,
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         files: [
//           {
//             content_type: contentType,
//             file_name: file.originalname.replace(/[^\w.-]/g, "_"),
//             file_size: file.size,
//           },
//         ],
//       }),
//     }
//   );

//   const fileInfo = uploadInfo?.data?.files?.[0];
//   const uploadRequest = fileInfo?.requests?.[0];

//   if (!fileInfo?.file_id || !uploadRequest?.url) {
//     throw new Error("YouCam did not return the required upload details.");
//   }

//   // 2. Upload the actual image bytes to the presigned URL.
//   const uploadHeaders = {
//     ...(uploadRequest.headers || {}),
//   };

//   const uploadResponse = await fetch(uploadRequest.url, {
//     method: uploadRequest.method || "PUT",
//     headers: uploadHeaders,
//     body: file.buffer,
//   });

//   if (!uploadResponse.ok) {
//     throw new Error(
//       `Image upload failed with status ${uploadResponse.status}`
//     );
//   }

//   return fileInfo.file_id;
// }

// async function startSkinAnalysis(fileId) {
//   const payload = await youCamRequest(
//     `${BASE_URL}/task/skin-analysis`,
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         src_file_id: fileId,
//         dst_actions: SD_CONCERNS,
//         format: "json",
//         miniserver_args: {
//           enable_mask_overlay: true,
//         },
//         pf_camera_kit: false,
//       }),
//     }
//   );

//   const taskId = payload?.data?.task_id;

//   if (!taskId) {
//     throw new Error("YouCam did not return a task ID.");
//   }

//   return taskId;
// }

// const sleep = (ms) =>
//   new Promise((resolve) => setTimeout(resolve, ms));

// async function waitForResults(taskId) {
//   const maxAttempts = 90;
//   const intervalMs = 2000;

//   for (let attempt = 0; attempt < maxAttempts; attempt++) {
//     const payload = await youCamRequest(
//       `${BASE_URL}/task/skin-analysis/${encodeURIComponent(taskId)}`,
//       { method: "GET" }
//     );

//     const taskStatus = payload?.data?.task_status;

//     if (taskStatus === "success") {
//       return payload?.data?.results;
//     }

//     if (taskStatus === "error") {
//       throw new Error("YouCam could not process this image.");
//     }

//     await sleep(intervalMs);
//   }

//   throw new Error(
//     "Analysis is taking too long. Please try again with another image."
//   );
// }

// router.post("/", (req, res, next) => {
//   upload.single("image")(req, res, (error) => {
//     if (error) {
//       return res.status(400).json({
//         message: error.message || "Invalid image upload.",
//       });
//     }

//     next();
//   });
// }, async (req, res) => {
//   try {
//     if (!process.env.YOUCAM_API_KEY) {
//       return res.status(500).json({
//         message: "YouCam API key is not configured on the backend.",
//       });
//     }

//     if (!req.file) {
//       return res.status(400).json({
//         message: "Please upload a JPG or PNG image.",
//       });
//     }

//     // Check basic file size and type before sending to YouCam.
//     if (req.file.size === 0) {
//       return res.status(400).json({
//         message: "The uploaded image is empty.",
//       });
//     }

//     const fileId = await uploadImageToYouCam(req.file);
//     const taskId = await startSkinAnalysis(fileId);
//     const results = await waitForResults(taskId);

//     return res.status(200).json({
//       status: "success",
//       message: "Skin analysis completed.",
//       results,
//     });
//   } catch (error) {
//     console.error("Skin analysis failed:", error.message);

//     return res.status(error.status === 401 ? 502 : 502).json({
//       message:
//         error.status === 401
//           ? "YouCam authentication failed. Check the API key."
//           : error.message || "Skin analysis failed. Please try again.",
//     });
//   }
// });

// export default router;
