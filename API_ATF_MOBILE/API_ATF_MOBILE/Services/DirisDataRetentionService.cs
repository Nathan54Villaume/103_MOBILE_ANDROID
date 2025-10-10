using Diris.Core.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace API_ATF_MOBILE.Services;

/// <summary>
/// DIRIS Data retention background service
/// </summary>
public class DirisDataRetentionService : BackgroundService
{
    private readonly ILogger<DirisDataRetentionService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IMeasurementWriter _measurementWriter;
    private Timer _cleanupTimer;
    private DirisDataRetentionOptions _options;

    public DirisDataRetentionService(
        ILogger<DirisDataRetentionService> logger,
        IConfiguration configuration,
        IMeasurementWriter measurementWriter,
        IOptionsMonitor<DirisDataRetentionOptions> optionsMonitor)
    {
        _logger = logger;
        _configuration = configuration;
        _measurementWriter = measurementWriter;
        _options = optionsMonitor.CurrentValue;

        // Créer un timer pour le nettoyage quotidien
        _cleanupTimer = new Timer(ExecuteCleanup, null, Timeout.Infinite, Timeout.Infinite);

        optionsMonitor.OnChange(newOptions =>
        {
            _logger.LogInformation("DIRIS Data Retention configuration reloaded. New Retention: {RetentionDays} days, Cleanup Hour: {CleanupHour}",
                newOptions.RetentionDays, newOptions.CleanupHour);
            _options = newOptions;
            
            // Re-programmer le nettoyage avec les nouvelles options
            ScheduleNextCleanup();
        });
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("DIRIS Data retention service is disabled");
            return;
        }

        _logger.LogInformation("DIRIS Data retention service started. Retention: {RetentionDays} days, Cleanup at: {CleanupHour}:00", 
            _options.RetentionDays, _options.CleanupHour);

        // Programmer le premier nettoyage
        ScheduleNextCleanup();

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            
            // Vérifier si c'est l'heure du nettoyage
            var now = DateTime.Now;
            if (now.Hour == _options.CleanupHour && now.Minute < 5)
            {
                ScheduleNextCleanup();
            }
        }
    }

    private void ScheduleNextCleanup()
    {
        var now = DateTime.Now;
        var nextCleanup = now.Date.AddHours(_options.CleanupHour);
        
        if (nextCleanup <= now)
        {
            nextCleanup = nextCleanup.AddDays(1);
        }

        var delay = nextCleanup - now;
        _cleanupTimer.Change(delay, TimeSpan.FromHours(24));

        _logger.LogInformation("Next DIRIS cleanup scheduled for {NextCleanup}", nextCleanup);
    }

    private async void ExecuteCleanup(object? state)
    {
        try
        {
            _logger.LogInformation("Starting DIRIS data retention cleanup...");
            
            var stats = await CleanupOldDataAsync();
            
            _logger.LogInformation("DIRIS data retention cleanup completed. Removed {DeletedCount} measurements, " +
                "retained {RetainedCount} measurements", stats.DeletedCount, stats.RetainedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during DIRIS data retention cleanup");
        }
    }

    public async Task<DirisCleanupStats> CleanupOldDataAsync()
    {
        var connectionString = _configuration.GetConnectionString("SqlAiAtr");
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("Connection string not found");
        }

        var cutoffDate = DateTime.UtcNow.AddDays(-_options.RetentionDays);
        var stats = new DirisCleanupStats();

        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        // Compter les données avant nettoyage
        using (var countCmd = new SqlCommand(
            "SELECT COUNT(*) FROM DIRIS.Measurements WHERE UtcTs < @cutoffDate", connection))
        {
            countCmd.Parameters.AddWithValue("@cutoffDate", cutoffDate);
            stats.DeletedCount = (int)await countCmd.ExecuteScalarAsync();
        }

        using (var countCmd = new SqlCommand(
            "SELECT COUNT(*) FROM DIRIS.Measurements WHERE UtcTs >= @cutoffDate", connection))
        {
            countCmd.Parameters.AddWithValue("@cutoffDate", cutoffDate);
            stats.RetainedCount = (int)await countCmd.ExecuteScalarAsync();
        }

        if (stats.DeletedCount > 0)
        {
            // Supprimer par lots pour éviter les timeouts
            var batchSize = _options.BatchSize;
            var totalDeleted = 0;

            while (totalDeleted < stats.DeletedCount)
            {
                using var deleteCmd = new SqlCommand(
                    "DELETE TOP(@batchSize) FROM DIRIS.Measurements WHERE UtcTs < @cutoffDate", connection);
                deleteCmd.Parameters.AddWithValue("@batchSize", batchSize);
                deleteCmd.Parameters.AddWithValue("@cutoffDate", cutoffDate);
                deleteCmd.CommandTimeout = 300; // 5 minutes timeout

                var deleted = await deleteCmd.ExecuteNonQueryAsync();
                totalDeleted += deleted;

                if (deleted == 0) break; // Plus rien à supprimer

                _logger.LogDebug("Deleted batch of {Deleted} DIRIS measurements, total: {TotalDeleted}/{TotalToDelete}", 
                    deleted, totalDeleted, stats.DeletedCount);

                // Petite pause entre les lots
                await Task.Delay(100);
            }

            stats.DeletedCount = totalDeleted;
        }

        stats.CleanupDate = DateTime.UtcNow;
        stats.CutoffDate = cutoffDate;

        return stats;
    }

    public override void Dispose()
    {
        _cleanupTimer?.Dispose();
        base.Dispose();
    }
}

/// <summary>
/// DIRIS Data retention configuration options
/// </summary>
public class DirisDataRetentionOptions
{
    public bool Enabled { get; set; } = true;
    public int RetentionDays { get; set; } = 10;
    public int CleanupHour { get; set; } = 2;
    public int BatchSize { get; set; } = 10000;
    public bool LogCleanupStats { get; set; } = true;
}

/// <summary>
/// DIRIS Cleanup statistics
/// </summary>
public class DirisCleanupStats
{
    public int DeletedCount { get; set; }
    public int RetainedCount { get; set; }
    public DateTime CleanupDate { get; set; }
    public DateTime CutoffDate { get; set; }
}

