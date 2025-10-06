using Diris.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

namespace Diris.Server.Controllers;

/// <summary>
/// Readings API controller for time series data
/// </summary>
[ApiController]
[Route("api/readings")]
public class ReadingsController : ControllerBase
{
    private readonly IDeviceRegistry _deviceRegistry;
    private readonly ILogger<ReadingsController> _logger;
    private readonly string? _connectionString;

    public ReadingsController(
        IDeviceRegistry deviceRegistry,
        ILogger<ReadingsController> logger,
        IConfiguration configuration)
    {
        _deviceRegistry = deviceRegistry;
        _logger = logger;
        _connectionString = configuration.GetConnectionString("SqlAiAtr");
    }

    /// <summary>
    /// Queries time series data
    /// </summary>
    [HttpGet("query")]
    public async Task<IActionResult> QueryReadings(
        [FromQuery] int? deviceId = null,
        [FromQuery] string? signal = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? downsample = null)
    {
        try
        {
            if (string.IsNullOrEmpty(_connectionString))
            {
                return Ok(new { data = new object[0], deviceId = deviceId, unit = "", message = "Database not configured" });
            }
            var fromDate = from ?? DateTime.UtcNow.AddHours(-1);
            var toDate = to ?? DateTime.UtcNow;

            var sql = @"
                SELECT m.DeviceId, d.Name as DeviceName, m.Signal, m.Value, m.Quality, m.UtcTs, tm.Unit
                FROM DIRIS.Measurements m
                INNER JOIN DIRIS.Devices d ON m.DeviceId = d.DeviceId
                LEFT JOIN DIRIS.TagMap tm ON m.DeviceId = tm.DeviceId AND m.Signal = tm.Signal
                WHERE m.UtcTs >= @FromDate AND m.UtcTs <= @ToDate";

            var parameters = new List<SqlParameter>
            {
                new("@FromDate", fromDate),
                new("@ToDate", toDate)
            };

            if (deviceId.HasValue)
            {
                sql += " AND m.DeviceId = @DeviceId";
                parameters.Add(new("@DeviceId", deviceId.Value));
            }

            if (!string.IsNullOrEmpty(signal))
            {
                sql += " AND m.Signal = @Signal";
                parameters.Add(new("@Signal", signal));
            }

            sql += " ORDER BY m.UtcTs";

            // Apply downsampling if requested
            if (!string.IsNullOrEmpty(downsample))
            {
                sql = ApplyDownsampling(sql, downsample);
            }

            var data = await ExecuteQueryAsync(sql, parameters.ToArray());

            var result = new
            {
                DeviceId = deviceId,
                Signal = signal,
                Unit = data.FirstOrDefault()?.Unit,
                From = fromDate,
                To = toDate,
                Data = data.Select(d => new
                {
                    Timestamp = d.UtcTs,
                    Value = d.Value,
                    Quality = d.Quality
                }).ToList(),
                Count = data.Count
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error querying readings");
            return StatusCode(500, "Error querying readings");
        }
    }

    /// <summary>
    /// Gets the latest values for all signals
    /// </summary>
    [HttpGet("latest")]
    public async Task<IActionResult> GetLatestValues([FromQuery] int? deviceId = null)
    {
        try
        {
            if (string.IsNullOrEmpty(_connectionString))
            {
                return Ok(new { signals = new object[0], message = "Database not configured" });
            }
            var sql = @"
                SELECT d.DeviceId, d.Name as DeviceName, m.Signal, m.Value, m.Quality, m.UtcTs, tm.Unit
                FROM DIRIS.Devices d
                INNER JOIN (
                    SELECT DeviceId, Signal, Value, Quality, UtcTs,
                           ROW_NUMBER() OVER (PARTITION BY DeviceId, Signal ORDER BY UtcTs DESC) as rn
                    FROM DIRIS.Measurements
                ) m ON d.DeviceId = m.DeviceId AND m.rn = 1
                LEFT JOIN DIRIS.TagMap tm ON d.DeviceId = tm.DeviceId AND m.Signal = tm.Signal
                WHERE d.Enabled = 1";

            var parameters = new List<SqlParameter>();

            if (deviceId.HasValue)
            {
                sql += " AND d.DeviceId = @DeviceId";
                parameters.Add(new("@DeviceId", deviceId.Value));
            }

            sql += " ORDER BY d.Name, m.Signal";

            var data = await ExecuteQueryAsync(sql, parameters.ToArray());

            var result = data.GroupBy(d => new { d.DeviceId, d.DeviceName })
                .Select(g => new
                {
                    DeviceId = g.Key.DeviceId,
                    DeviceName = g.Key.DeviceName,
                    Signals = g.Select(s => new
                    {
                        Signal = s.Signal,
                        Value = s.Value,
                        Unit = s.Unit,
                        Quality = s.Quality,
                        Timestamp = s.UtcTs
                    }).ToList()
                }).ToList();

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting latest values");
            return StatusCode(500, "Error getting latest values");
        }
    }

    private async Task<List<dynamic>> ExecuteQueryAsync(string sql, SqlParameter[] parameters)
    {
        var results = new List<dynamic>();

        if (string.IsNullOrEmpty(_connectionString))
        {
            return results;
        }

        using var connection = new SqlConnection(_connectionString);
        using var command = new SqlCommand(sql, connection) { CommandTimeout = 30 };
        command.Parameters.AddRange(parameters);

        await connection.OpenAsync();
        using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            results.Add(new
            {
                DeviceId = reader.GetInt32("DeviceId"),
                DeviceName = reader.GetString("DeviceName"),
                Signal = reader.GetString("Signal"),
                Value = reader.GetDouble("Value"),
                Quality = reader.GetByte("Quality"),
                UtcTs = reader.GetDateTime("UtcTs"),
                Unit = reader.IsDBNull("Unit") ? null : reader.GetString("Unit")
            });
        }

        return results;
    }

    private static string ApplyDownsampling(string sql, string downsample)
    {
        // Simple downsampling implementation
        // In production, you'd want more sophisticated downsampling
        return downsample.ToLower() switch
        {
            "1m" or "1min" => sql.Replace("ORDER BY m.UtcTs", "GROUP BY m.DeviceId, d.Name, m.Signal, tm.Unit, DATEPART(year, m.UtcTs), DATEPART(month, m.UtcTs), DATEPART(day, m.UtcTs), DATEPART(hour, m.UtcTs), DATEPART(minute, m.UtcTs) ORDER BY MIN(m.UtcTs)"),
            "5m" or "5min" => sql.Replace("ORDER BY m.UtcTs", "GROUP BY m.DeviceId, d.Name, m.Signal, tm.Unit, DATEPART(year, m.UtcTs), DATEPART(month, m.UtcTs), DATEPART(day, m.UtcTs), DATEPART(hour, m.UtcTs), (DATEPART(minute, m.UtcTs) / 5) * 5 ORDER BY MIN(m.UtcTs)"),
            "1h" or "1hour" => sql.Replace("ORDER BY m.UtcTs", "GROUP BY m.DeviceId, d.Name, m.Signal, tm.Unit, DATEPART(year, m.UtcTs), DATEPART(month, m.UtcTs), DATEPART(day, m.UtcTs), DATEPART(hour, m.UtcTs) ORDER BY MIN(m.UtcTs)"),
            _ => sql
        };
    }
}
