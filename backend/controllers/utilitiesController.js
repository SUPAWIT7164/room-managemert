const { pool } = require('../config/database');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatLocalDateYYYYMMDD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatLocalDateTimeEndOfDay(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T23:59:59.999`;
}

class UtilitiesController {
  /**
   * GET /api/utilities/expenses
   * Query:
   * - period=week|month|year
   * - year=YYYY (optional)
   * - month=1..12 (optional; used when period=month)
   * - week=unused (reserved)
   *
   * Returns daily usage totals:
   * - electricity_kwh: SUM over devices of (MAX(energy) - MIN(energy)) per day
   * - water_m3:        SUM over devices of (MAX(totalizer) - MIN(totalizer)) per day
   */
  async getExpenses(req, res) {
    try {
      const { period, year, month } = req.query;

      const now = new Date();
      const y = parseInt(year, 10) || now.getFullYear();
      const m = parseInt(month, 10);

      let startDate;
      let endDate;

      if (period === 'year') {
        startDate = new Date(y, 0, 1, 0, 0, 0, 0);
        endDate = new Date(y, 11, 31, 23, 59, 59, 999);
      } else if (period === 'month') {
        const monthIdx = Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();
        startDate = new Date(y, monthIdx, 1, 0, 0, 0, 0);
        endDate = new Date(y, monthIdx + 1, 0, 23, 59, 59, 999);
      } else if (period === 'week') {
        // Align with UI "รายสัปดาห์": rolling last 7 days including today (local)
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
      } else {
        // Default: month-like (last 30 days including today)
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
      }

      const startDateStr = formatLocalDateYYYYMMDD(startDate);
      const endDateStr = formatLocalDateYYYYMMDD(endDate);
      const startDateTimeStr = `${startDateStr}T00:00:00.000`;
      const endDateTimeStr = formatLocalDateTimeEndOfDay(endDate);

      const query = `
        WITH dates AS (
          SELECT CAST(? AS date) AS d
          UNION ALL
          SELECT DATEADD(day, 1, d) FROM dates WHERE d < CAST(? AS date)
        ),
        elec_device_day AS (
          SELECT
            CAST(ed.recorded_at AS date) AS d,
            ed.device_id,
            (MAX(CAST(ed.energy AS float)) - MIN(CAST(ed.energy AS float))) AS usage_kwh
          FROM energy_data ed
          WHERE ed.recorded_at >= ?
            AND ed.recorded_at <= ?
            AND ed.energy IS NOT NULL
          GROUP BY CAST(ed.recorded_at AS date), ed.device_id
        ),
        elec_day AS (
          SELECT d, SUM(CASE WHEN usage_kwh < 0 THEN 0 ELSE usage_kwh END) AS usage_kwh
          FROM elec_device_day
          GROUP BY d
        ),
        water_device_day AS (
          SELECT
            CAST(wm.recorded_at AS date) AS d,
            wm.device_id,
            (MAX(CAST(wm.totalizer AS float)) - MIN(CAST(wm.totalizer AS float))) AS usage_m3
          FROM watermeter_data wm
          WHERE wm.recorded_at >= ?
            AND wm.recorded_at <= ?
            AND wm.totalizer IS NOT NULL
          GROUP BY CAST(wm.recorded_at AS date), wm.device_id
        ),
        water_day AS (
          SELECT d, SUM(CASE WHEN usage_m3 < 0 THEN 0 ELSE usage_m3 END) AS usage_m3
          FROM water_device_day
          GROUP BY d
        )
        SELECT
          dates.d AS [date],
          COALESCE(elec_day.usage_kwh, 0) AS electricity_kwh,
          COALESCE(water_day.usage_m3, 0) AS water_m3
        FROM dates
        LEFT JOIN elec_day ON elec_day.d = dates.d
        LEFT JOIN water_day ON water_day.d = dates.d
        ORDER BY dates.d ASC
        OPTION (MAXRECURSION 4000);
      `;

      const [rows] = await pool.query(query, [
        startDateStr,
        endDateStr,
        startDateTimeStr,
        endDateTimeStr,
        startDateTimeStr,
        endDateTimeStr,
      ]);

      res.json({
        success: true,
        data: {
          records: rows || [],
          period: {
            start: startDateTimeStr,
            end: endDateTimeStr,
          },
        },
      });
    } catch (error) {
      console.error('[UtilitiesController] Error getting expenses:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลค่าใช้จ่ายสาธารณูปโภค',
        error: error.message,
      });
    }
  }
}

module.exports = new UtilitiesController();

