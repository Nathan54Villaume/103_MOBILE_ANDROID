using API_ATF_MOBILE.Services;
using Microsoft.AspNetCore.Mvc;

namespace API_ATF_MOBILE.Controllers;

/// <summary>
/// Contrôleur pour la gestion de l'acquisition DIRIS
/// </summary>
[ApiController]
[Route("api/diris/acquisition")]
public class DirisAcquisitionController : ControllerBase
{
    private readonly DirisAcquisitionControlService _controlService;
    private readonly ILogger<DirisAcquisitionController> _logger;

    public DirisAcquisitionController(
        DirisAcquisitionControlService controlService,
        ILogger<DirisAcquisitionController> logger)
    {
        _controlService = controlService;
        _logger = logger;
    }

    /// <summary>
    /// Obtenir le statut de l'acquisition
    /// </summary>
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        try
        {
            var status = _controlService.GetStatus();
            return Ok(new
            {
                success = true,
                data = status
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting acquisition status");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to get acquisition status",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Démarrer l'acquisition
    /// </summary>
    [HttpPost("start")]
    public async Task<IActionResult> StartAcquisition()
    {
        try
        {
            _logger.LogInformation("Starting DIRIS acquisition via API");
            
            var success = await _controlService.StartAcquisitionAsync();
            
            if (success)
            {
                return Ok(new
                {
                    success = true,
                    message = "DIRIS acquisition started successfully",
                    data = _controlService.GetStatus()
                });
            }
            else
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Failed to start DIRIS acquisition"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting acquisition");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to start acquisition",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Arrêter l'acquisition
    /// </summary>
    [HttpPost("stop")]
    public async Task<IActionResult> StopAcquisition()
    {
        try
        {
            _logger.LogInformation("Stopping DIRIS acquisition via API");
            
            var success = await _controlService.StopAcquisitionAsync();
            
            if (success)
            {
                return Ok(new
                {
                    success = true,
                    message = "DIRIS acquisition stopped successfully",
                    data = _controlService.GetStatus()
                });
            }
            else
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Failed to stop DIRIS acquisition"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping acquisition");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to stop acquisition",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Redémarrer l'acquisition (stop puis start)
    /// </summary>
    [HttpPost("restart")]
    public async Task<IActionResult> RestartAcquisition()
    {
        try
        {
            _logger.LogInformation("Restarting DIRIS acquisition via API");
            
            // Arrêter d'abord
            await _controlService.StopAcquisitionAsync();
            await Task.Delay(1000); // Pause d'1 seconde
            
            // Puis redémarrer
            var success = await _controlService.StartAcquisitionAsync();
            
            if (success)
            {
                return Ok(new
                {
                    success = true,
                    message = "DIRIS acquisition restarted successfully",
                    data = _controlService.GetStatus()
                });
            }
            else
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Failed to restart DIRIS acquisition"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restarting acquisition");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to restart acquisition",
                error = ex.Message
            });
        }
    }
}
