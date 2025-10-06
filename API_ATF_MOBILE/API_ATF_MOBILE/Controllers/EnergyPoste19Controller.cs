using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Dapper;
using API_ATF_MOBILE.Models;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/energy_Poste_19")]
    public class EnergyPoste19Controller : ControllerBase
    {
        private readonly string _connStr;

        public EnergyPoste19Controller(IConfiguration config)
        {
            _connStr = config.GetConnectionString("SqlAiAtr")
                         ?? throw new InvalidOperationException("ConnectionStrings:SqlAiAtr manquante");
        }

        // Record pour les descripteurs de signaux
        private record SignalDescriptor(string Id, string Label, string? Unit);

        [HttpGet("signals")]
        public IActionResult GetSignals()
        {
            var signals = new List<SignalDescriptor>
            {
                // TR1 - Poste 19
                new("P_TR1", "Puissance active — TR1", "kW"),
                new("Q_TR1", "Puissance réactive — TR1", "kvar"),
                new("U12_TR1", "U12 — TR1", "V"),
                new("U23_TR1", "U23 — TR1", "V"),
                new("U31_TR1", "U31 — TR1", "V"),
                new("PF_TR1", "Facteur de puissance — TR1", null),
                
                // TR2 - Poste 19
                new("P_TR2", "Puissance active — TR2", "kW"),
                new("Q_TR2", "Puissance réactive — TR2", "kvar"),
                new("U12_TR2", "U12 — TR2", "V"),
                new("U23_TR2", "U23 — TR2", "V"),
                new("U31_TR2", "U31 — TR2", "V"),
                new("PF_TR2", "Facteur de puissance — TR2", null),
                
                // TR3 - Poste 19
                new("P_TR3", "Puissance active — TR3", "kW"),
                new("Q_TR3", "Puissance réactive — TR3", "kvar"),
                new("U12_TR3", "U12 — TR3", "V"),
                new("U23_TR3", "U23 — TR3", "V"),
                new("U31_TR3", "U31 — TR3", "V"),
                new("PF_TR3", "Facteur de puissance — TR3", null),
                
                // TR4 - Poste 19
                new("P_TR4", "Puissance active — TR4", "kW"),
                new("Q_TR4", "Puissance réactive — TR4", "kvar"),
                new("U12_TR4", "U12 — TR4", "V"),
                new("U23_TR4", "U23 — TR4", "V"),
                new("U31_TR4", "U31 — TR4", "V"),
                new("PF_TR4", "Facteur de puissance — TR4", null),
                
                // TR5 - Poste 19
                new("P_TR5", "Puissance active — TR5", "kW"),
                new("Q_TR5", "Puissance réactive — TR5", "kvar"),
                new("U12_TR5", "U12 — TR5", "V"),
                new("U23_TR5", "U23 — TR5", "V"),
                new("U31_TR5", "U31 — TR5", "V"),
                new("PF_TR5", "Facteur de puissance — TR5", null)
            };

            return Ok(signals);
        }

        // ===================== SNAPSHOTS =====================

        [HttpGet("tr1/snapshot")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySnapshotDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<EnergySnapshotDto>> GetTr1Snapshot()
        {
            return await GetTransformerSnapshot(1);
        }

        [HttpGet("tr2/snapshot")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySnapshotDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<EnergySnapshotDto>> GetTr2Snapshot()
        {
            return await GetTransformerSnapshot(2);
        }

        [HttpGet("tr3/snapshot")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySnapshotDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<EnergySnapshotDto>> GetTr3Snapshot()
        {
            return await GetTransformerSnapshot(3);
        }

        [HttpGet("tr4/snapshot")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySnapshotDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<EnergySnapshotDto>> GetTr4Snapshot()
        {
            return await GetTransformerSnapshot(4);
        }

        [HttpGet("tr5/snapshot")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySnapshotDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<EnergySnapshotDto>> GetTr5Snapshot()
        {
            return await GetTransformerSnapshot(5);
        }

        private async Task<ActionResult<EnergySnapshotDto>> GetTransformerSnapshot(int trId)
        {
            using var db = new SqlConnection(_connStr);

            // TODO: Adapter la requête pour le Poste 19
            // Pour l'instant, on retourne la même structure que le Poste 8
            var row = await db.QueryFirstOrDefaultAsync<SnapshotRow>(@"
                SELECT 
                    ts_utc, p_kw, q_kvar, pf,
                    u1_v, u2_v, u3_v,
                    i1_a, i2_a, i3_a,
                    e_kwh,
                    p_kw_avg, p_kw_max,
                    q_kvar_avg, q_kvar_max,
                    u12_v_avg, u12_v_max,
                    u23_v_avg, u23_v_max,
                    u31_v_avg, u31_v_max,
                    i1_a_avg, i1_a_max,
                    i2_a_avg, i2_a_max,
                    i3_a_avg, i3_a_max
                FROM dbo.ENERGY_SNAPSHOT
                WHERE tr_id = @TrId", new { TrId = trId });

            if (row is null) return NotFound();

            // Fallbacks si champs snapshot manquants
            if (row.q_kvar is null)
                row.q_kvar = await GetReactiveSnapshotAsync(db, trId: trId);
            if (row.pf is null)
                row.pf = await GetPowerFactorSnapshotAsync(db, trId: trId);

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
            E_Kwh = r.e_kwh,
            P_Kw_Avg = r.p_kw_avg,
            P_Kw_Max = r.p_kw_max,
            Q_Kvar_Avg = r.q_kvar_avg,
            Q_Kvar_Max = r.q_kvar_max,
            U12_V_Avg = r.u12_v_avg,
            U12_V_Max = r.u12_v_max,
            U23_V_Avg = r.u23_v_avg,
            U23_V_Max = r.u23_v_max,
            U31_V_Avg = r.u31_v_avg,
            U31_V_Max = r.u31_v_max,
            I1_A_Avg = r.i1_a_avg,
            I1_A_Max = r.i1_a_max,
            I2_A_Avg = r.i2_a_avg,
            I2_A_Max = r.i2_a_max,
            I3_A_Avg = r.i3_a_avg,
            I3_A_Max = r.i3_a_max
        };

        private static async Task<decimal?> GetReactiveSnapshotAsync(SqlConnection db, int trId)
        {
            string pid = $"OPC.ENERGIE.TR{trId}_PUISSANCE_REAC";

            return await db.ExecuteScalarAsync<decimal?>(@"
                SELECT TOP (1) CAST([_VAL] AS decimal(18,6))
                FROM dbo.DATA_LOG
                WHERE point_id = @pid
                ORDER BY [timestamp] DESC", new { pid });
        }

        private static async Task<decimal?> GetPowerFactorSnapshotAsync(SqlConnection db, int trId)
        {
            string like1 = $"OPC.ENERGIE.TR{trId}%FACTEUR%PUISSANCE%";
            string like2 = $"OPC.ENERGIE.TR{trId}%POWER%FACTOR%";
            string like3 = $"OPC.ENERGIE.TR{trId}%_PF%";

            return await db.ExecuteScalarAsync<decimal?>(@"
                SELECT TOP (1) CAST([_VAL] AS decimal(18,6))
                FROM dbo.DATA_LOG
                WHERE point_id LIKE @like1 OR point_id LIKE @like2 OR point_id LIKE @like3
                ORDER BY [timestamp] DESC", new { like1, like2, like3 });
        }

        // ===================== SERIES =====================

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

        [HttpGet("tr3/series")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySeriesDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetTr3Series(
            [FromQuery] int minutes = 60,
            [FromQuery] int maxPoints = 1000,
            [FromQuery] string? agg = null,
            [FromQuery] bool downsample = false)
        {
            return await GetSeriesInternal(trId: 3, minutes, maxPoints, agg, downsample);
        }

        [HttpGet("tr4/series")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySeriesDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetTr4Series(
            [FromQuery] int minutes = 60,
            [FromQuery] int maxPoints = 1000,
            [FromQuery] string? agg = null,
            [FromQuery] bool downsample = false)
        {
            return await GetSeriesInternal(trId: 4, minutes, maxPoints, agg, downsample);
        }

        [HttpGet("tr5/series")]
        [Produces("application/json")]
        [ProducesResponseType(typeof(EnergySeriesDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetTr5Series(
            [FromQuery] int minutes = 60,
            [FromQuery] int maxPoints = 1000,
            [FromQuery] string? agg = null,
            [FromQuery] bool downsample = false)
        {
            return await GetSeriesInternal(trId: 5, minutes, maxPoints, agg, downsample);
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

        private static string BuildSeriesQuery(int trId, bool aggregateMinute, bool aggregateSecond)
        {
            string trLike = $"OPC.ENERGIE.TR{trId}%";
            string kwhPoint = $"OPC.ENERGIE.DB10.DBD{(trId - 1) * 4}"; // Exemple: TR1=DBD0, TR2=DBD4, TR3=DBD8, etc.

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
            return $@"
SELECT [timestamp] AS ts_utc, point_id, [_VAL] AS val
FROM dbo.DATA_LOG
WHERE [timestamp] >= DATEADD(MINUTE, -@min, SYSUTCDATETIME())
    AND (point_id LIKE '{trLike}' OR point_id = '{kwhPoint}')
ORDER BY [timestamp] ASC";
        }

        private static readonly decimal Rt3 = (decimal)Math.Sqrt(3);
        private static decimal ToPhasePhase(decimal v) => v < 300m ? v * Rt3 : v;

        private EnergySeriesDto MapSeries(IEnumerable<DataLogRow> rows, int trId)
        {
            var dto = new EnergySeriesDto();
            foreach (var r in rows)
            {
                var id = r.point_id?.ToUpperInvariant() ?? string.Empty;
                if (id.Contains("PUISSANCE_ACTIVE")) { dto.P_Kw.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("PUISSANCE_REAC")) { dto.Q_Kvar.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("FACTEUR") && id.Contains("PUISSANCE") || id.Contains("POWER") && id.Contains("FACTOR") || id.EndsWith("_PF")) { dto.Pf.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("TENSION_U12")) { dto.U12_V.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("TENSION_U23")) { dto.U23_V.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("TENSION_U31")) { dto.U31_V.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("TENSION_L1")) { dto.U12_V.Add(new EnergyPointDto { X = r.ts_utc, Y = ToPhasePhase(r.val) }); continue; }
                if (id.Contains("TENSION_L2")) { dto.U23_V.Add(new EnergyPointDto { X = r.ts_utc, Y = ToPhasePhase(r.val) }); continue; }
                if (id.Contains("TENSION_L3")) { dto.U31_V.Add(new EnergyPointDto { X = r.ts_utc, Y = ToPhasePhase(r.val) }); continue; }
                if (id.Contains("COURANT_L1")) { dto.I1_A.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("COURANT_L2")) { dto.I2_A.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains("COURANT_L3")) { dto.I3_A.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
                if (id.Contains($"DB10.DBD{(trId - 1) * 4}")) { dto.E_Kwh.Add(new EnergyPointDto { X = r.ts_utc, Y = r.val }); continue; }
            }
            return dto;
        }

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
                    double area = Math.Abs((ax - avgX) * (src[k].Y - ay) - (ax - src[k].X) * (avgY - ay)) * 0.5;
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
            public decimal? p_kw_avg { get; set; }
            public decimal? p_kw_max { get; set; }
            public decimal? q_kvar_avg { get; set; }
            public decimal? q_kvar_max { get; set; }
            public decimal? u12_v_avg { get; set; }
            public decimal? u12_v_max { get; set; }
            public decimal? u23_v_avg { get; set; }
            public decimal? u23_v_max { get; set; }
            public decimal? u31_v_avg { get; set; }
            public decimal? u31_v_max { get; set; }
            public decimal? i1_a_avg { get; set; }
            public decimal? i1_a_max { get; set; }
            public decimal? i2_a_avg { get; set; }
            public decimal? i2_a_max { get; set; }
            public decimal? i3_a_avg { get; set; }
            public decimal? i3_a_max { get; set; }
        }

        private class DataLogRow
        {
            public DateTime ts_utc { get; set; }
            public string point_id { get; set; } = string.Empty;
            public decimal val { get; set; }
        }
    }
}

