using Diris.Core.Interfaces;
using Diris.Core.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Diris.Storage.SqlServer.Configuration;
using System.Collections.Concurrent;
using System.Data;

namespace Diris.Storage.SqlServer;

/// <summary>
/// Bulk writer for measurements using SqlBulkCopy
/// </summary>
public class BulkWriter : IMeasurementWriter, IDisposable
{
    private readonly string _connectionString;
    private readonly ILogger<BulkWriter> _logger;
    private readonly SqlServerOptions _options;
    private readonly ConcurrentQueue<Measurement> _buffer = new();
    private readonly Timer _flushTimer;
    private readonly SemaphoreSlim _flushSemaphore = new(1, 1);
    private volatile bool _disposed;

    public BulkWriter(IOptions<SqlServerOptions> options, ILogger<BulkWriter> logger)
    {
        _options = options.Value;
        _connectionString = _options.ConnectionString;
        _logger = logger;

        // Start flush timer
        _flushTimer = new Timer(FlushTimerCallback, null, 
            TimeSpan.FromMilliseconds(_options.MaxFlushIntervalMs), 
            TimeSpan.FromMilliseconds(_options.MaxFlushIntervalMs));
    }

    public async Task WriteAsync(IEnumerable<Measurement> measurements)
    {
        if (_disposed) return;

        foreach (var measurement in measurements)
        {
            _buffer.Enqueue(measurement);
        }

        // Check if we should flush immediately
        if (_buffer.Count >= _options.MaxBufferSize)
        {
            _ = Task.Run(async () => await FlushAsync());
        }
    }

    public Task<int> GetPendingCountAsync()
    {
        return Task.FromResult(_buffer.Count);
    }

    public int GetBufferSize()
    {
        return _buffer.Count;
    }

    public int GetMaxBufferSize()
    {
        return _options.MaxBufferSize;
    }

    public async Task FlushAsync()
    {
        if (_disposed || _buffer.IsEmpty) return;

        await _flushSemaphore.WaitAsync();
        var measurements = new List<Measurement>();
        try
        {
            if (_buffer.IsEmpty) return;

            while (_buffer.TryDequeue(out var measurement))
            {
                measurements.Add(measurement);
            }

            if (measurements.Count == 0) return;

            await WriteToDatabaseAsync(measurements);
            _logger.LogDebug("Flushed {Count} measurements to database", measurements.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error flushing measurements to database");
            // Re-queue measurements on error
            foreach (var measurement in measurements)
            {
                _buffer.Enqueue(measurement);
            }
            throw;
        }
        finally
        {
            _flushSemaphore.Release();
        }
    }

    public QueueMetrics GetQueueMetrics()
    {
        return new QueueMetrics
        {
            MeasurementBufferSize = _buffer.Count,
            SqlBulkQueueSize = 0, // Not applicable for this implementation
            PendingWrites = _buffer.Count,
            MaxBufferSize = _options.MaxBufferSize
        };
    }

    private async void FlushTimerCallback(object? state)
    {
        try
        {
            if (_buffer.Count >= _options.MinBatchSize)
            {
                await FlushAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in flush timer callback");
        }
    }

    private async Task WriteToDatabaseAsync(List<Measurement> measurements)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        using var transaction = connection.BeginTransaction();
        try
        {
            using var bulkCopy = new SqlBulkCopy(connection, SqlBulkCopyOptions.Default, transaction)
            {
                DestinationTableName = "DIRIS.Measurements",
                BatchSize = _options.BulkCopyBatchSize,
                BulkCopyTimeout = _options.CommandTimeoutSeconds
            };

            // Configure column mappings
            bulkCopy.ColumnMappings.Add("DeviceId", "DeviceId");
            bulkCopy.ColumnMappings.Add("UtcTs", "UtcTs");
            bulkCopy.ColumnMappings.Add("Signal", "Signal");
            bulkCopy.ColumnMappings.Add("Value", "Value");
            bulkCopy.ColumnMappings.Add("Quality", "Quality");
            bulkCopy.ColumnMappings.Add("IngestTs", "IngestTs");

            // Create DataTable for bulk copy
            var dataTable = CreateDataTable(measurements);
            await bulkCopy.WriteToServerAsync(dataTable);

            await transaction.CommitAsync();
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error writing {Count} measurements to database", measurements.Count);
            throw;
        }
    }

    private static DataTable CreateDataTable(List<Measurement> measurements)
    {
        var dataTable = new DataTable();
        
        dataTable.Columns.Add("DeviceId", typeof(int));
        dataTable.Columns.Add("UtcTs", typeof(DateTime));
        dataTable.Columns.Add("Signal", typeof(string));
        dataTable.Columns.Add("Value", typeof(double));
        dataTable.Columns.Add("Quality", typeof(byte));
        dataTable.Columns.Add("IngestTs", typeof(DateTime));

        foreach (var measurement in measurements)
        {
            var row = dataTable.NewRow();
            row["DeviceId"] = measurement.DeviceId;
            row["UtcTs"] = measurement.UtcTs;
            row["Signal"] = measurement.Signal;
            row["Value"] = measurement.Value;
            row["Quality"] = measurement.Quality;
            row["IngestTs"] = measurement.IngestTs;
            dataTable.Rows.Add(row);
        }

        return dataTable;
    }

    public void Dispose()
    {
        if (_disposed) return;
        
        _disposed = true;
        _flushTimer?.Dispose();
        
        // Flush remaining data
        if (!_buffer.IsEmpty)
        {
            try
            {
                FlushAsync().Wait(TimeSpan.FromSeconds(10));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error flushing remaining measurements during dispose");
            }
        }
        
        _flushSemaphore?.Dispose();
    }
}
