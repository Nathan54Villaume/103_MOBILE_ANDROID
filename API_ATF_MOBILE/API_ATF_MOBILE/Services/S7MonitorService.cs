using S7.Net;

namespace API_ATF_MOBILE.Services
{
    public interface IS7MonitorService
    {
        Task<S7ConnectionStatus> GetConnectionStatusAsync();
        Task<bool> TestConnectionAsync();
        Task<S7VariableRead> ReadVariableAsync(string address);
        S7Configuration GetConfiguration();
    }

    public class S7MonitorService : IS7MonitorService
    {
        private readonly S7CommunicationService _s7Service;
        private readonly ILogger<S7MonitorService> _logger;
        private DateTime? _lastConnectionAttempt;
        private DateTime? _lastSuccessfulConnection;
        private int _connectionAttempts = 0;
        private int _successfulReads = 0;
        private int _failedReads = 0;

        public S7MonitorService(ILogger<S7MonitorService> logger)
        {
            _s7Service = new S7CommunicationService();
            _logger = logger;
        }

        public async Task<S7ConnectionStatus> GetConnectionStatusAsync()
        {
            var status = new S7ConnectionStatus
            {
                IsConnected = _s7Service.IsConnected,
                LastConnectionAttempt = _lastConnectionAttempt,
                LastSuccessfulConnection = _lastSuccessfulConnection,
                TotalConnectionAttempts = _connectionAttempts,
                SuccessfulReads = _successfulReads,
                FailedReads = _failedReads,
                CheckTime = DateTime.Now,
                Configuration = GetConfiguration()
            };

            return await Task.FromResult(status);
        }

        public async Task<bool> TestConnectionAsync()
        {
            _lastConnectionAttempt = DateTime.Now;
            _connectionAttempts++;

            try
            {
                var isConnected = _s7Service.Connect();
                
                if (isConnected)
                {
                    _lastSuccessfulConnection = DateTime.Now;
                    _logger.LogInformation("Connexion S7 réussie à {Time}", DateTime.Now);
                    
                    // Déconnecter pour ne pas garder la connexion ouverte inutilement
                    _s7Service.Disconnect();
                }
                else
                {
                    _logger.LogWarning("Échec de connexion S7 à {Time}", DateTime.Now);
                }

                return await Task.FromResult(isConnected);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors du test de connexion S7");
                return false;
            }
        }

        public async Task<S7VariableRead> ReadVariableAsync(string address)
        {
            var result = new S7VariableRead
            {
                Address = address,
                ReadTime = DateTime.Now
            };

            try
            {
                if (!_s7Service.IsConnected)
                {
                    _s7Service.Connect();
                }

                if (!_s7Service.IsConnected)
                {
                    result.Success = false;
                    result.ErrorMessage = "Non connecté au PLC";
                    _failedReads++;
                    return result;
                }

                // Déterminer le type de variable à lire
                if (address.Contains("DBD"))
                {
                    result.Value = _s7Service.ReadFloat(address);
                    result.DataType = "Float";
                }
                else if (address.Contains("DBW"))
                {
                    result.Value = _s7Service.ReadInt16(address);
                    result.DataType = "Int16";
                }
                else if (address.Contains("DBB"))
                {
                    result.Value = _s7Service.ReadByte(address);
                    result.DataType = "Byte";
                }
                else if (address.Contains("DBX"))
                {
                    result.Value = _s7Service.ReadBool(address);
                    result.DataType = "Bool";
                }
                else
                {
                    // Lecture brute
                    result.Value = _s7Service.ReadRaw(address);
                    result.DataType = "Raw";
                }

                result.Success = true;
                _successfulReads++;
                _logger.LogDebug("Lecture S7 réussie : {Address} = {Value}", address, result.Value);
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.ErrorMessage = ex.Message;
                _failedReads++;
                _logger.LogError(ex, "Erreur lors de la lecture de {Address}", address);
            }

            return await Task.FromResult(result);
        }

        public S7Configuration GetConfiguration()
        {
            return new S7Configuration
            {
                IpAddress = "10.250.13.10",
                CpuType = "S7-1500",
                Rack = 0,
                Slot = 1
            };
        }
    }

    public class S7ConnectionStatus
    {
        public bool IsConnected { get; set; }
        public DateTime? LastConnectionAttempt { get; set; }
        public DateTime? LastSuccessfulConnection { get; set; }
        public int TotalConnectionAttempts { get; set; }
        public int SuccessfulReads { get; set; }
        public int FailedReads { get; set; }
        public DateTime CheckTime { get; set; }
        public S7Configuration Configuration { get; set; } = new();
    }

    public class S7VariableRead
    {
        public string Address { get; set; } = string.Empty;
        public bool Success { get; set; }
        public object? Value { get; set; }
        public string DataType { get; set; } = string.Empty;
        public string? ErrorMessage { get; set; }
        public DateTime ReadTime { get; set; }
    }

    public class S7Configuration
    {
        public string IpAddress { get; set; } = string.Empty;
        public string CpuType { get; set; } = string.Empty;
        public int Rack { get; set; }
        public int Slot { get; set; }
    }
}

