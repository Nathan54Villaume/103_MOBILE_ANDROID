namespace Diris.Storage.SqlServer.Configuration;

/// <summary>
/// SQL Server storage configuration options
/// </summary>
public class SqlServerOptions
{
    public const string SectionName = "SqlServer";

    /// <summary>
    /// Connection string for SQL Server
    /// </summary>
    public string ConnectionString { get; set; } = string.Empty;

    /// <summary>
    /// Maximum number of measurements to buffer before writing
    /// </summary>
    public int MaxBufferSize { get; set; } = 1000;

    /// <summary>
    /// Minimum number of measurements to trigger a write
    /// </summary>
    public int MinBatchSize { get; set; } = 250;

    /// <summary>
    /// Maximum time to wait before forcing a write (in milliseconds)
    /// </summary>
    public int MaxFlushIntervalMs { get; set; } = 5000;

    /// <summary>
    /// Command timeout for SQL operations (in seconds)
    /// </summary>
    public int CommandTimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Enable bulk copy optimizations
    /// </summary>
    public bool EnableBulkCopyOptimizations { get; set; } = true;

    /// <summary>
    /// Bulk copy batch size
    /// </summary>
    public int BulkCopyBatchSize { get; set; } = 1000;

    /// <summary>
    /// Enable retry policy for SQL operations
    /// </summary>
    public bool EnableRetryPolicy { get; set; } = true;

    /// <summary>
    /// Maximum retry attempts
    /// </summary>
    public int MaxRetryAttempts { get; set; } = 3;

    /// <summary>
    /// Base delay for retry backoff (in milliseconds)
    /// </summary>
    public int RetryBaseDelayMs { get; set; } = 1000;
}
