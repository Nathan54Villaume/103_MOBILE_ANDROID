using Diris.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;

namespace Diris.Server.Services;

public class DataRetentionService : BackgroundService
{
    private readonly ILogger<DataRetentionService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IMeasurementWriter _measurementWriter;
    private readonly Timer _cleanupTimer;
    private readonly DataRetentionOptions _options;

    public DataRetentionService(
        ILogger<DataRetentionService> logger,
        IConfiguration configuration,
        IMeasurementWriter measurementWriter)
    {
        _logger = logger;
        _configuration = configuration;
        _measurementWriter = measurementWriter;
        
        _options = new DataRetentionOptions();
        _configuration.GetSection("DataRetention").Bind(_options);

        // Créer un timer pour le nettoyage quotidien
        _cleanupTimer = new Timer(ExecuteCleanup, null, Timeout.Infinite, Timeout.Infinite);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("Data retention service is disabled");
            return;
        }

        _logger.LogInformation("Data retention service started. Retention: {RetentionDays} days, Cleanup at: {CleanupHour}:00", 
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

        _logger.LogInformation("Next cleanup scheduled for {NextCleanup}", nextCleanup);
    }

    private async void ExecuteCleanup(object? state)
    {
        try
        {
            _logger.LogInformation("Starting data retention cleanup...");
            
            var stats = await CleanupOldDataAsync();
            
            _logger.LogInformation("Data retention cleanup completed. Removed {DeletedCount} measurements, " +
                "retained {RetainedCount} measurements", stats.DeletedCount, stats.RetainedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during data retention cleanup");
        }
    }

    public async Task<CleanupStats> CleanupOldDataAsync()
    {
        var connectionString = _configuration.GetConnectionString("SqlAiAtr");
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("Connection string not found");
        }

        var cutoffDate = DateTime.UtcNow.AddDays(-_options.RetentionDays);
        var stats = new CleanupStats();

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

                _logger.LogDebug("Deleted batch of {Deleted} measurements, total: {TotalDeleted}/{TotalToDelete}", 
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

public class DataRetentionOptions
{
    public bool Enabled { get; set; } = true;
    public int RetentionDays { get; set; } = 10;
    public int CleanupHour { get; set; } = 2;
    public int BatchSize { get; set; } = 10000;
    public bool LogCleanupStats { get; set; } = true;
}

public class CleanupStats
{
    public int DeletedCount { get; set; }
    public int RetainedCount { get; set; }
    public DateTime CleanupDate { get; set; }
    public DateTime CutoffDate { get; set; }
}
