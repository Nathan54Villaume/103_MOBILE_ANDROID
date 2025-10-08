using Diris.Core.Interfaces;
using Diris.Core.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Diris.Storage.SqlServer.Configuration;
using System.Data;

namespace Diris.Storage.SqlServer.Repositories;

/// <summary>
/// SQL Server implementation of device registry
/// </summary>
public class DeviceRepository : IDeviceRegistry
{
    private readonly string _connectionString;
    private readonly ILogger<DeviceRepository> _logger;
    private readonly int _commandTimeout;

    public DeviceRepository(IOptions<SqlServerOptions> options, ILogger<DeviceRepository> logger)
    {
        _connectionString = options.Value.ConnectionString;
        _commandTimeout = options.Value.CommandTimeoutSeconds;
        _logger = logger;
    }

    public async Task<IEnumerable<Device>> GetEnabledDevicesAsync()
    {
        const string sql = @"
            SELECT DeviceId, Name, IpAddress, Protocol, Enabled, PollIntervalMs, 
                   LastSeenUtc, MetaJson, CreatedUtc, UpdatedUtc
            FROM DIRIS.Devices 
            WHERE Enabled = 1
            ORDER BY Name";

        return await ExecuteQueryAsync(sql, reader => MapDevice(reader));
    }

    public async Task<Device?> GetDeviceAsync(int deviceId)
    {
        const string sql = @"
            SELECT DeviceId, Name, IpAddress, Protocol, Enabled, PollIntervalMs, 
                   LastSeenUtc, MetaJson, CreatedUtc, UpdatedUtc
            FROM DIRIS.Devices 
            WHERE DeviceId = @DeviceId";

        var devices = await ExecuteQueryAsync(sql, reader => MapDevice(reader), 
            new SqlParameter("@DeviceId", deviceId));
        
        return devices.FirstOrDefault();
    }

    public async Task<IEnumerable<Device>> GetAllDevicesAsync()
    {
        const string sql = @"
            SELECT DeviceId, Name, IpAddress, Protocol, Enabled, PollIntervalMs, 
                   LastSeenUtc, MetaJson, CreatedUtc, UpdatedUtc
            FROM DIRIS.Devices 
            ORDER BY Name";

        return await ExecuteQueryAsync(sql, reader => MapDevice(reader));
    }

    public async Task UpdateDeviceLastSeenAsync(int deviceId, DateTime utc)
    {
        const string sql = @"
            UPDATE DIRIS.Devices 
            SET LastSeenUtc = @LastSeenUtc, UpdatedUtc = @UpdatedUtc
            WHERE DeviceId = @DeviceId";

        await ExecuteNonQueryAsync(sql,
            new SqlParameter("@DeviceId", deviceId),
            new SqlParameter("@LastSeenUtc", utc),
            new SqlParameter("@UpdatedUtc", DateTime.UtcNow));
    }

    public async Task<Device> AddDeviceAsync(Device device)
    {
        const string sql = @"
            INSERT INTO DIRIS.Devices (Name, IpAddress, Protocol, Enabled, PollIntervalMs, MetaJson, CreatedUtc, UpdatedUtc)
            OUTPUT INSERTED.DeviceId
            VALUES (@Name, @IpAddress, @Protocol, @Enabled, @PollIntervalMs, @MetaJson, @CreatedUtc, @UpdatedUtc)";

        var deviceId = await ExecuteScalarAsync<int>(sql,
            new SqlParameter("@Name", device.Name),
            new SqlParameter("@IpAddress", device.IpAddress),
            new SqlParameter("@Protocol", device.Protocol),
            new SqlParameter("@Enabled", device.Enabled),
            new SqlParameter("@PollIntervalMs", device.PollIntervalMs),
            new SqlParameter("@MetaJson", (object?)device.MetaJson ?? DBNull.Value),
            new SqlParameter("@CreatedUtc", device.CreatedUtc),
            new SqlParameter("@UpdatedUtc", device.UpdatedUtc));

        device.DeviceId = deviceId;
        return device;
    }

    public async Task UpdateDeviceAsync(Device device)
    {
        const string sql = @"
            UPDATE DIRIS.Devices 
            SET Name = @Name, IpAddress = @IpAddress, Protocol = @Protocol, 
                Enabled = @Enabled, PollIntervalMs = @PollIntervalMs, 
                MetaJson = @MetaJson, UpdatedUtc = @UpdatedUtc
            WHERE DeviceId = @DeviceId";

        await ExecuteNonQueryAsync(sql,
            new SqlParameter("@DeviceId", device.DeviceId),
            new SqlParameter("@Name", device.Name),
            new SqlParameter("@IpAddress", device.IpAddress),
            new SqlParameter("@Protocol", device.Protocol),
            new SqlParameter("@Enabled", device.Enabled),
            new SqlParameter("@PollIntervalMs", device.PollIntervalMs),
            new SqlParameter("@MetaJson", (object?)device.MetaJson ?? DBNull.Value),
            new SqlParameter("@UpdatedUtc", DateTime.UtcNow));
    }

