using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Dapper;
using API_ATF_MOBILE.Models;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/energy")]
    public class EnergyController : ControllerBase
    {
        private readonly string _connStr;

        public EnergyController(IConfiguration config)
        {
            _connStr = config.GetConnectionString("SqlAiAtr")
                       ?? throw new InvalidOperationException("ConnectionStrings:SqlAiAtr manquante");
        }

        // ===================== SNAPSHOTS =====================

        [HttpGet("tr1/snapshot")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySnapshotDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<EnergySnapshotDto>> GetTr1Snapshot()
        {
            using var db = new SqlConnection(_connStr);

            var row = await db.QueryFirstOrDefaultAsync<SnapshotRow>(@"
                SELECT ts_utc, p_kw, q_kvar, pf,
                       u1_v, u2_v, u3_v,
                       i1_a, i2_a, i3_a,
                       e_kwh
                FROM dbo.ENERGY_SNAPSHOT
                WHERE tr_id = 1");

            if (row is null) return NotFound();

            // Fallbacks si champs snapshot manquants
            if (row.q_kvar is null)
                row.q_kvar = await GetReactiveSnapshotAsync(db, trId: 1);
            if (row.pf is null)
                row.pf = await GetPowerFactorSnapshotAsync(db, trId: 1);

            return Ok(MapToSnapshotDto(row));
        }

        [HttpGet("tr2/snapshot")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySnapshotDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<EnergySnapshotDto>> GetTr2Snapshot()
        {
            using var db = new SqlConnection(_connStr);

            var row = await db.QueryFirstOrDefaultAsync<SnapshotRow>(@"
                SELECT ts_utc, p_kw, q_kvar, pf,
                       u1_v, u2_v, u3_v,
                       i1_a, i2_a, i3_a,
                       e_kwh
                FROM dbo.ENERGY_SNAPSHOT
                WHERE tr_id = 2");

            if (row is null) return NotFound();

            // Fallbacks si champs snapshot manquants
            if (row.q_kvar is null)
                row.q_kvar = await GetReactiveSnapshotAsync(db, trId: 2);
            if (row.pf is null)
                row.pf = await GetPowerFactorSnapshotAsync(db, trId: 2);

            return Ok(MapToSnapshotDto(row));
        }

        private static EnergySnapshotDto MapToSnapshotDto(SnapshotRow r) => new()
        {
            Ts = r.ts_utc,
            P_Kw = r.p_kw,
            Q_Kvar = r.q_kvar,
            Pf = r.pf,
            U12_V = r.u1_v,
            U23_V = r.u2_v,
            U31_V = r.u3_v,
            I1_A = r.i1_a,
            I2_A = r.i2_a,
            I3_A = r.i3_a,
            E_Kwh = r.e_kwh
        };

        // Dernière valeur de puissance réactive
        private static async Task<decimal?> GetReactiveSnapshotAsync(SqlConnection db, int trId)
        {
            string pid = trId == 1 ? "OPC.ENERGIE.TR1_PUISSANCE_REAC"
                                   : "OPC.ENERGIE.TR2_PUISSANCE_REAC";

            return await db.ExecuteScalarAsync<decimal?>(@"
                SELECT TOP (1) CAST([_VAL] AS decimal(18,6))
                FROM dbo.DATA_LOG
                WHERE point_id = @pid
                ORDER BY [timestamp] DESC", new { pid });
        }

        // Dernière valeur de facteur de puissance (PF) – on accepte plusieurs alias
        private static async Task<decimal?> GetPowerFactorSnapshotAsync(SqlConnection db, int trId)
        {
            // Aliases probables (on couvre francais/anglais/_PF)
            string like1 = trId == 1 ? "OPC.ENERGIE.TR1%FACTEUR%PUISSANCE%" : "OPC.ENERGIE.TR2%FACTEUR%PUISSANCE%";
            string like2 = trId == 1 ? "OPC.ENERGIE.TR1%POWER%FACTOR%" : "OPC.ENERGIE.TR2%POWER%FACTOR%";
            string like3 = trId == 1 ? "OPC.ENERGIE.TR1%_PF%" : "OPC.ENERGIE.TR2%_PF%";

            return await db.ExecuteScalarAsync<decimal?>(@"
                SELECT TOP (1) CAST([_VAL] AS decimal(18,6))
                FROM dbo.DATA_LOG
                WHERE point_id LIKE @like1 OR point_id LIKE @like2 OR point_id LIKE @like3
                ORDER BY [timestamp] DESC", new { like1, like2, like3 });
        }

        // ===================== SERIES =====================

        /// <summary>
        /// Historique TR1.
        /// minutes=60 (1..1440), maxPoints=10000,
        /// agg= (vide)=> brut, agg=second => moyenne/seconde, agg=minute => moyenne/minute,
        /// downsample=false => pas de LTTB.
        /// </summary>
        [HttpGet("tr1/series")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySeriesDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetTr1Series(
            [FromQuery] int minutes = 60,
            [FromQuery] int maxPoints = 1000,
            [FromQuery] string? agg = null,
            [FromQuery] bool downsample = false)
        {
            return await GetSeriesInternal(trId: 1, minutes, maxPoints, agg, downsample);
        }

        /// <summary>
        /// Historique TR2. Voir TR1.
        /// </summary>
        [HttpGet("tr2/series")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySeriesDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetTr2Series(
            [FromQuery] int minutes = 60,
            [FromQuery] int maxPoints = 1000,
            [FromQuery] string? agg = null,
            [FromQuery] bool downsample = false)
        {
            return await GetSeriesInternal(trId: 2, minutes, maxPoints, agg, downsample);
        }

        private async Task<IActionResult> GetSeriesInternal(int trId, int minutes, int maxPoints, string? agg, bool downsample)
        {
            minutes = Math.Clamp(minutes, 1, 1440);
            maxPoints = Math.Max(100, Math.Min(maxPoints, 10000));

            var aggVal = (agg ?? "").Trim().ToLowerInvariant();
            bool aggregateMinute = aggVal == "minute";
            bool aggregateSecond = aggVal == "second";

            string sql = BuildSeriesQuery(trId, aggregateMinute, aggregateSecond);

            using var db = new SqlConnection(_connStr);
            var rows = await db.QueryAsync<DataLogRow>(sql, new { min = minutes });

            var dto = MapSeries(rows, trId);

            if (downsample)
                ApplyDownsample(dto, maxPoints);

            return Ok(dto);
        }

        // --- SQL builder: brut / agrégé seconde / agrégé minute ---
        private static string BuildSeriesQuery(int trId, bool aggregateMinute, bool aggregateSecond)
        {
            string trLike = trId == 1 ? "OPC.ENERGIE.TR1%" : "OPC.ENERGIE.TR2%";
            string kwhPoint = trId == 1 ? "OPC.ENERGIE.DB10.DBD0" : "OPC.ENERGIE.DB10.DBD4";

            if (aggregateMinute)
            {
                return $@"
WITH buckets AS (
    SELECT
        DATEADD(minute, DATEDIFF(minute, 0, [timestamp]), 0) AS ts_utc,
        point_id,
        AVG(CAST([_VAL] AS float)) AS val
    FROM dbo.DATA_LOG
    WHERE [timestamp] >= DATEADD(MINUTE, -@min, SYSUTCDATETIME())
      AND (point_id LIKE '{trLike}' OR point_id = '{kwhPoint}')
    GROUP BY DATEADD(minute, DATEDIFF(minute, 0, [timestamp]), 0), point_id
)
SELECT ts_utc, point_id, CAST(val AS decimal(18,6)) AS val
FROM buckets
ORDER BY ts_utc ASC";
            }
            if (aggregateSecond)
            {
                return $@"
WITH buckets AS (
    SELECT
        DATEADD(second, DATEDIFF(second, 0, [timestamp]), 0) AS ts_utc,
        point_id,
        AVG(CAST([_VAL] AS float)) AS val
    FROM dbo.DATA_LOG
    WHERE [timestamp] >= DATEADD(MINUTE, -@min, SYSUTCDATETIME())
      AND (point_id LIKE '{trLike}' OR point_id = '{kwhPoint}')
    GROUP BY DATEADD(second, DATEDIFF(second, 0, [timestamp]), 0), point_id
)
SELECT ts_utc, point_id, CAST(val AS decimal(18,6)) AS val
FROM buckets
ORDER BY ts_utc ASC";
            }

            // BRUT
            return $@"
SELECT [timestamp] AS ts_utc, point_id, [_VAL] AS val
FROM dbo.DATA_LOG
WHERE [timestamp] >= DATEADD(MINUTE, -@min, SYSUTCDATETIME())
  AND (point_id LIKE '{trLike}' OR point_id = '{kwhPoint}')
ORDER BY [timestamp] ASC";
        }

        // --- Helpers tensions ---
        private static readonly decimal Rt3 = (decimal)Math.Sqrt(3);
        private static decimal ToPhasePhase(decimal v) => v < 300m ? v * Rt3 : v;

        // --- mapping rows -> DTO séries ---
        private EnergySeriesDto MapSeries(IEnumerable<DataLogRow> rows, int trId)
        {
            var dto = new EnergySeriesDto();

            foreach (var r in rows)
            {
                var id = r.point_id?.ToUpperInvariant() ?? string.Empty;

                if (id.Contains("PUISSANCE_ACTIVE"))
                {
                    dto.P_Kw.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val });
                    continue;
                }

                // Puissance réactive -> Q_Kvar
                if (id.Contains("PUISSANCE_REAC"))
                {
                    dto.Q_Kvar.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val });
                    continue;
                }

                // Facteur de puissance -> PF (aliases: FACTEUR_PUISSANCE, POWER_FACTOR, _PF)
                if (id.Contains("FACTEUR") && id.Contains("PUISSANCE")
                   || id.Contains("POWER") && id.Contains("FACTOR")
                   || id.EndsWith("_PF"))
                {
                    dto.Pf.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val });
                    continue;
                }

                // Tensions U12/U23/U31 natifs
                if (id.Contains("TENSION_U12")) { dto.U12_V.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("TENSION_U23")) { dto.U23_V.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("TENSION_U31")) { dto.U31_V.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }

                // L1/L2/L3 : convertir UNIQUEMENT si on détecte du L-N (<300V)
                if (id.Contains("TENSION_L1")) { dto.U12_V.Add(new EnergyPointDto { X = r.ts_utc, Y = ToPhasePhase(r.val) }); continue; }
                if (id.Contains("TENSION_L2")) { dto.U23_V.Add(new EnergyPointDto { X = r.ts_utc, Y = ToPhasePhase(r.val) }); continue; }
                if (id.Contains("TENSION_L3")) { dto.U31_V.Add(new EnergyPointDto { X = r.ts_utc, Y = ToPhasePhase(r.val) }); continue; }

                // Courants
                if (id.Contains("COURANT_L1")) { dto.I1_A.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("COURANT_L2")) { dto.I2_A.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("COURANT_L3")) { dto.I3_A.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }

                // Énergie kWh (compteur)
                if ((trId == 1 && id == "OPC.ENERGIE.DB10.DBD0") || (trId == 2 && id == "OPC.ENERGIE.DB10.DBD4"))
                {
                    dto.E_Kwh.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val });
                    continue;
                }
            }

            return dto;
        }

        // --- Downsample (LTTB) appliqué à chaque série si demandé ---
        private static void ApplyDownsample(EnergySeriesDto dto, int maxPoints)
        {
            dto.P_Kw = Lttb(dto.P_Kw, maxPoints);
            dto.Q_Kvar = Lttb(dto.Q_Kvar, maxPoints);
            dto.Pf = Lttb(dto.Pf, maxPoints);
            dto.U12_V = Lttb(dto.U12_V, maxPoints);
            dto.U23_V = Lttb(dto.U23_V, maxPoints);
            dto.U31_V = Lttb(dto.U31_V, maxPoints);
            dto.I1_A = Lttb(dto.I1_A, maxPoints);
            dto.I2_A = Lttb(dto.I2_A, maxPoints);
            dto.I3_A = Lttb(dto.I3_A, maxPoints);
            dto.E_Kwh = Lttb(dto.E_Kwh, maxPoints);
        }

        // LTTB pour (x = DateTime, y = decimal)
        private static List<EnergyPointDto> Lttb(List<EnergyPointDto> data, int threshold)
        {
            if (data == null || data.Count <= threshold) return data ?? new();
            if (threshold < 3) threshold = 3;

            var src = data.Select(p => (X: p.X.Ticks, Y: (double)p.Y)).ToList();
            var sampled = new List<(long X, double Y)>(threshold) { src[0] };

            double bucketSize = (src.Count - 2d) / (threshold - 2);
            int a = 0;

            for (int i = 0; i < threshold - 2; i++)
            {
                int rangeStart = (int)Math.Floor((i + 1) * bucketSize) + 1;
                int rangeEnd = (int)Math.Floor((i + 2) * bucketSize) + 1;
                rangeEnd = Math.Min(rangeEnd, src.Count);

                double avgX = 0, avgY = 0;
                int avgCount = rangeEnd - rangeStart;
                if (avgCount <= 0) continue;
                for (int j = rangeStart; j < rangeEnd; j++) { avgX += src[j].X; avgY += src[j].Y; }
                avgX /= avgCount; avgY /= avgCount;

                int rangeOffs = (int)Math.Floor(i * bucketSize) + 1;
                int rangeTo = (int)Math.Floor((i + 1) * bucketSize) + 1;
                rangeTo = Math.Min(rangeTo, src.Count);

                long ax = src[a].X; double ay = src[a].Y;
                double maxArea = -1; int nextA = rangeOffs;

                for (int k = rangeOffs; k < rangeTo; k++)
                {
                    double area =
                        Math.Abs((ax - avgX) * (src[k].Y - ay) -
                                 (ax - src[k].X) * (avgY - ay)) * 0.5;
                    if (area > maxArea) { maxArea = area; nextA = k; }
                }
                sampled.Add(src[nextA]);
                a = nextA;
            }

            sampled.Add(src[^1]);

            return sampled.Select(p => new EnergyPointDto { X = new DateTime(p.X), Y = (decimal)p.Y }).ToList();
        }

        // ===================== CLASSES DAPPER =====================

        private class SnapshotRow
        {
            public DateTime ts_utc { get; set; }
            public decimal? p_kw { get; set; }
            public decimal? q_kvar { get; set; }
            public decimal? pf { get; set; }
            public decimal? u1_v { get; set; }
            public decimal? u2_v { get; set; }
            public decimal? u3_v { get; set; }
            public decimal? i1_a { get; set; }
            public decimal? i2_a { get; set; }
            public decimal? i3_a { get; set; }
            public decimal? e_kwh { get; set; }
        }

        private class DataLogRow
        {
            public DateTime ts_utc { get; set; }
            public string point_id { get; set; } = string.Empty;
            public decimal val { get; set; }
        }
    }
}