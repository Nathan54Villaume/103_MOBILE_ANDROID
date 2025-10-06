using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace API_ATF_MOBILE.Services;

/// <summary>
/// Service de contrôle pour l'acquisition DIRIS
/// Permet de démarrer/arrêter l'acquisition via l'API
/// </summary>
public class DirisAcquisitionControlService
{
    private readonly IHostedService _acquisitionService;
    private readonly ILogger<DirisAcquisitionControlService> _logger;
    private volatile bool _isRunning = true;
    private readonly object _lock = new object();

    public DirisAcquisitionControlService(
        DirisAcquisitionService acquisitionService,
        ILogger<DirisAcquisitionControlService> logger)
    {
        _acquisitionService = acquisitionService;
        _logger = logger;
    }

    /// <summary>
    /// État actuel de l'acquisition
    /// </summary>
    public bool IsRunning
    {
        get
        {
            lock (_lock)
            {
                return _isRunning;
            }
        }
    }

    /// <summary>
    /// Démarrer l'acquisition
    /// </summary>
    public async Task<bool> StartAcquisitionAsync()
    {
        lock (_lock)
        {
            if (_isRunning)
            {
                _logger.LogInformation("DIRIS acquisition is already running");
                return true;
            }

            _isRunning = true;
            _logger.LogInformation("DIRIS acquisition started");
        }

        try
        {
            // Le service BackgroundService redémarre automatiquement
            // On simule un redémarrage en changeant l'état
            await Task.Delay(100); // Petite pause pour la cohérence
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting DIRIS acquisition");
            lock (_lock)
            {
                _isRunning = false;
            }
            return false;
        }
    }

    /// <summary>
    /// Arrêter l'acquisition
    /// </summary>
    public async Task<bool> StopAcquisitionAsync()
    {
        lock (_lock)
        {
            if (!_isRunning)
            {
                _logger.LogInformation("DIRIS acquisition is already stopped");
                return true;
            }

            _isRunning = false;
            _logger.LogInformation("DIRIS acquisition stopped");
        }

        try
        {
            // Le service BackgroundService continue de tourner mais ne traite plus les données
            await Task.Delay(100); // Petite pause pour la cohérence
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping DIRIS acquisition");
            return false;
        }
    }

    /// <summary>
    /// Obtenir le statut détaillé de l'acquisition
    /// </summary>
    public object GetStatus()
    {
        lock (_lock)
        {
            return new
            {
                isRunning = _isRunning,
                status = _isRunning ? "Running" : "Stopped",
                lastUpdate = DateTime.UtcNow,
                message = _isRunning ? "Acquisition en cours" : "Acquisition arrêtée"
            };
        }
    }
}
