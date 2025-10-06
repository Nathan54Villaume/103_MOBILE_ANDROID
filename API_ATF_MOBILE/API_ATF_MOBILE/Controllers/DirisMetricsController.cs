using Diris.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_ATF_MOBILE.Controllers;

/// <summary>
/// DIRIS Metrics API controller
/// </summary>
[ApiController]
[Route("api/diris/metrics")]
public class DirisMetricsController : ControllerBase
{
    private readonly ISystemMetricsCollector _metricsCollector;

    public DirisMetricsController(ISystemMetricsCollector metricsCollector)
    {
        _metricsCollector = metricsCollector;
    }

    /// <summary>
    /// Gets current system metrics
    /// </summary>
    [HttpGet("system")]
    public IActionResult GetSystemMetrics()
    {
        var metrics = _metricsCollector.GetCurrentMetrics();
        return Ok(metrics);
    }

    /// <summary>
    /// Gets current acquisition metrics
    /// </summary>
    [HttpGet("acquisition")]
    public IActionResult GetAcquisitionMetrics()
    {
        var metrics = _metricsCollector.GetAcquisitionMetrics();
        return Ok(metrics);
    }

    /// <summary>
    /// Gets throughput rate
    /// </summary>
    [HttpGet("throughput")]
    public IActionResult GetThroughputRate()
    {
        var rate = _metricsCollector.GetThroughputRate();
        return Ok(new { PointsPerSecond = rate });
    }
}

