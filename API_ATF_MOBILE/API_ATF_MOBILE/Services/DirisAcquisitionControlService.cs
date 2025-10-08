using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace API_ATF_MOBILE.Services;

/// <summary>
/// Service de contrôle pour l'acquisition DIRIS
/// Permet de démarrer/arrêter l'acquisition via l'API avec persistance de l'état
/// </summary>
public class DirisAcquisitionControlService
{
    private readonly ILogger<DirisAcquisitionControlService> _logger;
    private volatile bool _isRunning;
    private readonly object _lock = new object();
    private readonly string _statePath;
    private DateTime _lastStateChange = DateTime.UtcNow;

    public DirisAcquisitionControlService(
        ILogger<DirisAcquisitionControlService> logger)
    {
        _logger = logger;
        
        // Configurer le chemin de persistance de l'état
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var appFolder = Path.Combine(appDataPath, "API_ATF_MOBILE");
        Directory.CreateDirectory(appFolder);
        _statePath = Path.Combine(appFolder, "diris-acquisition-state.json");
        
        // Charger l'état sauvegardé ou démarrer par défaut
        _isRunning = LoadState();
        _logger.LogInformation("DIRIS Acquisition Control Service initialized with state: {State}", _isRunning ? "Running" : "Stopped");
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
    public Task<bool> StartAcquisitionAsync()
    {
        lock (_lock)
        {
            if (_isRunning)
            {
                _logger.LogInformation("DIRIS acquisition is already running");
                return Task.FromResult(true);
            }

            _isRunning = true;
            _lastStateChange = DateTime.UtcNow;
            _logger.LogInformation("DIRIS acquisition started");
            SaveState();
        }

        return Task.FromResult(true);
    }

    /// <summary>
    /// Arrêter l'acquisition
    /// </summary>
    public Task<bool> StopAcquisitionAsync()
    {
        lock (_lock)
        {
            if (!_isRunning)
            {
                _logger.LogInformation("DIRIS acquisition is already stopped");
                return Task.FromResult(true);
            }

            _isRunning = false;
            _lastStateChange = DateTime.UtcNow;
            _logger.LogInformation("DIRIS acquisition stopped");
            SaveState();
        }

        return Task.FromResult(true);
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
                lastStateChange = _lastStateChange,
                lastUpdate = DateTime.UtcNow,
                message = _isRunning ? "Acquisition en cours" : "Acquisition arrêtée",
                statePersisted = File.Exists(_statePath)
            };
        }
    }

    /// <summary>
    /// Charger l'état depuis le fichier de persistance
    /// </summary>
    private bool LoadState()
    {
        try
        {
            if (File.Exists(_statePath))
            {
                var json = File.ReadAllText(_statePath);
                var state = JsonSerializer.Deserialize<AcquisitionState>(json);
                if (state != null)
                {
                    _logger.LogInformation("Loaded persisted acquisition state: {State} (last changed: {LastChange})", 
                        state.IsRunning ? "Running" : "Stopped", state.LastStateChange);
                    _lastStateChange = state.LastStateChange;
                    return state.IsRunning;
                }
            }
            
            _logger.LogInformation("No persisted state found, defaulting to Running");
            return true; // Par défaut, démarrer l'acquisition
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading acquisition state, defaulting to Running");
            return true;
        }
    }

    /// <summary>
    /// Sauvegarder l'état dans le fichier de persistance
    /// </summary>
    private void SaveState()
    {
        try
        {
            var state = new AcquisitionState
            {
                IsRunning = _isRunning,
                LastStateChange = _lastStateChange
            };
            
            var json = JsonSerializer.Serialize(state, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_statePath, json);
            
            _logger.LogDebug("Acquisition state saved: {State}", _isRunning ? "Running" : "Stopped");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving acquisition state");
        }
    }

    private class AcquisitionState
    {
        public bool IsRunning { get; set; }
        public DateTime LastStateChange { get; set; }
    }
}