    public async Task DeleteDeviceAsync(int deviceId)
    {
        const string sql = "DELETE FROM DIRIS.Devices WHERE DeviceId = @DeviceId";
        await ExecuteNonQueryAsync(sql, new SqlParameter("@DeviceId", deviceId));
    }

    public async Task<IEnumerable<TagMap>> GetTagMappingsAsync(int deviceId)
    {
        const string sql = @"
            SELECT DeviceId, Signal, WebMiKey, Unit, Scale, Enabled, Description
            FROM DIRIS.TagMap 
            WHERE DeviceId = @DeviceId
            ORDER BY Signal";

        return await ExecuteQueryAsync(sql, reader => MapTagMap(reader),
            new SqlParameter("@DeviceId", deviceId));
    }

    public async Task UpdateTagMappingsAsync(int deviceId, IEnumerable<TagMap> mappings)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        using var transaction = connection.BeginTransaction();
        try
        {
            // Delete existing mappings
            const string deleteSql = "DELETE FROM DIRIS.TagMap WHERE DeviceId = @DeviceId";
            using var deleteCmd = new SqlCommand(deleteSql, connection, transaction);
            deleteCmd.Parameters.AddWithValue("@DeviceId", deviceId);
            await deleteCmd.ExecuteNonQueryAsync();

            // Insert new mappings
            const string insertSql = @"
                INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled, Description)
                VALUES (@DeviceId, @Signal, @WebMiKey, @Unit, @Scale, @Enabled, @Description)";

            foreach (var mapping in mappings)
            {
                using var insertCmd = new SqlCommand(insertSql, connection, transaction);
                insertCmd.Parameters.AddWithValue("@DeviceId", deviceId);
                insertCmd.Parameters.AddWithValue("@Signal", mapping.Signal);
                insertCmd.Parameters.AddWithValue("@WebMiKey", mapping.WebMiKey);
                insertCmd.Parameters.AddWithValue("@Unit", (object?)mapping.Unit ?? DBNull.Value);
                insertCmd.Parameters.AddWithValue("@Scale", mapping.Scale);
                insertCmd.Parameters.AddWithValue("@Enabled", mapping.Enabled);
                insertCmd.Parameters.AddWithValue("@Description", (object?)mapping.Description ?? DBNull.Value);
                await insertCmd.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task<IEnumerable<T>> ExecuteQueryAsync<T>(string sql, Func<SqlDataReader, T> mapper, params SqlParameter[] parameters)
    {
        var results = new List<T>();
        
        using var connection = new SqlConnection(_connectionString);
        using var command = new SqlCommand(sql, connection) { CommandTimeout = _commandTimeout };
        command.Parameters.AddRange(parameters);

        await connection.OpenAsync();
        using var reader = await command.ExecuteReaderAsync();
        
        while (await reader.ReadAsync())
        {
            results.Add(mapper(reader));
        }

        return results;
    }

    private async Task ExecuteNonQueryAsync(string sql, params SqlParameter[] parameters)
    {
        using var connection = new SqlConnection(_connectionString);
        using var command = new SqlCommand(sql, connection) { CommandTimeout = _commandTimeout };
        command.Parameters.AddRange(parameters);

        await connection.OpenAsync();
        await command.ExecuteNonQueryAsync();
    }

    private async Task<T> ExecuteScalarAsync<T>(string sql, params SqlParameter[] parameters)
    {
        using var connection = new SqlConnection(_connectionString);
        using var command = new SqlCommand(sql, connection) { CommandTimeout = _commandTimeout };
        command.Parameters.AddRange(parameters);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        return (T)Convert.ChangeType(result, typeof(T));
    }

    private static Device MapDevice(SqlDataReader reader)
    {
        return new Device
        {
            DeviceId = reader.GetInt32("DeviceId"),
            Name = reader.GetString("Name"),
            IpAddress = reader.GetString("IpAddress"),
            Protocol = reader.GetString("Protocol"),
            Enabled = reader.GetBoolean("Enabled"),
            PollIntervalMs = reader.GetInt32("PollIntervalMs"),
            LastSeenUtc = reader.IsDBNull("LastSeenUtc") ? null : reader.GetDateTime("LastSeenUtc"),
            MetaJson = reader.IsDBNull("MetaJson") ? null : reader.GetString("MetaJson"),
            CreatedUtc = reader.GetDateTime("CreatedUtc"),
            UpdatedUtc = reader.GetDateTime("UpdatedUtc")
        };
    }

    private static TagMap MapTagMap(SqlDataReader reader)
    {
        return new TagMap
        {
            DeviceId = reader.GetInt32("DeviceId"),
            Signal = reader.GetString("Signal"),
            WebMiKey = reader.GetString("WebMiKey"),
            Unit = reader.IsDBNull("Unit") ? null : reader.GetString("Unit"),
            Scale = reader.GetDouble("Scale"),
            Enabled = reader.GetBoolean("Enabled"),
            Description = reader.IsDBNull("Description") ? null : reader.GetString("Description")
        };
    }
}
