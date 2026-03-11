/**
 * Snapshot Image Processor
 * ทำ Image Processing บนภาพ snapshot ที่ดึงจากกล้อง
 * 
 * ฟังก์ชันหลัก:
 *   - resize: ย่อ/ขยายภาพ
 *   - grayscale: แปลงเป็นขาวดำ
 *   - blur: เบลอภาพ
 * 
 * ใช้ sharp library สำหรับ image processing
 * (เตรียมไว้ต่อ AI ภายหลัง)
 */

const fs = require('fs').promises;
const path = require('path');

// ลอง import sharp — ถ้าไม่มีจะใช้ fallback
let sharp = null;
try {
    sharp = require('sharp');
    console.log('[ImageProcessor] sharp loaded successfully');
} catch (e) {
    console.warn('[ImageProcessor] sharp not available — install: npm install sharp');
    console.warn('[ImageProcessor] Image processing จะบันทึกภาพต้นฉบับโดยไม่ process');
}

const PROCESSED_DIR = path.join(__dirname, '../snapshots/processed');

/**
 * ทำ Image Processing: resize → grayscale → blur
 * @param {Buffer} imageBuffer - ภาพต้นฉบับ (JPEG)
 * @param {Object} options - ตัวเลือก
 * @param {number} [options.resizeWidth=640] - ความกว้าง resize (pixels)
 * @param {number} [options.resizeHeight] - ความสูง resize (auto ถ้าไม่กำหนด)
 * @param {boolean} [options.grayscale=true] - แปลงเป็นขาวดำ
 * @param {number} [options.blur=1.5] - ค่า blur (sigma, 0.3–100)
 * @returns {Promise<{ buffer: Buffer, metadata: Object }>}
 */
async function processImage(imageBuffer, options = {}) {
    const {
        resizeWidth = 640,
        resizeHeight = null,
        grayscale = true,
        blur = 1.5,
    } = options;

    const metadata = {
        originalSize: imageBuffer.length,
        processedSize: 0,
        resizeWidth,
        resizeHeight: resizeHeight || 'auto',
        grayscale,
        blur,
        sharpAvailable: !!sharp,
        processedAt: new Date().toISOString(),
    };

    // ถ้าไม่มี sharp → return ภาพต้นฉบับ
    if (!sharp) {
        console.warn('[ImageProcessor] sharp ไม่พร้อม — return ภาพต้นฉบับ');
        metadata.processedSize = imageBuffer.length;
        metadata.warning = 'sharp not installed — no processing applied';
        return { buffer: imageBuffer, metadata };
    }

    try {
        let pipeline = sharp(imageBuffer);

        // 1. Resize
        const resizeOptions = { width: resizeWidth, fit: 'inside' };
        if (resizeHeight) {
            resizeOptions.height = resizeHeight;
        }
        pipeline = pipeline.resize(resizeOptions);
        console.log(`[ImageProcessor] resize: ${resizeWidth}x${resizeHeight || 'auto'}`);

        // 2. Grayscale
        if (grayscale) {
            pipeline = pipeline.grayscale();
            console.log('[ImageProcessor] grayscale: applied');
        }

        // 3. Blur
        if (blur && blur > 0) {
            // sharp blur sigma ต้องอยู่ระหว่าง 0.3 ถึง 1000
            const blurSigma = Math.max(0.3, Math.min(1000, blur));
            pipeline = pipeline.blur(blurSigma);
            console.log(`[ImageProcessor] blur: sigma=${blurSigma}`);
        }

        // Output เป็น JPEG
        pipeline = pipeline.jpeg({ quality: 85 });

        const processedBuffer = await pipeline.toBuffer();
        metadata.processedSize = processedBuffer.length;

        console.log(`[ImageProcessor] Done: ${metadata.originalSize} → ${metadata.processedSize} bytes`);
        return { buffer: processedBuffer, metadata };
    } catch (err) {
        console.error('[ImageProcessor] Processing error:', err.message);
        // fallback: return ภาพต้นฉบับ
        metadata.processedSize = imageBuffer.length;
        metadata.error = err.message;
        return { buffer: imageBuffer, metadata };
    }
}

/**
 * Process และบันทึกภาพลงโฟลเดอร์ processed
 * @param {Buffer} imageBuffer - ภาพต้นฉบับ
 * @param {string} originalFileName - ชื่อไฟล์ต้นฉบับ
 * @param {Object} options - ตัวเลือก image processing
 * @returns {Promise<{ originalPath: string, processedPath: string, metadata: Object }>}
 */
async function processAndSave(imageBuffer, originalFileName, options = {}) {
    // สร้างโฟลเดอร์ processed ถ้ายังไม่มี
    await fs.mkdir(PROCESSED_DIR, { recursive: true });

    // Process ภาพ
    const { buffer: processedBuffer, metadata } = await processImage(imageBuffer, options);

    // สร้างชื่อไฟล์ processed
    const baseName = path.basename(originalFileName, '.jpg');
    const processedFileName = `${baseName}_processed.jpg`;
    const processedFilePath = path.join(PROCESSED_DIR, processedFileName);

    // บันทึกไฟล์
    await fs.writeFile(processedFilePath, processedBuffer);

    // บันทึก metadata
    const metadataFileName = `${baseName}_metadata.json`;
    const metadataFilePath = path.join(PROCESSED_DIR, metadataFileName);
    await fs.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2));

    console.log(`[ImageProcessor] Saved processed: ${processedFilePath}`);

    return {
        originalPath: `/snapshots/${originalFileName}`,
        processedPath: `/snapshots/processed/${processedFileName}`,
        processedFileName,
        metadata,
    };
}

module.exports = {
    processImage,
    processAndSave,
    PROCESSED_DIR,
};










